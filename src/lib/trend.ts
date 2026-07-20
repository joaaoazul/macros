/** Tendência de peso e sugestão de ajuste às calorias.
 *
 * O objectivo já implica um ritmo: a app define cut = TDEE×0.8 e bulk = TDEE×1.1
 * (ver GOAL_FACTOR em calc.ts), portanto o défice/excedente diário é
 * `alvo − TDEE` e o ritmo esperado sai daí. Comparamos com o ritmo real medido
 * na balança e sugerimos a diferença.
 *
 * Isto SUGERE, nunca aplica sozinho. E cala-se sempre que os dados não chegam
 * para ter confiança — é preferível não dizer nada do que mandar alguém comer
 * menos com base em três dias de retenção de água.
 */

import type { Profile } from '../types'
import { ageFromBirthdate, tdee } from './calc'

/** kcal por kg de massa corporal — aproximação clássica (1 kg ≈ 7700 kcal). */
const KCAL_PER_KG = 7700

/** Guardrails: sem isto não há sugestão nenhuma. */
export const MIN_WEIGH_INS = 4
export const MIN_DAYS_SPAN = 14
/** Manutenção aprendida: mínimo de dias com registo real a sobrepor pesagens. */
export const MIN_INTAKE_DAYS = 14
/** Um dia com menos kcal do que isto é registo incompleto, não jejum. */
const COMPLETE_DAY_KCAL = 800
/** Quão longe a manutenção aprendida pode fugir do Mifflin antes de a cortarmos. */
const LEARNED_CLAMP = 0.35
/** Abaixo disto é ruído (água, sal, hora do dia), não tendência. */
export const NOISE_FLOOR_KG_WEEK = 0.2
/** Nunca sugerir mexer mais do que isto de uma vez. */
export const MAX_DELTA_KCAL = 300
/** Chão absoluto: não sugerir alvos abaixo disto seja qual for a conta. */
export const MIN_KCAL_FLOOR = 1200

export interface Weight {
  date: string
  kg: number
}

/** Ritmo real em kg/semana por regressão linear (negativo = a perder).
 *
 * Regressão e não "primeiro vs último" porque o peso oscila muito de dia para
 * dia; dois pontos soltos dariam um número que muda conforme o dia em que se
 * olha. Devolve null se não houver pontos suficientes.
 */
export function weightRatePerWeek(weights: Weight[]): number | null {
  const pts = [...weights]
    .filter((w) => Number.isFinite(w.kg) && w.kg > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (pts.length < 2) return null

  const t0 = new Date(pts[0].date).getTime()
  const xs = pts.map((w) => (new Date(w.date).getTime() - t0) / 86_400_000) // dias
  const ys = pts.map((w) => w.kg)
  const n = xs.length
  const meanX = xs.reduce((s, x) => s + x, 0) / n
  const meanY = ys.reduce((s, y) => s + y, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY)
    den += (xs[i] - meanX) ** 2
  }
  if (den === 0) return null
  return (num / den) * 7 // kg por dia → por semana
}

/** Consumo total de um dia (kcal), para aprender a manutenção real. */
export interface DailyIntake {
  date: string
  kcal: number
}

/** TDEE de Mifflin com a idade derivada da data de nascimento e a % de gordura. */
function mifflinTdee(profile: Profile): number {
  const age = ageFromBirthdate(profile.birthdate, profile.age)
  return tdee(profile.sex, profile.weightKg, profile.heightCm, age, profile.activity, profile.bodyFatPct)
}

/** Manutenção estimada a partir dos DADOS: se comeste `x` em média e o peso
 * mudou a `r` kg/semana, a manutenção ≈ `x − (r/7)·7700`.
 *
 * Só devolve algo com dados que cheguem — ≥14 dias de registo completo a
 * sobrepor ≥MIN_WEIGH_INS pesagens — e o resultado é cortado a ±35% do Mifflin
 * para uma semana atípica não disparar um número absurdo. null caso contrário
 * (quem chama cai no Mifflin). */
