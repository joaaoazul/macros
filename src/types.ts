export type Sex = 'M' | 'F'
export type Goal = 'cut' | 'maintain' | 'bulk'
export type MealId = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'supper'

export interface Targets {
  kcal: number
  protein: number
  carbs: number
  fat: number
  waterMl: number
}

export interface Profile {
  name: string
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activity: number
  goal: Goal
  targets: Targets
}

/** Valores nutricionais por 100 g / 100 ml. */
export interface Food {
  id: string
  name: string
  emoji: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  unit: 'g' | 'ml'
  custom?: boolean
  brand?: string
}

export interface Entry {
  id: string
  meal: MealId
  foodName: string
  emoji: string
  grams: number
  unit: 'g' | 'ml'
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface Exercise {
  id: string
  name: string
  kcal: number
}

/** Diário: chave é a data em ISO (YYYY-MM-DD). */
export type Diary = Record<string, Entry[]>
export type WaterLog = Record<string, number>
export type WeightLog = Record<string, number>
export type ExerciseLog = Record<string, Exercise[]>

export const MEALS: { id: MealId; label: string; emoji: string }[] = [
  { id: 'breakfast', label: 'Pequeno-almoço', emoji: '🌅' },
  { id: 'lunch', label: 'Almoço', emoji: '🍽️' },
  { id: 'snack', label: 'Lanche', emoji: '🥪' },
  { id: 'dinner', label: 'Jantar', emoji: '🌙' },
  { id: 'supper', label: 'Ceia', emoji: '🌃' },
]
