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
}

export interface SocialMe {
  userId: number
  username: string | null
  avatar: string
  avatarPhoto?: string | null
  bio?: string | null
  name: string
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
}

export interface Message {
  id: number
  senderId: number
  recipientId: number
  body: string
  createdAt: string
  readAt: string | null
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
}

export const messages = {
  conversations: () => api<Conversation[]>('/messages/conversations'),
  unreadCount: () => api<{ total: number }>('/messages/unread-count'),
  history: (userId: number, before?: number) =>
    api<Message[]>(`/messages/with/${userId}?limit=50${before ? `&before=${before}` : ''}`),
  send: (userId: number, body: string) =>
    api<Message>(`/messages/with/${userId}`, { method: 'POST', body: { body } }),
  markRead: (userId: number) => api<void>(`/messages/with/${userId}/read`, { method: 'POST' }),
}