export function estimateMaintenance(
  profile: Profile,
  weights: Weight[],
  intake: DailyIntake[],
): number | null {
  const days = intake.filter((d) => Number.isFinite(d.kcal) && d.kcal >= COMPLETE_DAY_KCAL)
  if (days.length < MIN_INTAKE_DAYS) return null

  const dates = days.map((d) => d.date).sort()
  const first = dates[0]
  const last = dates[dates.length - 1]
  const overlap = weights.filter((w) => w.kg > 0 && w.date >= first && w.date <= last)
  if (overlap.length < MIN_WEIGH_INS) return null

  const rate = weightRatePerWeek(overlap)
  if (rate === null) return null

  const meanIntake = days.reduce((s, d) => s + d.kcal, 0) / days.length
  const maintenance = meanIntake - (rate / 7) * KCAL_PER_KG

  const mifflin = mifflinTdee(profile)
  const lo = mifflin * (1 - LEARNED_CLAMP)
  const hi = mifflin * (1 + LEARNED_CLAMP)
  return Math.round(Math.max(lo, Math.min(hi, maintenance)))
}

export interface TargetSuggestion {
  /** ritmo medido, kg/semana (negativo = a perder) */
  actualRate: number
  /** ritmo que o alvo actual implica, kg/semana */
  expectedRate: number
  /** ajuste sugerido às kcal diárias (pode ser negativo) */
  deltaKcal: number
  /** novo alvo de kcal se aplicares */
  newKcal: number
  /** true quando o ajuste foi limitado pelo cap ou pelo chão */
  capped: boolean
}

/** Sugestão de ajuste, ou null quando não há dados/divergência que a justifiquem.
 *
 * Se `intake` chegar e houver dados suficientes, usa a manutenção APRENDIDA dos
 * teus registos; senão cai no Mifflin (comportamento de sempre). */
export function suggestAdjustment(
  profile: Profile,
  weights: Weight[],
  intake?: DailyIntake[],
): TargetSuggestion | null {
  const recent = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  if (recent.length < MIN_WEIGH_INS) return null

  const spanDays =
    (new Date(recent[recent.length - 1].date).getTime() - new Date(recent[0].date).getTime()) /
    86_400_000
  if (spanDays < MIN_DAYS_SPAN) return null

  const actualRate = weightRatePerWeek(recent)
  if (actualRate === null) return null

  // ritmo implícito no alvo actual: (alvo − manutenção) kcal/dia → kg/semana
  const learned = intake ? estimateMaintenance(profile, weights, intake) : null
  const maintenance = learned ?? mifflinTdee(profile)
  const dailyDelta = profile.targets.kcal - maintenance
  const expectedRate = (dailyDelta * 7) / KCAL_PER_KG

  const diff = actualRate - expectedRate // + = a subir mais / a descer menos do que o previsto
  if (Math.abs(diff) < NOISE_FLOOR_KG_WEEK) return null

  // corrigir a diferença: se estás a perder mais depressa do que o plano, comes mais
  const raw = Math.round((-diff * KCAL_PER_KG) / 7)
  const clamped = Math.max(-MAX_DELTA_KCAL, Math.min(MAX_DELTA_KCAL, raw))
  const floored = Math.max(MIN_KCAL_FLOOR, profile.targets.kcal + clamped)
  const deltaKcal = floored - profile.targets.kcal
  if (deltaKcal === 0) return null

  return {
    actualRate,
    expectedRate,
    deltaKcal,
    newKcal: floored,
    capped: clamped !== raw || floored !== profile.targets.kcal + clamped,
  }
}

export function formatRate(kgPerWeek: number): string {
  if (Math.abs(kgPerWeek) < 0.05) return 'estável'
  const abs = Math.abs(kgPerWeek).toFixed(2).replace('.', ',')
  return `${kgPerWeek < 0 ? '−' : '+'}${abs} kg/semana`
}
