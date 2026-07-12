/** Sincronização com o servidor: load-all no arranque, write-through por mutação
 *  com debounce, cache em localStorage e fila offline com retry no evento 'online'. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Diary, Entry, Exercise, ExerciseLog, Food, Profile, Recipe, WaterLog } from '../types'
import { api } from './api'

interface AllData {
  profile: Profile | null
  diary: Diary
  water: WaterLog
  exercise: ExerciseLog
  customFoods: Food[]
  recipes: Recipe[]
}

interface DayPatch {
  entries?: Entry[]
  waterMl?: number
  exercises?: Exercise[]
}

const KEYS = {
  profile: 'macros.profile',
  diary: 'macros.diary',
  water: 'macros.water',
  exercise: 'macros.exercise',
  customFoods: 'macros.customFoods',
  recipes: 'macros.recipes',
} as const

function readCache<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota cheia ou modo privado — cache é opcional
  }
}

/** Datas cujo valor mudou entre dois registos date-keyed. */
function changedDates<T>(prev: Record<string, T>, next: Record<string, T>): string[] {
  const dates = new Set([...Object.keys(prev), ...Object.keys(next)])
  return [...dates].filter((d) => prev[d] !== next[d])
}

export interface SyncedData {
  loading: boolean
  /** dados locais pré-conta detetados e servidor vazio — perguntar se importa */
  migrationAvailable: boolean
  importLocalData: () => Promise<void>
  dismissMigration: () => void
  profile: Profile | null
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>
  diary: Diary
  setDiary: React.Dispatch<React.SetStateAction<Diary>>
  water: WaterLog
  setWater: React.Dispatch<React.SetStateAction<WaterLog>>
  exercise: ExerciseLog
  setExercise: React.Dispatch<React.SetStateAction<ExerciseLog>>
  customFoods: Food[]
  setCustomFoods: React.Dispatch<React.SetStateAction<Food[]>>
  recipes: Recipe[]
  setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>
}

