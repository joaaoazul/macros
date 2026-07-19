/** Feed de atividade automática dos amigos, com reações (kudos). */

import { useEffect, useState } from 'react'
import { BADGES, FEED_REACTIONS, social, type FeedEvent, type ReactionSummary } from '../../lib/social'
import { formatDatePT, haptic } from '../../lib/store'
import Avatar from './Avatar'
import { Button, Card, EmptyState, ListSkeleton } from '../ui'

function eventText(e: FeedEvent): string {
  if (e.kind.startsWith('badge_')) {
    const badge = BADGES[e.kind.replace('badge_', '')]
    return badge ? `desbloqueou "${badge.title}" ${badge.emoji}` : 'desbloqueou uma conquista 🏅'
  }
  switch (e.kind) {
    case 'day_on_plan':
      return 'fechou o dia dentro da meta 🎯'
    case 'streak':
      return `está há ${e.payload.days ?? '?'} dias no plano 🔥`
    case 'rank_up':
      return `subiu para ${e.payload.rank ?? '?'}º na classificação 🏆`
    case 'friend_joined':
      return 'é agora teu amigo 👋'
    default:
      return e.kind
  }
}

export default function Feed({ onOpenFriends }: { onOpenFriends: () => void }) {
  const [events, setEvents] = useState<FeedEvent[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    social
      .feed()
      .then((evs) => {
        setEvents(evs)
        setHasMore(evs.length >= 30)
      })
      .catch(() => setEvents([]))
  }, [])

  const loadMore = async () => {
    if (!events?.length || busy) return
    setBusy(true)
    try {
      const older = await social.feed(events[events.length - 1].id)
      setEvents([...events, ...older])
      setHasMore(older.length >= 30)
    } finally {
      setBusy(false)
    }
  }

  const patchReactions = (id: number, reactions: ReactionSummary) =>
    setEvents((evs) => evs?.map((e) => (e.id === id ? { ...e, reactions } : e)) ?? null)

  if (events === null) {
    return <div className="px-4"><ListSkeleton rows={4} /></div>
  }

  if (events.length === 0) {
    return (
      <EmptyState
        emoji="🫧"
        title="Ainda não há atividade"
        hint="Adiciona amigos para veres as conquistas deles aqui."
        action={<Button onClick={onOpenFriends}>Procurar amigos</Button>}
      />
    )
  }

  return (
    <div className="space-y-2 px-4">
      {events.map((e, i) => {
        const isBadge = e.kind.startsWith('badge_')
        return (
          <Card
            key={e.id}
            className={`animate-in p-4 ${isBadge ? 'ring-1 ring-accent-soft' : ''}`}
          >
            <div className="flex items-center gap-3" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
              <Avatar avatar={e.user.avatar} avatarPhoto={e.user.avatarPhoto} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">
                  <span className="font-semibold">@{e.user.username}</span> {eventText(e)}
                </p>
                <p className="mt-0.5 text-xs text-muted">{formatDatePT(e.refDate)}</p>
              </div>
            </div>
            <ReactionBar event={e} onChange={(r) => patchReactions(e.id, r)} />
          </Card>
        )
      })}
      {hasMore && (
        <button onClick={loadMore} disabled={busy} className="w-full py-3 text-sm font-medium text-accent disabled:opacity-40">
          {busy ? 'A carregar…' : 'Ver mais'}
        </button>
      )}
    </div>
  )
}

function ReactionBar({ event, onChange }: { event: FeedEvent; onChange: (r: ReactionSummary) => void }) {
  const [picking, setPicking] = useState(false)
  const { counts, mine, total } = event.reactions

  const toggle = async (emoji: string) => {
    haptic(15)
    setPicking(false)
    try {
      const next = mine === emoji ? await social.unreact(event.id) : await social.react(event.id, emoji)
      onChange(next)
    } catch {
      // silencioso — a barra volta ao estado anterior no próximo carregamento
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {Object.entries(counts).map(([emoji, n]) => (
        <button
          key={emoji}
          onClick={() => toggle(emoji)}
          className={`press flex items-center gap-1 rounded-full px-2.5 py-1 text-sm ${
            mine === emoji ? 'bg-accent-soft text-accent ring-1 ring-accent/30' : 'bg-bg text-ink-2'
          }`}
        >
          <span aria-hidden>{emoji}</span>
          <span className="text-xs font-semibold tabular-nums">{n}</span>
        </button>
      ))}

      {picking ? (
        <div className="animate-pop flex items-center gap-1 rounded-full bg-bg px-1.5 py-1 shadow-sm">
          {FEED_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => toggle(emoji)}
              className="press rounded-full px-1 text-xl leading-none"
              aria-label={`Reagir ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={() => setPicking(true)}
          className="press flex h-7 items-center gap-1 rounded-full bg-bg px-2.5 text-muted"
          aria-label="Adicionar reação"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M9 10h.01M15 10h.01M9 15c.8.8 1.9 1.2 3 1.2s2.2-.4 3-1.2" />
          </svg>
          {total === 0 && <span className="text-xs font-medium">Reagir</span>}
        </button>
      )}
    </div>
  )
}
