import type { Goal, Sex, Targets, Entry } from '../types'

/** BMR pela equação de Mifflin-St Jeor. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'M' ? base + 5 : base - 161
}

export function tdee(sex: Sex, weightKg: number, heightCm: number, age: number, activity: number): number {
  return bmr(sex, weightKg, heightCm, age) * activity
}

const GOAL_FACTOR: Record<Goal, number> = { cut: 0.8, maintain: 1, bulk: 1.1 }
const PROTEIN_PER_KG: Record<Goal, number> = { cut: 2.2, maintain: 1.8, bulk: 2.0 }

/**
 * Alvos diários: calorias a partir do TDEE ajustado ao objetivo,
 * proteína por kg de peso, gordura a 25% das kcal, resto em hidratos.
 */
export function computeTargets(sex: Sex, weightKg: number, heightCm: number, age: number, activity: number, goal: Goal): Targets {
  const kcal = Math.round(tdee(sex, weightKg, heightCm, age, activity) * GOAL_FACTOR[goal])
  const protein = Math.round(PROTEIN_PER_KG[goal] * weightKg)
  const fat = Math.round((kcal * 0.25) / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { kcal, protein, carbs, fat }
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
  { value: 1.725, label: 'Ativo', hint: 'Exercício 6–7× por semana' },
  { value: 1.9, label: 'Muito ativo', hint: 'Treino intenso diário / trabalho físico' },
]

export const GOALS: { value: Goal; label: string; hint: string; emoji: string }[] = [
  { value: 'cut', label: 'Perder gordura', hint: 'Défice de ~20%', emoji: '🔥' },
  { value: 'maintain', label: 'Manter peso', hint: 'Calorias de manutenção', emoji: '⚖️' },
  { value: 'bulk', label: 'Ganhar músculo', hint: 'Excedente de ~10%', emoji: '💪' },
]
