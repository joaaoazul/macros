/** Centro de notificações in-app + preferências de push por categoria. */

import { api } from './api'

export interface AppNotification {
  id: number
  kind: string
  title: string
  body: string
  url: string
  actorId: number | null
  read: boolean
  createdAt: string
}

export interface NotificationPrefs {
  messages: boolean
  friends: boolean
  social: boolean
}

export const PREF_META: { key: keyof NotificationPrefs; emoji: string; label: string; hint: string }[] = [
  { key: 'messages', emoji: '💬', label: 'Mensagens', hint: 'Novas mensagens de amigos' },
  { key: 'friends', emoji: '🤝', label: 'Amizades', hint: 'Pedidos e amizades aceites' },
  { key: 'social', emoji: '✨', label: 'Social', hint: 'Reações, toques e conquistas' },
]

/** Emoji para o ícone de cada tipo de notificação. */
export function notificationEmoji(kind: string): string {
  switch (kind) {
    case 'friend_request':
    case 'friend_accepted':
      return '🤝'
    case 'reaction':
      return '👏'
    case 'nudge':
      return '👋'
    case 'badge':
      return '🏅'
    case 'message_reaction':
      return '💬'
    case 'test':
      return '🔔'
    default:
      return '🔔'
  }
}

export const notifications = {
  list: (before?: number) =>
    api<AppNotification[]>(`/notifications?limit=30${before ? `&before=${before}` : ''}`),
  unreadCount: () => api<{ total: number }>('/notifications/unread-count'),
  read: (upToId?: number) =>
    api<void>('/notifications/read', { method: 'POST', body: { upToId: upToId ?? null } }),
  prefs: () => api<NotificationPrefs>('/notifications/prefs'),
  savePrefs: (prefs: NotificationPrefs) =>
    api<NotificationPrefs>('/notifications/prefs', { method: 'PUT', body: prefs }),
  test: () => api<{ pushConfigured: boolean; pushed: boolean }>('/notifications/test', { method: 'POST' }),
}
