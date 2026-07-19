/** Centro de notificações in-app: histórico + tempo real via WS. */

import { useEffect, useRef, useState } from 'react'
import { notifications as api, notificationEmoji, type AppNotification } from '../../lib/notifications'
import type { SocialSocket } from '../../lib/ws'
import { ListSkeleton } from '../ui'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return d < 7 ? `há ${d} d` : new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

export default function NotificationCenter({ socket, onBack }: { socket: SocialSocket; onBack: () => void }) {
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const seen = useRef(false)

  useEffect(() => {
    api
      .list()
      .then((list) => {
        setItems(list)
        setHasMore(list.length >= 30)
      })
      .catch(() => setItems([]))
    // abrir o centro marca tudo como lido
    api.read().catch(() => {})
    socket.setNotifUnread(0)
  }, [socket])

  // novas notificações em tempo real
  useEffect(() => {
    return socket.subscribe((ev) => {
      if (ev.type === 'notification') {
        setItems((cur) => (cur ? [{ ...ev.notification, read: true }, ...cur] : cur))
        if (!seen.current) api.read().catch(() => {})
      }
    })
  }, [socket])

  const loadMore = async () => {
    if (!items?.length) return
    const older = await api.list(items[items.length - 1].id)
    setItems([...items, ...older])
    setHasMore(older.length >= 30)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-line/70 bg-surface/80 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <button onClick={onBack} aria-label="Voltar" className="press text-accent">
          ‹ <span className="text-sm font-medium">Voltar</span>
        </button>
        <div className="font-semibold">Notificações</div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 space-y-2 overflow-y-auto px-4 py-3 scroll-contain">
        {items === null && <ListSkeleton rows={4} />}
        {items?.length === 0 && (
          <div className="animate-in py-16 text-center">
            <div className="text-4xl" aria-hidden>🔔</div>
            <p className="mt-3 font-semibold">Tudo em dia</p>
            <p className="mt-1 text-sm text-ink-2">As tuas notificações aparecem aqui.</p>
          </div>
        )}
        {items?.map((n, i) => (
          <div
            key={n.id}
            className="animate-in flex items-start gap-3 rounded-card bg-surface p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-lg" aria-hidden>
              {notificationEmoji(n.kind)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-semibold">{n.title}</p>
                <span className="shrink-0 text-[11px] text-muted">{timeAgo(n.createdAt)}</span>
              </div>
              {n.body && <p className="mt-0.5 text-sm text-ink-2">{n.body}</p>}
            </div>
          </div>
        ))}
        {hasMore && (
          <button onClick={loadMore} className="w-full py-3 text-sm font-medium text-accent">
            Ver mais
          </button>
        )}
      </div>
    </div>
  )
}
