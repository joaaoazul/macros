/** Cliente da API do SOC admin + feed SSE de eventos de auditoria. */

import { api } from './api'

export interface DailyPoint {
  date: string
  success: number
  failed: number
  registrations: number
}
export interface TopIp {
  ip: string
  failed: number
  lastSeen: string | null
}
export interface SecuritySummary {
  failedLogins24h: number
  failedLogins7d: number
  lockouts7d: number
  firstSeenIps7d: number
  activeSessionsApprox: number
  pushSubscriptions: number
  blockedIps: number
  daily: DailyPoint[]
  topFailingIps: TopIp[]
}

export interface AuditRow {
  id: number
  userId: number | null
  action: string
  severity: 'info' | 'warning' | 'critical' | string
  detail: string
  ip: string
  userAgent: string
  createdAt: string
}
export interface AuditPage {
  rows: AuditRow[]
  total: number
}

export interface AdminUserRow {
  id: number
  email: string
  username: string | null
  name: string
  isAdmin: boolean
  isActive: boolean
  emailVerified: boolean
  failedLoginAttempts: number
  lockedUntil: string | null
  createdAt: string
}

export interface IpInfo {
  ip: string
  events: number
  failed: number
  firstSeen: string | null
  lastSeen: string | null
  anomaly: boolean
  blocked: boolean
  geo: string | null
}

export interface BlocklistRow {
  id: number
  ip: string
  reason: string
  createdAt: string
}

export interface LiveEvent {
  action: string
  severity: string
  user_id: number | null
  ip: string
  detail: string
}

export const admin = {
  me: () => api<{ userId: number; email: string; isAdmin: boolean }>('/admin/me'),
  summary: () => api<SecuritySummary>('/admin/security-summary'),
  audit: (params: Record<string, string | number | undefined>) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&')
    return api<AuditPage>(`/admin/audit${qs ? `?${qs}` : ''}`)
  },
  users: (q?: string) => api<AdminUserRow[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  forceLogout: (id: number) => api<AdminUserRow>(`/admin/users/${id}/force-logout`, { method: 'POST' }),
  disableUser: (id: number) => api<AdminUserRow>(`/admin/users/${id}/disable`, { method: 'POST' }),
  enableUser: (id: number) => api<AdminUserRow>(`/admin/users/${id}/enable`, { method: 'POST' }),
  ips: () => api<IpInfo[]>('/admin/ips'),
  blocklist: () => api<BlocklistRow[]>('/admin/blocklist'),
  blockIp: (ip: string, reason: string) =>
    api<BlocklistRow>('/admin/blocklist', { method: 'POST', body: { ip, reason } }),
  unblockIp: (ip: string) => api<void>(`/admin/blocklist/${encodeURIComponent(ip)}`, { method: 'DELETE' }),
}

/** Abre o feed SSE. Devolve uma função de cleanup. */
export function subscribeLiveFeed(onEvent: (e: LiveEvent) => void): () => void {
  const es = new EventSource('/api/v1/admin/audit/stream', { withCredentials: true })
  es.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as LiveEvent)
    } catch {
      // ignora linhas keepalive
    }
  }
  return () => es.close()
}
