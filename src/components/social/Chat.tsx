/** Conversa 1-para-1: tempo real via WS com envio otimista e fallback REST. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { messages as messagesApi, type Message, type PublicProfileLite } from '../../lib/social'
import { uid } from '../../lib/store'
import type { SocialSocket } from '../../lib/ws'
import Avatar from './Avatar'

interface Pending {
  clientId: string
  body: string
}

interface Props {
  me: number
  other: PublicProfileLite
  socket: SocialSocket
  onBack: () => void
}

export default function Chat({ me, other, socket, onBack }: Props) {
  const [history, setHistory] = useState<Message[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollDown = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // histórico + marcar lido
  useEffect(() => {
    messagesApi
      .history(other.userId)
      .then((msgs) => {
        setHistory(msgs.reverse()) // API é newest-first; UI é oldest-first
        setLoaded(true)
        void messagesApi.markRead(other.userId)
        socket.setUnread((u) => Math.max(0, u))
        setTimeout(() => scrollDown(false), 0)
      })
      .catch(() => setLoaded(true))
  }, [other.userId, scrollDown, socket])

  // eventos em tempo real
  useEffect(() => {
    return socket.subscribe((ev) => {
      if (ev.type === 'message') {
        const m = ev.message
        const isThisChat = m.senderId === other.userId || (m.senderId === me && m.recipientId === other.userId)
        if (!isThisChat) return
        setHistory((h) => (h.some((x) => x.id === m.id) ? h : [...h, m]))
        if (ev.clientId) setPending((p) => p.filter((x) => x.clientId !== ev.clientId))
        if (m.senderId === other.userId) {
          void messagesApi.markRead(other.userId)
          socket.send({ type: 'read', from: other.userId })
        }
        setTimeout(() => scrollDown(), 0)
      } else if (ev.type === 'read' && ev.by === other.userId) {
        setHistory((h) =>
          h.map((m) => (m.senderId === me && m.id <= ev.upToId && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m)),
        )
      } else if (ev.type === 'error' && ev.clientId) {
        setPending((p) => p.filter((x) => x.clientId !== ev.clientId))
        setError(
          ev.code === 'not_friends'
            ? 'Já não são amigos — não podes enviar mensagens.'
            : ev.code === 'rate_limited'
              ? 'Demasiadas mensagens. Aguarda um pouco.'
              : 'Não foi possível enviar a mensagem.',
        )
      }
    })
  }, [socket, me, other.userId, scrollDown])

  const send = async () => {
    const body = draft.trim()
    if (!body) return
    setDraft('')
    setError('')
    const clientId = uid()

    if (socket.send({ type: 'send', to: other.userId, body, clientId })) {
      setPending((p) => [...p, { clientId, body }])
      setTimeout(() => scrollDown(), 0)
      return
    }
    // socket em baixo → REST
    try {
      const m = await messagesApi.send(other.userId, body)
      setHistory((h) => [...h, m])
      setTimeout(() => scrollDown(), 0)
    } catch {
      setError('Sem ligação. A mensagem não foi enviada.')
      setDraft(body)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-line/70 bg-surface/80 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <button onClick={onBack} aria-label="Voltar" className="text-accent">
          ‹ <span className="text-sm font-medium">Voltar</span>
        </button>
        <Avatar avatar={other.avatar} avatarPhoto={other.avatarPhoto} size={36} />
        <div className="min-w-0">
          <div className="truncate font-semibold leading-tight">@{other.username}</div>
          {!socket.connected && <div className="text-[11px] text-muted">a reconectar…</div>}
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 space-y-1.5 overflow-y-auto px-4 py-3">
        {!loaded && <p className="py-8 text-center text-sm text-muted">A carregar…</p>}
        {loaded && history.length === 0 && pending.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">Diz olá a @{other.username} 👋</p>
        )}
        {history.map((m) => (
          <Bubble key={m.id} mine={m.senderId === me} body={m.body} read={!!m.readAt} />
        ))}
        {pending.map((p) => (
          <Bubble key={p.clientId} mine body={p.body} pending />
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p role="alert" className="mx-auto w-full max-w-md px-4 pb-1 text-xs font-medium text-critical">
          {error}
        </p>
      )}

      <div className="border-t border-line/70 bg-surface/80 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder="Mensagem…"
            rows={1}
            maxLength={2000}
            className="max-h-28 min-h-[2.75rem] flex-1 resize-none rounded-3xl bg-bg px-4 py-2.5 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label={`Mensagem para @${other.username}`}
          />
          <button
            onClick={() => void send()}
            disabled={!draft.trim()}
            aria-label="Enviar"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white transition-opacity active:opacity-80 disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M3.4 20.4L20.85 12 3.4 3.6l-.01 6.53L14 12 3.39 13.87z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function Bubble({ mine, body, read, pending }: { mine: boolean; body: string; read?: boolean; pending?: boolean }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2 text-[15px] leading-snug ${
          mine ? `bg-accent text-white ${pending ? 'opacity-60' : ''}` : 'bg-surface'
        }`}
      >
        {body}
        {mine && !pending && (
          <span className={`ml-1.5 text-[10px] ${read ? 'opacity-90' : 'opacity-50'}`} aria-label={read ? 'Lida' : 'Enviada'}>
            {read ? '✓✓' : '✓'}
          </span>
        )}
      </div>
    </div>
  )
}
