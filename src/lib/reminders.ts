/** Lembretes push: configuração por tipo (hora local + ativo). */

import { api } from './api'
import { isNative } from './native'

export type ReminderKind =
  | 'water'
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'weigh_in'
  | 'expiry'
  | 'plan_lunch'
  | 'plan_dinner'

export interface Reminder {
  kind: ReminderKind
  hhmm: string // "HH:MM" hora local
  enabled: boolean
}

export const REMINDER_META: Record<ReminderKind, { label: string; emoji: string }> = {
  water: { label: 'Beber água', emoji: '💧' },
  breakfast: { label: 'Pequeno-almoço', emoji: '🌅' },
  lunch: { label: 'Almoço', emoji: '🍽️' },
  dinner: { label: 'Jantar', emoji: '🌙' },
  weigh_in: { label: 'Pesagem', emoji: '⚖️' },
  expiry: { label: 'Validades da despensa', emoji: '🕓' },
  plan_lunch: { label: 'Comeste o almoço planeado?', emoji: '🍽️' },
  plan_dinner: { label: 'Comeste o jantar planeado?', emoji: '🌙' },
}

/** No APK os lembretes tocam via notificações locais — reagenda a cada leitura/escrita. */
async function mirrorToDevice(reminders: Reminder[]): Promise<Reminder[]> {
  if (isNative) {
    const { syncNativeReminders } = await import('./nativeNotifications')
    await syncNativeReminders(reminders).catch(() => {})
  }
  return reminders
}

export async function listReminders(): Promise<Reminder[]> {
  return mirrorToDevice(await api<Reminder[]>('/reminders'))
}

export async function saveReminders(reminders: Reminder[]): Promise<Reminder[]> {
  return mirrorToDevice(await api<Reminder[]>('/reminders', { method: 'PUT', body: reminders }))
}
