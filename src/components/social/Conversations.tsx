/** Lista de conversas (DMs + grupos) + criação de grupo. */

import { useEffect, useMemo, useState } from 'react'
import {
  messages as messagesApi,
  social,
  type Conversation,
  type FriendshipOut,
} from '../../lib/social'
import { haptic } from '../../lib/store'
import type { SocialSocket } from '../../lib/ws'
import Avatar from './Avatar'
import { Card } from '../ui'

interface Props {
  socket: SocialSocket
  onOpen: (conversation: Conversation) => void
  onBack: () => void
}

const GROUP_EMOJIS = ['👥', '💪', '🥗', '🏃', '🔥', '🍽️', '⚽', '🎯', '🌱', '☕']

function lastPreview(c: Conversation): string {
  const m = c.lastMessage
  if (!m) return 'Nova conversa'
  if (m.share) return m.share.kind === 'recipe' ? '🧾 Receita' : '🍎 Alimento'
  if (m.image && !m.body) return '📷 Foto'
  return m.body
}

export default function Conversations({ socket, onOpen, onBack }: Props) {
  const [convs, setConvs] = useState<Conversation[] | null>(null)
  const [newGroup, setNewGroup] = useState(false)

  const reload = () => messagesApi.conversations().then(setConvs).catch(() => setConvs([]))
  useEffect(() => {
    reload()
    return socket.subscribe((ev) => {
      if (ev.type === 'message' || ev.type === 'conversation' || ev.type === 'read') reload()
    })
  }, [socket])

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-bg">
      <header className="flex items-end justify-between px-5 pb-2 pt-[max(1.75rem,env(safe-area-inset-top))]">
        <div>
          <button onClick={onBack} className="text-sm font-medium text-accent">‹ Social</button>
          <h1 className="text-[2.125rem] font-bold leading-tight tracking-tight">Mensagens</h1>
        </div>
        <button
          onClick={() => { haptic(); setNewGroup(true) }}
          aria-label="Novo grupo"
          className="press mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>

      <div className="mx-auto max-w-md px-4 pb-10 pt-2">
        {convs === null && (
          <Card className="divide-y divide-line">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <div className="skeleton h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-1/3 rounded" />
                  <div className="skeleton h-3 w-2/3 rounded" />
                </div>
              </div>
            ))}
          </Card>
        )}
        {convs !== null && convs.length === 0 && (
          <div className="py-10 text-center">
            <div className="text-4xl" aria-hidden>💬</div>
            <p className="mt-3 font-semibold">Sem conversas</p>
            <p className="mt-1 text-sm text-ink-2">Abre o perfil de um amigo, ou cria um grupo com o +.</p>
          </div>
        )}
        {convs !== null && convs.length > 0 && (
          <Card className="divide-y divide-line">
            {convs.map((c, i) => (
              <button
                key={c.id}
                onClick={() => onOpen(c)}
                className="animate-in flex w-full items-center gap-3 p-4 text-left transition-colors active:bg-bg"
                style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
              >
                {c.type === 'group' ? (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg text-2xl">{c.emoji}</div>
                ) : (
                  <Avatar avatar={c.user?.avatar ?? '🙂'} avatarPhoto={c.user?.avatarPhoto} size={48} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {c.type === 'group' ? c.title : `@${c.user?.username ?? '?'}`}
                    {c.type === 'group' && (
                      <span className="ml-1.5 text-xs font-normal text-muted">{c.members.length}</span>
                    )}
                  </div>
                  <div className="truncate text-sm text-muted">{lastPreview(c)}</div>
                </div>
                {c.unread > 0 && (
                  <span className="animate-pop flex h-6 min-w-6 items-center justify-center rounded-full bg-critical px-1.5 text-xs font-bold text-white">
                    {c.unread}
                  </span>
                )}
              </button>
            ))}
          </Card>
        )}
      </div>

      {newGroup && (
        <NewGroupSheet
          onClose={() => setNewGroup(false)}
          onCreated={(c) => { setNewGroup(false); reload(); onOpen(c) }}
        />
      )}
    </div>
  )
}

function NewGroupSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Conversation) => void }) {
  const [friends, setFriends] = useState<FriendshipOut[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState(GROUP_EMOJIS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    social.friends().then((f) => setFriends(f.friends)).catch(() => {})
  }, [])

  const canCreate = useMemo(() => title.trim().length > 0 && selected.size > 0, [title, selected])

  const toggle = (id: number) => {
    haptic(10)
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const create = async () => {
    if (!canCreate) return
    setBusy(true)
    setError('')
    try {
      const c = await messagesApi.createGroup(title.trim(), emoji, [...selected])
      haptic(20)
      onCreated(c)
    } catch {
      setError('Não foi possível criar o grupo.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sheet-backdrop" onClick={onClose}>
      <div className="sheet-panel max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-bg p-5 scroll-contain" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <h2 className="mb-4 text-xl font-bold">Novo grupo</h2>

        <div className="mb-4 flex gap-2">
          <select
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            aria-label="Emoji do grupo"
            className="rounded-xl bg-surface px-3 py-2 text-xl focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {GROUP_EMOJIS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome do grupo"
            maxLength={60}
            className="flex-1 rounded-xl bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Nome do grupo"
          />
        </div>

        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Membros {selected.size > 0 && `(${selected.size})`}
        </div>
        {friends.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Ainda não tens amigos para adicionar.</p>
        ) : (
          <div className="mb-4 space-y-1">
            {friends.map((f) => {
              const on = selected.has(f.user.userId)
              return (
                <button
                  key={f.user.userId}
                  onClick={() => toggle(f.user.userId)}
                  className="press flex w-full items-center gap-3 rounded-xl p-2 text-left"
                >
                  <Avatar avatar={f.user.avatar} avatarPhoto={f.user.avatarPhoto} size={36} />
                  <span className="flex-1 truncate text-sm">{f.user.name || `@${f.user.username}`}</span>
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                      on ? 'border-accent bg-accent text-white' : 'border-line'
                    }`}
                    aria-hidden
                  >
                    {on ? '✓' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {error && <p className="mb-3 text-sm font-medium text-critical">{error}</p>}

        <button
          onClick={() => void create()}
          disabled={!canCreate || busy}
          className="press w-full rounded-2xl bg-accent py-3 font-semibold text-white disabled:opacity-40"
        >
          {busy ? 'A criar…' : 'Criar grupo'}
        </button>
      </div>
    </div>
  )
}
