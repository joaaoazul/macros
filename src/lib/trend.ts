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
import { tdee } from './calc'

/** kcal por kg de massa corporal — aproximação clássica (1 kg ≈ 7700 kcal). */
const KCAL_PER_KG = 7700

/** Guardrails: sem isto não há sugestão nenhuma. */
export const MIN_WEIGH_INS = 4
export const MIN_DAYS_SPAN = 14
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

/** Sugestão de ajuste, ou null quando não há dados/divergência que a justifiquem. */
export function suggestAdjustment(profile: Profile, weights: Weight[]): TargetSuggestion | null {
  const recent = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  if (recent.length < MIN_WEIGH_INS) return null

  const spanDays =
    (new Date(recent[recent.length - 1].date).getTime() - new Date(recent[0].date).getTime()) /
    86_400_000
  if (spanDays < MIN_DAYS_SPAN) return null

  const actualRate = weightRatePerWeek(recent)
  if (actualRate === null) return null

  // ritmo implícito no alvo actual: (alvo − TDEE) kcal/dia → kg/semana
  const maintenance = tdee(profile.sex, profile.weightKg, profile.heightCm, profile.age, profile.activity)
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
