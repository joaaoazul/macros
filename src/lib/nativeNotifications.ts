/** Lembretes no APK Android.
 *
 *  O Web Push do servidor precisa de um service worker, que não existe dentro
 *  do WebView do Capacitor. No nativo agendamos as mesmas horas como
 *  notificações locais (repetição diária), a partir das definições que o
 *  utilizador já guarda no servidor — sem depender de rede à hora do lembrete.
 */

import type { Reminder, ReminderKind } from './reminders'

/** IDs fixos: reagendar substitui em vez de duplicar. */
const IDS: Record<ReminderKind, number> = {
  water: 1001,
  breakfast: 1002,
  lunch: 1003,
  dinner: 1004,
  weigh_in: 1005,
  expiry: 1006,
  plan_lunch: 1007,
  plan_dinner: 1008,
}

/** Texto local — o servidor não está no circuito para personalizar. */
const TEXT: Record<ReminderKind, { title: string; body: string }> = {
  water: { title: '💧 Beber água', body: 'Já bebeste água? Toca para registar.' },
  breakfast: { title: '🌅 Pequeno-almoço', body: 'Regista o pequeno-almoço no diário.' },
  lunch: { title: '🍽️ Almoço', body: 'Regista o almoço no diário.' },
  dinner: { title: '🌙 Jantar', body: 'Regista o jantar no diário.' },
  weigh_in: { title: '⚖️ Pesagem', body: 'Hora de te pesares e registar o peso.' },
  expiry: { title: '🕓 Validades', body: 'Há itens na despensa perto da validade.' },
  plan_lunch: { title: '🍽️ Almoço planeado', body: 'Comeste o almoço que tinhas planeado?' },
  plan_dinner: { title: '🌙 Jantar planeado', body: 'Comeste o jantar que tinhas planeado?' },
}

function parseHHMM(hhmm: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}

export type NativeNotifPermission = 'granted' | 'denied' | 'prompt'

function normalise(display: string): NativeNotifPermission {
  if (display === 'granted') return 'granted'
  if (display === 'denied') return 'denied'
  return 'prompt'
}

export async function checkNativePermission(): Promise<NativeNotifPermission> {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const { display } = await LocalNotifications.checkPermissions()
  return normalise(display)
}

export async function requestNativePermission(): Promise<NativeNotifPermission> {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const { display } = await LocalNotifications.requestPermissions()
  return normalise(display)
}

/** Remove todos os lembretes que tenhamos agendado. */
export async function cancelNativeReminders(): Promise<void> {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const { notifications } = await LocalNotifications.getPending()
  const ours = notifications.filter((n) => Object.values(IDS).includes(n.id))
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
}

/**
 * Põe os lembretes agendados a espelhar `reminders`. Cancela sempre primeiro,
 * para que desligar um lembrete no servidor também o apague do dispositivo.
 */
export async function syncNativeReminders(reminders: Reminder[]): Promise<void> {
  if ((await checkNativePermission()) !== 'granted') return

  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await cancelNativeReminders()

  const toSchedule = reminders.flatMap((r) => {
    if (!r.enabled) return []
    const at = parseHHMM(r.hhmm)
    if (!at) return []
    const text = TEXT[r.kind]
    if (!text) return []
    return [
      {
        id: IDS[r.kind],
        title: text.title,
        body: text.body,
        // `on` sem dia = repete todos os dias àquela hora local
        schedule: { on: { hour: at.hour, minute: at.minute }, allowWhileIdle: true },
      },
    ]
  })

  if (toSchedule.length) await LocalNotifications.schedule({ notifications: toSchedule })
}
