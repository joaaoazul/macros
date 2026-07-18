/** WebSocket social: ligação única, reconexão com backoff, refresh no 4401. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { refreshSession } from './api'
import type { AppNotification } from './notifications'
import type { Message } from './social'

export type ServerEvent =
  | { type: 'message'; message: Message; clientId?: string }
  | { type: 'read'; conversationId: number; by: number; upToId: number }
  | { type: 'unread'; total: number }
  | {
      type: 'reaction'
      conversationId: number
      messageId: number
      userId: number
      emoji: string | null
    }
  | { type: 'conversation'; conversationId: number }
  | { type: 'typing'; conversationId: number; userId: number }
  | { type: 'notification'; notification: AppNotification }
  | { type: 'notif_unread'; total: number }
  | { type: 'error'; code: string; clientId?: string }
  | { type: 'pong' }

type ClientEvent =
  | {
      type: 'send'
      conversationId?: number
      to?: number
      body?: string
      share?: import('./social').Share | null
      clientId: string
    }
  | { type: 'read'; conversationId?: number; from?: number }
  | { type: 'typing'; conversationId: number }
  | { type: 'ping' }

export interface SocialSocket {
  /** envia se ligado; devolve false se o socket estiver em baixo (usar fallback REST) */
  send: (ev: ClientEvent) => boolean
  subscribe: (fn: (ev: ServerEvent) => void) => () => void
  connected: boolean
  /** total de mensagens por ler (badge) */
  unread: number
  setUnread: React.Dispatch<React.SetStateAction<number>>
  /** total de notificações por ler (badge do sino) */
  notifUnread: number
  setNotifUnread: React.Dispatch<React.SetStateAction<number>>
}

const PING_INTERVAL = 30_000
const PONG_TIMEOUT = 10_000
const MAX_BACKOFF = 30_000

export function useSocialSocket(enabled: boolean): SocialSocket {
  const [connected, setConnected] = useState(false)
  const [unread, setUnread] = useState(0)
  const [notifUnread, setNotifUnread] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const subscribers = useRef<Set<(ev: ServerEvent) => void>>(new Set())
  const backoff = useRef(1000)
  const timers = useRef<{ ping?: number; pong?: number; reconnect?: number }>({})
  const closedByUs = useRef(false)

  const clearTimers = () => {
    const t = timers.current
    if (t.ping) window.clearInterval(t.ping)
    if (t.pong) window.clearTimeout(t.pong)
    if (t.reconnect) window.clearTimeout(t.reconnect)
    timers.current = {}
  }

  const connect = useCallback(function connectFn() {
    if (!enabled || wsRef.current) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/api/v1/ws`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      backoff.current = 1000
      timers.current.ping = window.setInterval(() => {
        try {
          ws.send(JSON.stringify({ type: 'ping' }))
          timers.current.pong = window.setTimeout(() => ws.close(), PONG_TIMEOUT)
        } catch {
          ws.close()
        }
      }, PING_INTERVAL)
    }

    ws.onmessage = (raw) => {
      let ev: ServerEvent
      try {
        ev = JSON.parse(raw.data as string)
      } catch {
        return
      }
      if (ev.type === 'pong') {
        if (timers.current.pong) window.clearTimeout(timers.current.pong)
        return
      }
      if (ev.type === 'unread') setUnread(ev.total)
      if (ev.type === 'notif_unread') setNotifUnread(ev.total)
      if (ev.type === 'notification') setNotifUnread((n) => n + 1)
      for (const fn of subscribers.current) fn(ev)
    }

    ws.onclose = async (e) => {
      wsRef.current = null
      setConnected(false)
      clearTimers()
      if (closedByUs.current || !enabled) return

      if (e.code === 4401) {
        // sessão expirada — refresh e reconecta já
        const ok = await refreshSession()
        if (ok) {
          connectFn()
          return
        }
      }
      if (document.visibilityState === 'hidden') return // reconecta no visibilitychange
      const delay = backoff.current * (0.8 + Math.random() * 0.4) // jitter
      backoff.current = Math.min(backoff.current * 2, MAX_BACKOFF)
      timers.current.reconnect = window.setTimeout(connectFn, delay)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    closedByUs.current = false
    connect()

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !wsRef.current) {
        backoff.current = 1000
        connect()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      closedByUs.current = true
      clearTimers()
      wsRef.current?.close(1000)
      wsRef.current = null
    }
  }, [enabled, connect])

  const send = useCallback((ev: ClientEvent): boolean => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    try {
      ws.send(JSON.stringify(ev))
      return true
    } catch {
      return false
    }
  }, [])

  const subscribe = useCallback((fn: (ev: ServerEvent) => void) => {
    subscribers.current.add(fn)
    return () => {
      subscribers.current.delete(fn)
    }
  }, [])

  return { send, subscribe, connected, unread, setUnread, notifUnread, setNotifUnread }
}
