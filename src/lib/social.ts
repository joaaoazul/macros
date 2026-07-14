/** Tipos e chamadas da API social + mensagens. */

import { api } from './api'

export interface DerivedStats {
  streak: number
  daysOnPlan7d: number
}

export interface PublicProfileLite {
  userId: number
  username: string
  avatar: string
  avatarPhoto?: string | null
  bio?: string | null
  name: string
}

export type FriendshipStatus = 'none' | 'friends' | 'incoming' | 'outgoing' | 'self'

export interface PublicProfile extends PublicProfileLite {
  stats: DerivedStats
  friendship: FriendshipStatus
  friendshipId: number | null
  badges: string[]
}

export interface SocialMe {
  userId: number
  username: string | null
  avatar: string
  avatarPhoto?: string | null
  bio?: string | null
  name: string
  badges: string[]
}

/** Reações permitidas no feed (kudos) — espelha o backend. */
export const FEED_REACTIONS = ['👏', '🔥', '💪', '🎉', '❤️'] as const

export interface ReactionSummary {
  counts: Record<string, number>
  total: number
  mine: string | null
}

export type NudgeKind = 'train' | 'water' | 'log' | 'cheer'

export const NUDGES: { kind: NudgeKind; emoji: string; label: string }[] = [
  { kind: 'train', emoji: '💪', label: 'Bora treinar' },
  { kind: 'water', emoji: '💧', label: 'Bebe água' },
  { kind: 'log', emoji: '📓', label: 'Regista as refeições' },
  { kind: 'cheer', emoji: '🎉', label: 'Estás a arrasar' },
]

/** Catálogo de conquistas — espelha BADGES do backend. */
export const BADGES: Record<string, { emoji: string; title: string; description: string }> = {
  streak_7: { emoji: '🔥', title: 'Uma semana a fogo', description: '7 dias seguidos no plano' },
  streak_14: { emoji: '⚡', title: 'Duas semanas imparável', description: '14 dias seguidos no plano' },
  streak_30: { emoji: '🏆', title: 'Um mês de disciplina', description: '30 dias seguidos no plano' },
  plan_master: { emoji: '🎯', title: 'Semana perfeita', description: '7 de 7 dias no plano numa semana' },
  centurion: { emoji: '💯', title: 'Centurião', description: '100 dias no plano no total' },
}

export interface ProfileUpdate {
  username: string
  avatar: string
  avatarPhoto?: string | null
  bio?: string | null
}

export interface SearchResult extends PublicProfileLite {
  friendship: Exclude<FriendshipStatus, 'self'>
}

export interface FriendshipOut {
  id: number
  user: PublicProfileLite
  status: 'pending' | 'accepted'
  direction?: 'incoming' | 'outgoing'
}

export interface FriendsList {
  friends: FriendshipOut[]
  incoming: FriendshipOut[]
  outgoing: FriendshipOut[]
}

export interface LeaderboardRow {
  userId: number
  username: string
  avatar: string
  daysOnPlan: number
  bonus: number
  rank: number
  isMe: boolean
}

export interface LeaderboardOut {
  week: { start: string; end: string }
  rows: LeaderboardRow[]
}

export interface FeedEvent {
  id: number
  kind: 'day_on_plan' | 'streak' | 'rank_up' | 'friend_joined' | string
  refDate: string
  payload: Record<string, unknown>
  user: PublicProfileLite
  createdAt: string
  reactions: ReactionSummary
}

export interface MessageReaction {
  userId: number
  emoji: string
}

export interface Message {
  id: number
  senderId: number
  recipientId: number
  body: string
  image?: string | null
  createdAt: string
  readAt: string | null
  reactions: MessageReaction[]
}

export interface Conversation {
  user: PublicProfileLite
  lastMessage: Message | null
  unread: number
}

export const social = {
  me: () => api<SocialMe>('/social/me'),
  updateMe: (data: ProfileUpdate) => api<SocialMe>('/social/me', { method: 'PUT', body: data }),
  search: (q: string) => api<SearchResult[]>(`/social/search?q=${encodeURIComponent(q)}`),
  profile: (username: string) => api<PublicProfile>(`/social/users/${encodeURIComponent(username)}`),
  sendRequest: (username: string) =>
    api<FriendshipOut>('/social/friends/requests', { method: 'POST', body: { username } }),
  accept: (id: number) => api<FriendshipOut>(`/social/friends/requests/${id}/accept`, { method: 'POST' }),
  declineOrCancel: (id: number) => api<void>(`/social/friends/requests/${id}`, { method: 'DELETE' }),
  friends: () => api<FriendsList>('/social/friends'),
  removeFriend: (userId: number) => api<void>(`/social/friends/${userId}`, { method: 'DELETE' }),
  leaderboard: () => api<LeaderboardOut>('/social/leaderboard'),
  feed: (before?: number) =>
    api<FeedEvent[]>(`/social/feed?limit=30${before ? `&before=${before}` : ''}`),
  react: (eventId: number, emoji: string) =>
    api<ReactionSummary>(`/social/feed/${eventId}/react`, { method: 'PUT', body: { emoji } }),
  unreact: (eventId: number) =>
    api<ReactionSummary>(`/social/feed/${eventId}/react`, { method: 'DELETE' }),
  nudge: (userId: number, kind: NudgeKind) =>
    api<{ ok: boolean }>('/social/nudge', { method: 'POST', body: { userId, kind } }),
}

export const messages = {
  conversations: () => api<Conversation[]>('/messages/conversations'),
  unreadCount: () => api<{ total: number }>('/messages/unread-count'),
  history: (userId: number, before?: number) =>
    api<Message[]>(`/messages/with/${userId}?limit=50${before ? `&before=${before}` : ''}`),
  send: (userId: number, body: string, image?: string | null) =>
    api<Message>(`/messages/with/${userId}`, { method: 'POST', body: { body, image } }),
  markRead: (userId: number) => api<void>(`/messages/with/${userId}/read`, { method: 'POST' }),
  react: (messageId: number, emoji: string) =>
    api<void>(`/messages/${messageId}/react`, { method: 'PUT', body: { emoji } }),
  unreact: (messageId: number) =>
    api<void>(`/messages/${messageId}/react`, { method: 'DELETE' }),
}

/** Reações permitidas em mensagens (tapback iOS) — espelha o backend. */
export const MESSAGE_REACTIONS = ['❤️', '👍', '😂', '🔥', '😮', '😢'] as const
