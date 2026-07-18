import { useEffect, useState } from 'react'

/** Estado persistido em localStorage (leitura preguiçosa + escrita a cada alteração). */
export function usePersistedState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw !== null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // quota cheia ou modo privado — a app continua a funcionar em memória
    }
  }, [key, value])

  return [value, setValue]
}

export function todayISO(): string {
  return toISO(new Date())
}

/** A refeição provável para a hora actual — para atalhos e partilhas, onde o
 * utilizador não escolheu refeição nenhuma. */
export function mealForNow(now = new Date()): 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'supper' {
  const h = now.getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 19) return 'snack'
  if (h < 23) return 'dinner'
  return 'supper'
}

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return toISO(date)
}

export function formatDatePT(iso: string): string {
  const today = todayISO()
  if (iso === today) return 'Hoje'
  if (iso === shiftDate(today, -1)) return 'Ontem'
  if (iso === shiftDate(today, 1)) return 'Amanhã'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

/** Vibração tátil curta (no-op onde não é suportado). */
export function haptic(ms = 15): void {
  navigator.vibrate?.(ms)
}
