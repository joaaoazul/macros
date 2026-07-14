/** Conversa 1-para-1: tempo real via WS com envio otimista, reações e fotos. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { downscaleImage } from '../../lib/ai'
import {
  messages as messagesApi,
  MESSAGE_REACTIONS,
  type Message,
  type PublicProfileLite,
} from '../../lib/social'
import { haptic, uid } from '../../lib/store'
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
  const [sendingPhoto, setSendingPhoto] = useState(false)
  const [pickerFor, setPickerFor] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)

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
      } else if (ev.type === 'reaction') {
        setHistory((h) =>
          h.map((m) => {
            if (m.id !== ev.messageId) return m
            const others = m.reactions.filter((r) => r.userId !== ev.userId)
            return { ...m, reactions: ev.emoji ? [...others, { userId: ev.userId, emoji: ev.emoji }] : others }
          }),
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

  const sendPhoto = async (file: File) => {
    setError('')
    setSendingPhoto(true)
    haptic(20)
    try {
      const image = await downscaleImage(file, 1024)
      const m = await messagesApi.send(other.userId, '', image)
      setHistory((h) => [...h, m])
      setTimeout(() => scrollDown(), 0)
    } catch {
      setError('Não foi possível enviar a foto.')
    } finally {
      setSendingPhoto(false)
      if (cameraInput.current) cameraInput.current.value = ''
      if (galleryInput.current) galleryInput.current.value = ''
    }
  }

  const react = async (message: Message, emoji: string) => {
    haptic(15)
    setPickerFor(null)
    const mineNow = message.reactions.find((r) => r.userId === me)?.emoji
    const remove = mineNow === emoji
    // otimista
    setHistory((h) =>
      h.map((m) => {
        if (m.id !== message.id) return m
        const others = m.reactions.filter((r) => r.userId !== me)
        return { ...m, reactions: remove ? others : [...others, { userId: me, emoji }] }
      }),
    )
    try {
      if (remove) await messagesApi.unreact(message.id)
      else await messagesApi.react(message.id, emoji)
    } catch {
      // reverte no próximo carregamento do histórico
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-line/70 bg-surface/80 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <button onClick={onBack} aria-label="Voltar" className="press text-accent">
          ‹ <span className="text-sm font-medium">Voltar</span>
        </button>
        <Avatar avatar={other.avatar} avatarPhoto={other.avatarPhoto} size={36} />
        <div className="min-w-0">
          <div className="truncate font-semibold leading-tight">@{other.username}</div>
          {!socket.connected && <div className="text-[11px] text-muted">a reconectar…</div>}
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 space-y-1.5 overflow-y-auto px-4 py-3 scroll-contain" onClick={() => setPickerFor(null)}>
        {!loaded && <p className="py-8 text-center text-sm text-muted">A carregar…</p>}
        {loaded && history.length === 0 && pending.length === 0 && (
          <p className="animate-in py-8 text-center text-sm text-muted">Diz olá a @{other.username} 👋</p>
        )}
        {history.map((m) => (
          <Bubble
            key={m.id}
            message={m}
            mine={m.senderId === me}
            myId={me}
            picking={pickerFor === m.id}
            onOpenPicker={() => { haptic(10); setPickerFor((cur) => (cur === m.id ? null : m.id)) }}
            onReact={(emoji) => react(m, emoji)}
            onOpenImage={setLightbox}
          />
        ))}
        {pending.map((p) => (
          <PendingBubble key={p.clientId} body={p.body} />
        ))}
        {sendingPhoto && <PendingBubble body="📷 A enviar foto…" />}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p role="alert" className="mx-auto w-full max-w-md px-4 pb-1 text-xs font-medium text-critical">
          {error}
        </p>
      )}

      <div className="border-t border-line/70 bg-surface/80 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-end gap-2">
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && sendPhoto(e.target.files[0])} />
          <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && sendPhoto(e.target.files[0])} />
          <PhotoButton onCamera={() => cameraInput.current?.click()} onGallery={() => galleryInput.current?.click()} disabled={sendingPhoto} />
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
            className="press flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M3.4 20.4L20.85 12 3.4 3.6l-.01 6.53L14 12 3.39 13.87z" />
            </svg>
          </button>
        </div>
      </div>

      {lightbox && (
        <div className="animate-fade fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setLightbox(null)}>
          <img src={`data:image/jpeg;base64,${lightbox}`} alt="Foto" className="max-h-full max-w-full rounded-2xl" />
        </div>
      )}
    </div>
  )
}

function Bubble({
  message,
  mine,
  myId,
  picking,
  onOpenPicker,
  onReact,
  onOpenImage,
}: {
  message: Message
  mine: boolean
  myId: number
  picking: boolean
  onOpenPicker: () => void
  onReact: (emoji: string) => void
  onOpenImage: (src: string) => void
}) {
  const myReaction = message.reactions.find((r) => r.userId === myId)?.emoji
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      {picking && (
        <div className="animate-pop mb-1 flex items-center gap-0.5 rounded-full bg-surface px-1.5 py-1 shadow-md">
          {MESSAGE_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={(e) => { e.stopPropagation(); onReact(emoji) }}
              className={`press rounded-full px-1 text-xl leading-none ${myReaction === emoji ? 'bg-accent-soft' : ''}`}
              aria-label={`Reagir ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenPicker() }}
        className={`relative max-w-[78%] text-left ${message.image ? '' : 'rounded-3xl px-4 py-2'} ${
          message.image ? '' : mine ? 'bg-accent text-white' : 'bg-surface'
        }`}
      >
        {message.image ? (
          <img
            src={`data:image/jpeg;base64,${message.image}`}
            alt="Foto"
            onClick={(e) => { e.stopPropagation(); onOpenImage(message.image!) }}
            className="max-h-64 w-auto rounded-3xl object-cover"
          />
        ) : (
          <span className="whitespace-pre-wrap break-words text-[15px] leading-snug">{message.body}</span>
        )}
        {mine && !message.image && (
          <span className={`ml-1.5 text-[10px] ${message.readAt ? 'opacity-90' : 'opacity-50'}`} aria-label={message.readAt ? 'Lida' : 'Enviada'}>
            {message.readAt ? '✓✓' : '✓'}
          </span>
        )}
      </button>
      {message.reactions.length > 0 && (
        <div className={`-mt-1.5 flex gap-0.5 ${mine ? 'mr-2' : 'ml-2'}`}>
          {message.reactions.map((r) => (
            <span key={r.userId} className="animate-tapback rounded-full bg-surface px-1.5 py-0.5 text-xs shadow-sm">
              {r.emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function PendingBubble({ body }: { body: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] rounded-3xl bg-accent px-4 py-2 text-[15px] leading-snug text-white opacity-60">
        {body}
      </div>
    </div>
  )
}

function PhotoButton({ onCamera, onGallery, disabled }: { onCamera: () => void; onGallery: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="animate-pop absolute bottom-12 left-0 z-20 w-40 overflow-hidden rounded-2xl bg-surface shadow-lg">
            <button onClick={() => { setOpen(false); onCamera() }} className="press flex w-full items-center gap-2 px-4 py-3 text-sm">
              📷 Tirar foto
            </button>
            <div className="h-px bg-line" />
            <button onClick={() => { setOpen(false); onGallery() }} className="press flex w-full items-center gap-2 px-4 py-3 text-sm">
              🖼️ Galeria
            </button>
          </div>
        </>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-label="Enviar foto"
        className="press flex h-11 w-11 items-center justify-center rounded-full bg-bg text-accent disabled:opacity-40"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="6" width="18" height="14" rx="2.5" />
          <circle cx="12" cy="13" r="3.2" />
          <path d="M8 6l1.2-2h5.6L16 6" />
        </svg>
      </button>
    </div>
  )
}
