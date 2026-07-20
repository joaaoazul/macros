import type { Goal, Sex, Targets, Entry, Profile } from '../types'
import { AGE } from './limits'

/** TMB por Katch-McArdle, a partir da massa magra (precisa de % de gordura).
 *
 * Mais fiel que Mifflin quando sabemos a composição corporal: duas pessoas com
 * o mesmo peso mas gorduras diferentes têm metabolismos diferentes. */
export function bmrKatch(weightKg: number, bodyFatPct: number): number {
  const leanMassKg = weightKg * (1 - bodyFatPct / 100)
  return 370 + 21.6 * leanMassKg
}

/** BMR (TMB): Katch-McArdle quando há % de gordura, senão Mifflin-St Jeor. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number, bodyFatPct?: number): number {
  if (bodyFatPct != null && bodyFatPct > 0) return bmrKatch(weightKg, bodyFatPct)
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'M' ? base + 5 : base - 161
}

export function tdee(sex: Sex, weightKg: number, heightCm: number, age: number, activity: number, bodyFatPct?: number): number {
  return bmr(sex, weightKg, heightCm, age, bodyFatPct) * activity
}

/** Idade a partir da data de nascimento (ISO), para não envelhecer preso a um
 * valor escrito uma vez. Cai no `fallback` guardado se a data faltar ou for
 * inválida/absurda. */
export function ageFromBirthdate(birthdate: string | undefined, fallback: number): number {
  if (!birthdate) return fallback
  const b = new Date(birthdate)
  if (Number.isNaN(b.getTime())) return fallback
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const monthDiff = now.getMonth() - b.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < b.getDate())) age--
  return age >= AGE.min && age <= AGE.max ? age : fallback
}

export function bmi(weightKg: number, heightCm: number): number {
  const h = heightCm / 100
  return weightKg / (h * h)
}

/** Meta de água: ~35 ml/kg, arredondada aos 250 ml. */
export function waterTarget(weightKg: number): number {
  return Math.round((weightKg * 35) / 250) * 250
}

const GOAL_FACTOR: Record<Goal, number> = { cut: 0.8, maintain: 1, bulk: 1.1 }
const PROTEIN_PER_KG: Record<Goal, number> = { cut: 2.2, maintain: 1.8, bulk: 2.0 }

/**
 * Alvos diários: calorias a partir do TDEE ajustado ao objetivo,
 * proteína por kg de peso, gordura a 25% das kcal, resto em hidratos.
 */
export function computeTargets(sex: Sex, weightKg: number, heightCm: number, age: number, activity: number, goal: Goal, bodyFatPct?: number): Targets {
  const kcal = Math.round(tdee(sex, weightKg, heightCm, age, activity, bodyFatPct) * GOAL_FACTOR[goal])
  const protein = Math.round(PROTEIN_PER_KG[goal] * weightKg)
  const fat = Math.round((kcal * 0.25) / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { kcal, protein, carbs, fat, waterMl: waterTarget(weightKg) }
}

/** Gramas a partir de kcal + repartição percentual (hidratos/proteína/gordura). */
export function targetsFromSplit(kcal: number, carbsPct: number, proteinPct: number, fatPct: number, waterMl: number): Targets {
  return {
    kcal,
    carbs: Math.round((kcal * carbsPct) / 100 / 4),
    protein: Math.round((kcal * proteinPct) / 100 / 4),
    fat: Math.round((kcal * fatPct) / 100 / 9),
    waterMl,
  }
}

/** Repartição percentual atual dos alvos (soma forçada a 100). */
export function splitFromTargets(t: Targets): { carbsPct: number; proteinPct: number; fatPct: number } {
  const total = t.carbs * 4 + t.protein * 4 + t.fat * 9
  if (total <= 0) return { carbsPct: 50, proteinPct: 20, fatPct: 30 }
  const carbsPct = Math.round(((t.carbs * 4) / total) * 100)
  const proteinPct = Math.round(((t.protein * 4) / total) * 100)
  return { carbsPct, proteinPct, fatPct: 100 - carbsPct - proteinPct }
}

/** Migra perfis guardados antes da meta de água existir. */
export function withWaterTarget(p: Profile): Profile {
  if (p.targets.waterMl) return p
  return { ...p, targets: { ...p.targets, waterMl: waterTarget(p.weightKg) } }
}

export interface DayTotals {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export function sumEntries(entries: Entry[]): DayTotals {
  return entries.reduce(
    (t, e) => ({
      kcal: t.kcal + e.kcal,
      protein: t.protein + e.protein,
      carbs: t.carbs + e.carbs,
      fat: t.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export const ACTIVITY_LEVELS: { value: number; label: string; hint: string }[] = [
  { value: 1.2, label: 'Sedentário', hint: 'Pouco ou nenhum exercício' },
  { value: 1.375, label: 'Leve', hint: 'Exercício 1–3× por semana' },
  { value: 1.55, label: 'Moderado', hint: 'Exercício 3–5× por semana' },
  { value: 1.725, label: 'Alto', hint: 'Exercício 6–7× por semana' },
  { value: 1.9, label: 'Muito alto', hint: 'Treino intenso diário / trabalho físico' },
]

export const GOALS: { value: Goal; label: string; hint: string; emoji: string }[] = [
  { value: 'cut', label: 'Perder gordura', hint: 'Défice de ~20%', emoji: '🔥' },
  { value: 'maintain', label: 'Manter o peso', hint: 'Calorias de manutenção', emoji: '⚖️' },
  { value: 'bulk', label: 'Ganhar músculo', hint: 'Excedente de ~10%', emoji: '💪' },
]
