/** Lembretes push: configuração por tipo (hora local + ativo). */

import { api } from './api'

export type ReminderKind = 'water' | 'breakfast' | 'lunch' | 'dinner' | 'weigh_in'

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
}

export function listReminders(): Promise<Reminder[]> {
  return api<Reminder[]>('/reminders')
}

export function saveReminders(reminders: Reminder[]): Promise<Reminder[]> {
  return api<Reminder[]>('/reminders', { method: 'PUT', body: reminders })
}
