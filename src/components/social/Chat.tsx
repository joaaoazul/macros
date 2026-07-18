/** Conversa (DM ou grupo): tempo real via WS, envio otimista, reações, fotos e partilhas. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { downscaleImage } from '../../lib/ai'
import {
  messages as messagesApi,
  MESSAGE_REACTIONS,
  social,
  type Conversation,
  type FriendshipOut,
  type Message,
  type PublicProfileLite,
} from '../../lib/social'
import { haptic, uid } from '../../lib/store'
import type { Food, Recipe } from '../../types'
import type { SocialSocket } from '../../lib/ws'
import Avatar from './Avatar'

interface Pending {
  clientId: string
  body: string
}

interface Props {
  me: number
  conversation: Conversation
  socket: SocialSocket
  onBack: () => void
  onConversationChanged?: () => void
  customFoods: Food[]
  setCustomFoods: React.Dispatch<React.SetStateAction<Food[]>>
  recipes: Recipe[]
  setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>
}

function titleOf(c: Conversation): string {
  if (c.type === 'group') return c.title || 'Grupo'
  return c.user ? `@${c.user.username}` : 'Conversa'
}

export default function Chat({
  me,
  conversation,
  socket,
  onBack,
  onConversationChanged,
  setCustomFoods,
  setRecipes,
}: Props) {
  const convId = conversation.id
  const isGroup = conversation.type === 'group'
  const [history, setHistory] = useState<Message[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [sendingPhoto, setSendingPhoto] = useState(false)
  const [pickerFor, setPickerFor] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [partnerReadUpTo, setPartnerReadUpTo] = useState<number>(conversation.partnerReadUpTo ?? 0)
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set())
  const [showInfo, setShowInfo] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)

  const membersById = useMemo(() => {
    const map = new Map<number, PublicProfileLite>()
    for (const m of conversation.members) map.set(m.userId, m)
    return map
  }, [conversation.members])

  const scrollDown = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  const markRead = useCallback(() => {
    void messagesApi.markRead(convId)
    socket.send({ type: 'read', conversationId: convId })
  }, [convId, socket])

  // histórico + marcar lido
  useEffect(() => {
    messagesApi
      .history(convId)
      .then((msgs) => {
        setHistory(msgs.reverse()) // API é newest-first; UI é oldest-first
        setLoaded(true)
        markRead()
        setTimeout(() => scrollDown(false), 0)
      })
      .catch(() => setLoaded(true))
  }, [convId, scrollDown, markRead])

  // eventos em tempo real
  useEffect(() => {
    return socket.subscribe((ev) => {
      if (ev.type === 'message') {
        const m = ev.message
        if (m.conversationId !== convId) return
        setHistory((h) => (h.some((x) => x.id === m.id) ? h : [...h, m]))
        if (ev.clientId) setPending((p) => p.filter((x) => x.clientId !== ev.clientId))
        if (m.senderId !== me) markRead()
        setTimeout(() => scrollDown(), 0)
      } else if (ev.type === 'read' && ev.conversationId === convId && ev.by !== me) {
        setPartnerReadUpTo((cur) => Math.max(cur, ev.upToId))
      } else if (ev.type === 'reaction' && ev.conversationId === convId) {
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
  }, [socket, me, convId, scrollDown, markRead])

  const send = async () => {
    const body = draft.trim()
    if (!body) return
    setDraft('')
    setError('')
    const clientId = uid()

    if (socket.send({ type: 'send', conversationId: convId, body, clientId })) {
      setPending((p) => [...p, { clientId, body }])
      setTimeout(() => scrollDown(), 0)
      return
    }
    try {
      const m = await messagesApi.send(convId, { body })
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
      const m = await messagesApi.send(convId, { image })
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

  const saveShare = async (message: Message) => {
    haptic(20)
    try {
      const res = await messagesApi.saveShare(message.id)
      if (res.kind === 'food' && res.food) {
        const food = res.food
        setCustomFoods((prev) => (prev.some((f) => f.id === food.id) ? prev : [food, ...prev]))
      } else if (res.kind === 'recipe' && res.recipe) {
        const recipe = res.recipe
        setRecipes((prev) => (prev.some((r) => r.id === recipe.id) ? prev : [recipe, ...prev]))
      }
      setSavedIds((s) => new Set(s).add(message.id))
    } catch {
      setError('Não foi possível guardar.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-line/70 bg-surface/80 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <button onClick={onBack} aria-label="Voltar" className="press text-accent">
          ‹ <span className="text-sm font-medium">Voltar</span>
        </button>
        {isGroup ? (
          <button onClick={() => setShowInfo(true)} className="press flex min-w-0 items-center gap-3 text-left">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-xl">{conversation.emoji}</div>
            <div className="min-w-0">
              <div className="truncate font-semibold leading-tight">{titleOf(conversation)}</div>
              <div className="truncate text-[11px] text-muted">{conversation.members.length} membros</div>
            </div>
          </button>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar avatar={conversation.user?.avatar ?? '🙂'} avatarPhoto={conversation.user?.avatarPhoto} size={36} />
            <div className="min-w-0">
              <div className="truncate font-semibold leading-tight">{titleOf(conversation)}</div>
              {!socket.connected && <div className="text-[11px] text-muted">a reconectar…</div>}
            </div>
          </div>
        )}
      </header>

      <div className="mx-auto w-full max-w-md flex-1 space-y-1 overflow-y-auto px-4 py-3 scroll-contain" onClick={() => setPickerFor(null)}>
        {!loaded && <p className="py-8 text-center text-sm text-muted">A carregar…</p>}
        {loaded && history.length === 0 && pending.length === 0 && (
          <p className="animate-in py-8 text-center text-sm text-muted">
            {isGroup ? `Início do grupo ${titleOf(conversation)} 👋` : `Diz olá a ${titleOf(conversation)} 👋`}
          </p>
        )}
        {history.map((m, i) => {
          const mine = m.senderId === me
          const prev = history[i - 1]
          const startsCluster = !prev || prev.senderId !== m.senderId
          return (
            <Bubble
              key={m.id}
              message={m}
              mine={mine}
              myId={me}
              isGroup={isGroup}
              sender={membersById.get(m.senderId)}
              showSender={isGroup && !mine && startsCluster}
              seen={mine && !isGroup && m.id <= partnerReadUpTo}
              saved={savedIds.has(m.id)}
              picking={pickerFor === m.id}
              onOpenPicker={() => { haptic(10); setPickerFor((cur) => (cur === m.id ? null : m.id)) }}
              onReact={(emoji) => react(m, emoji)}
              onOpenImage={setLightbox}
              onSaveShare={() => saveShare(m)}
            />
          )
        })}
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
            aria-label={`Mensagem para ${titleOf(conversation)}`}
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

      {showInfo && isGroup && (
        <GroupInfoSheet
          me={me}
          conversation={conversation}
          onClose={() => setShowInfo(false)}
          onChanged={() => { onConversationChanged?.() }}
          onLeft={() => { setShowInfo(false); onConversationChanged?.(); onBack() }}
        />
      )}
    </div>
  )
}

function Bubble({
  message,
  mine,
  myId,
  isGroup,
  sender,
  showSender,
  seen,
  saved,
  picking,
  onOpenPicker,
  onReact,
  onOpenImage,
  onSaveShare,
}: {
  message: Message
  mine: boolean
  myId: number
  isGroup: boolean
  sender?: PublicProfileLite
  showSender: boolean
  seen: boolean
  saved: boolean
  picking: boolean
  onOpenPicker: () => void
  onReact: (emoji: string) => void
  onOpenImage: (src: string) => void
  onSaveShare: () => void
}) {
  const myReaction = message.reactions.find((r) => r.userId === myId)?.emoji
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'} ${showSender ? 'mt-2' : ''}`}>
      {showSender && sender && (
        <div className="mb-0.5 ml-9 text-[11px] font-medium text-muted">{sender.name || `@${sender.username}`}</div>
      )}
      <div className={`flex max-w-[85%] items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
        {isGroup && !mine && (
          <div className="w-7 shrink-0">
            {showSender && sender && <Avatar avatar={sender.avatar} avatarPhoto={sender.avatarPhoto} size={28} />}
          </div>
        )}
        <div className="flex flex-col">
          {picking && (
            <div className={`animate-pop mb-1 flex items-center gap-0.5 ${mine ? 'self-end' : 'self-start'} rounded-full bg-surface px-1.5 py-1 shadow-md`}>
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
          {message.share ? (
            <ShareCard message={message} mine={mine} saved={saved} onSave={onSaveShare} onOpenPicker={onOpenPicker} />
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenPicker() }}
              className={`relative text-left ${message.image ? '' : 'rounded-3xl px-4 py-2'} ${
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
            </button>
          )}
          {message.reactions.length > 0 && (
            <div className={`-mt-1.5 flex gap-0.5 ${mine ? 'mr-2 self-end' : 'ml-2'}`}>
              {message.reactions.map((r) => (
                <span key={r.userId} className="animate-tapback rounded-full bg-surface px-1.5 py-0.5 text-xs shadow-sm">
                  {r.emoji}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {seen && <span className="mr-1 mt-0.5 text-[10px] text-muted" aria-label="Lida">Lida ✓✓</span>}
    </div>
  )
}

function ShareCard({
  message,
  mine,
  saved,
  onSave,
  onOpenPicker,
}: {
  message: Message
  mine: boolean
  saved: boolean
  onSave: () => void
  onOpenPicker: () => void
}) {
  const share = message.share!
  const payload = share.payload as Record<string, unknown>
  const name = String(payload.name ?? 'Partilha')
  const emoji = String(payload.emoji ?? (share.kind === 'recipe' ? '🍽️' : '🍎'))
  const items = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : null
  const kcal =
    share.kind === 'recipe' && items
      ? Math.round(items.reduce((s, it) => s + (Number(it.kcal) || 0), 0))
      : Math.round(Number(payload.kcal) || 0)
  return (
    <div className={`w-60 overflow-hidden rounded-3xl ${mine ? 'bg-accent text-white' : 'bg-surface'}`}>
      <button onClick={(e) => { e.stopPropagation(); onOpenPicker() }} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="text-2xl">{emoji}</span>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide opacity-70">
            {share.kind === 'recipe' ? 'Receita partilhada' : 'Alimento partilhado'}
          </div>
          <div className="truncate font-semibold leading-tight">{name}</div>
          <div className="text-xs opacity-80">
            {kcal} kcal{share.kind === 'recipe' && items ? ` · ${items.length} ingredientes` : ' / 100g'}
          </div>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); if (!saved) onSave() }}
        disabled={saved}
        className={`press w-full border-t py-2 text-center text-sm font-semibold ${
          mine ? 'border-white/20 text-white' : 'border-line text-accent'
        } ${saved ? 'opacity-60' : ''}`}
      >
        {saved ? '✓ Guardado' : share.kind === 'recipe' ? 'Guardar receita' : 'Guardar alimento'}
      </button>
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

function GroupInfoSheet({
  me,
  conversation,
  onClose,
  onChanged,
  onLeft,
}: {
  me: number
  conversation: Conversation
  onClose: () => void
  onChanged: () => void
  onLeft: () => void
}) {
  const isOwner = conversation.role === 'owner'
  const [title, setTitle] = useState(conversation.title || '')
  const [friends, setFriends] = useState<FriendshipOut[]>([])
  const [busy, setBusy] = useState(false)
  const memberIds = useMemo(() => new Set(conversation.members.map((m) => m.userId)), [conversation.members])

  useEffect(() => {
    if (isOwner) social.friends().then((f) => setFriends(f.friends)).catch(() => {})
  }, [isOwner])

  const addable = friends.filter((f) => !memberIds.has(f.user.userId))

  const rename = async () => {
    const t = title.trim()
    if (!t || t === conversation.title) return
    setBusy(true)
    try {
      await messagesApi.renameGroup(conversation.id, t)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const add = async (userId: number) => {
    setBusy(true)
    try {
      await messagesApi.addMembers(conversation.id, [userId])
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const leave = async () => {
    setBusy(true)
    try {
      await messagesApi.removeMember(conversation.id, me)
      onLeft()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/40 sheet-backdrop" onClick={onClose}>
      <div className="sheet-panel max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-bg p-5 scroll-contain" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-2xl">{conversation.emoji}</div>
          <div>
            <div className="text-lg font-bold">{conversation.title || 'Grupo'}</div>
            <div className="text-xs text-muted">{conversation.members.length} membros</div>
          </div>
        </div>

        {isOwner && (
          <div className="mb-4 flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              className="flex-1 rounded-xl bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Nome do grupo"
            />
            <button onClick={() => void rename()} disabled={busy} className="press rounded-xl bg-accent px-4 text-sm font-semibold text-white disabled:opacity-40">
              Guardar
            </button>
          </div>
        )}

        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Membros</div>
        <div className="mb-4 space-y-1.5">
          {conversation.members.map((m, i) => (
            <div key={m.userId} className="flex items-center gap-3">
              <Avatar avatar={m.avatar} avatarPhoto={m.avatarPhoto} size={32} />
              <span className="flex-1 truncate text-sm">{m.name || `@${m.username}`}{m.userId === me ? ' (tu)' : ''}</span>
              {i === 0 && <span className="text-[10px] text-muted">dono</span>}
            </div>
          ))}
        </div>

        {isOwner && addable.length > 0 && (
          <>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Adicionar amigos</div>
            <div className="mb-4 space-y-1.5">
              {addable.map((f) => (
                <button key={f.user.userId} onClick={() => void add(f.user.userId)} disabled={busy} className="press flex w-full items-center gap-3 disabled:opacity-40">
                  <Avatar avatar={f.user.avatar} avatarPhoto={f.user.avatarPhoto} size={32} />
                  <span className="flex-1 truncate text-left text-sm">{f.user.name || `@${f.user.username}`}</span>
                  <span className="text-accent">+ Adicionar</span>
                </button>
              ))}
            </div>
          </>
        )}

        <button onClick={() => void leave()} disabled={busy} className="press w-full rounded-xl bg-surface py-3 text-sm font-semibold text-critical disabled:opacity-40">
          Sair do grupo
        </button>
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