export function useSyncedData(userId: number): SyncedData {
  const [loading, setLoading] = useState(true)
  const [migrationAvailable, setMigrationAvailable] = useState(false)
  const [profile, rawSetProfile] = useState<Profile | null>(null)
  const [diary, rawSetDiary] = useState<Diary>({})
  const [water, rawSetWater] = useState<WaterLog>({})
  const [exercise, rawSetExercise] = useState<ExerciseLog>({})
  const [customFoods, rawSetCustomFoods] = useState<Food[]>([])
  const [recipes, rawSetRecipes] = useState<Recipe[]>([])

  // Filas de escrita pendentes (merged por dia) + flags para profile/foods/recipes
  const pendingDays = useRef<Map<string, DayPatch>>(new Map())
  const pendingProfile = useRef(false)
  const pendingFoods = useRef(false)
  const pendingRecipes = useRef(false)
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef({ profile, diary, water, exercise, customFoods, recipes })
  stateRef.current = { profile, diary, water, exercise, customFoods, recipes }

  const flush = useCallback(async () => {
    const { profile, diary, water, exercise, customFoods, recipes } = stateRef.current

    if (pendingProfile.current && profile) {
      pendingProfile.current = false
      try {
        await api('/profile', { method: 'PUT', body: profile })
      } catch {
        pendingProfile.current = true
      }
    }

    if (pendingFoods.current) {
      pendingFoods.current = false
      try {
        await api('/custom-foods', { method: 'PUT', body: customFoods })
      } catch {
        pendingFoods.current = true
      }
    }

    if (pendingRecipes.current) {
      pendingRecipes.current = false
      try {
        await api('/recipes', { method: 'PUT', body: recipes })
      } catch {
        pendingRecipes.current = true
      }
    }

    for (const [date, patch] of [...pendingDays.current]) {
      // envia sempre o estado ATUAL do dia (last-writer-wins, replay-safe)
      const body: DayPatch = {}
      if ('entries' in patch) body.entries = diary[date] ?? []
      if ('waterMl' in patch) body.waterMl = water[date] ?? 0
      if ('exercises' in patch) body.exercises = exercise[date] ?? []
      pendingDays.current.delete(date)
      try {
        await api(`/days/${date}`, { method: 'PUT', body })
      } catch {
        const existing = pendingDays.current.get(date) ?? {}
        pendingDays.current.set(date, { ...patch, ...existing })
      }
    }
  }, [])

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = setTimeout(() => void flush(), 800)
  }, [flush])

  // Retry quando a ligação volta
  useEffect(() => {
    const onOnline = () => void flush()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [flush])

  // Bootstrap: cache primeiro (arranque instantâneo), depois servidor (fonte de verdade)
  useEffect(() => {
    rawSetProfile(readCache<Profile | null>(KEYS.profile, null))
    rawSetDiary(readCache<Diary>(KEYS.diary, {}))
    rawSetWater(readCache<WaterLog>(KEYS.water, {}))
    rawSetExercise(readCache<ExerciseLog>(KEYS.exercise, {}))
    rawSetCustomFoods(readCache<Food[]>(KEYS.customFoods, []))
    rawSetRecipes(readCache<Recipe[]>(KEYS.recipes, []))

    let cancelled = false
    api<AllData>('/data/all')
      .then((data) => {
        if (cancelled) return
        const localProfile = readCache<Profile | null>(KEYS.profile, null)
        const serverEmpty = data.profile === null && Object.keys(data.diary).length === 0
        if (serverEmpty && localProfile) {
          // dados locais de antes da conta — manter no ecrã e perguntar se importa
          setMigrationAvailable(true)
        } else {
          rawSetProfile(data.profile)
          rawSetDiary(data.diary)
          rawSetWater(data.water)
          rawSetExercise(data.exercise)
          rawSetCustomFoods(data.customFoods)
          rawSetRecipes(data.recipes ?? [])
          writeCache(KEYS.profile, data.profile)
          writeCache(KEYS.diary, data.diary)
          writeCache(KEYS.water, data.water)
          writeCache(KEYS.exercise, data.exercise)
          writeCache(KEYS.customFoods, data.customFoods)
          writeCache(KEYS.recipes, data.recipes ?? [])
        }
      })
      .catch(() => {
        // offline ou erro — a cache já está no ecrã; as escritas ficam em fila
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const importLocalData = useCallback(async () => {
    const snapshot = {
      profile: readCache<Profile | null>(KEYS.profile, null),
      diary: readCache<Diary>(KEYS.diary, {}),
      water: readCache<WaterLog>(KEYS.water, {}),
      exercise: readCache<ExerciseLog>(KEYS.exercise, {}),
      customFoods: readCache<Food[]>(KEYS.customFoods, []),
      recipes: readCache<Recipe[]>(KEYS.recipes, []),
    }
    const data = await api<AllData>('/data/import', { method: 'POST', body: snapshot })
    rawSetProfile(data.profile)
    rawSetDiary(data.diary)
    rawSetWater(data.water)
    rawSetExercise(data.exercise)
    rawSetCustomFoods(data.customFoods)
    rawSetRecipes(data.recipes ?? [])
    setMigrationAvailable(false)
  }, [])

  const dismissMigration = useCallback(() => {
    // utilizador recusou importar — começa do zero na conta
    for (const key of Object.values(KEYS)) localStorage.removeItem(key)
    rawSetProfile(null)
    rawSetDiary({})
    rawSetWater({})
    rawSetExercise({})
    rawSetCustomFoods([])
    rawSetRecipes([])
    setMigrationAvailable(false)
  }, [])

  // Setters com write-through
  const setProfile: React.Dispatch<React.SetStateAction<Profile | null>> = useCallback(
    (action) => {
      rawSetProfile((prev) => {
        const next = typeof action === 'function' ? action(prev) : action
        writeCache(KEYS.profile, next)
        if (next !== null) {
          pendingProfile.current = true
          scheduleFlush()
        }
        return next
      })
    },
    [scheduleFlush],
  )

  const setDiary: React.Dispatch<React.SetStateAction<Diary>> = useCallback(
    (action) => {
      rawSetDiary((prev) => {
        const next = typeof action === 'function' ? action(prev) : action
        writeCache(KEYS.diary, next)
        for (const date of changedDates(prev, next)) {
          const patch = pendingDays.current.get(date) ?? {}
          pendingDays.current.set(date, { ...patch, entries: [] })
        }
        scheduleFlush()
        return next
      })
    },
    [scheduleFlush],
  )

  const setWater: React.Dispatch<React.SetStateAction<WaterLog>> = useCallback(
    (action) => {
      rawSetWater((prev) => {
        const next = typeof action === 'function' ? action(prev) : action
        writeCache(KEYS.water, next)
        for (const date of changedDates(prev, next)) {
          const patch = pendingDays.current.get(date) ?? {}
          pendingDays.current.set(date, { ...patch, waterMl: 0 })
        }
        scheduleFlush()
        return next
      })
    },
    [scheduleFlush],
  )

  const setExercise: React.Dispatch<React.SetStateAction<ExerciseLog>> = useCallback(
    (action) => {
      rawSetExercise((prev) => {
        const next = typeof action === 'function' ? action(prev) : action
        writeCache(KEYS.exercise, next)
        for (const date of changedDates(prev, next)) {
          const patch = pendingDays.current.get(date) ?? {}
          pendingDays.current.set(date, { ...patch, exercises: [] })
        }
        scheduleFlush()
        return next
      })
    },
    [scheduleFlush],
  )

  const setCustomFoods: React.Dispatch<React.SetStateAction<Food[]>> = useCallback(
    (action) => {
      rawSetCustomFoods((prev) => {
        const next = typeof action === 'function' ? action(prev) : action
        writeCache(KEYS.customFoods, next)
        pendingFoods.current = true
        scheduleFlush()
        return next
      })
    },
    [scheduleFlush],
  )

  const setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>> = useCallback(
    (action) => {
      rawSetRecipes((prev) => {
        const next = typeof action === 'function' ? action(prev) : action
        writeCache(KEYS.recipes, next)
        pendingRecipes.current = true
        scheduleFlush()
        return next
      })
    },
    [scheduleFlush],
  )

  return useMemo(
    () => ({
      loading,
      migrationAvailable,
      importLocalData,
      dismissMigration,
      profile,
      setProfile,
      diary,
      setDiary,
      water,
      setWater,
      exercise,
      setExercise,
      customFoods,
      setCustomFoods,
      recipes,
      setRecipes,
    }),
    [
      loading, migrationAvailable, importLocalData, dismissMigration,
      profile, setProfile, diary, setDiary, water, setWater,
      exercise, setExercise, customFoods, setCustomFoods, recipes, setRecipes,
    ],
  )
}

/** Limpa a cache local (logout / eliminação de conta). */
export function clearLocalCache() {
  for (const key of Object.values(KEYS)) localStorage.removeItem(key)
}
