/** Feed de atividade automática dos amigos. */

import { useEffect, useState } from 'react'
import { social, type FeedEvent } from '../../lib/social'
import { formatDatePT } from '../../lib/store'
import { Card } from '../ui'

function eventText(e: FeedEvent): string {
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

  if (events === null) {
    return <p className="px-5 py-10 text-center text-muted">A carregar…</p>
  }

  if (events.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <div className="text-4xl" aria-hidden>🫧</div>
        <p className="mt-3 font-semibold">Ainda não há atividade</p>
        <p className="mt-1 text-sm text-ink-2">Adiciona amigos para veres as conquistas deles aqui.</p>
        <button onClick={onOpenFriends} className="mt-4 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">
          Procurar amigos
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2 px-4">
      {events.map((e) => (
        <Card key={e.id} className="flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-xl" aria-hidden>
            {e.user.avatar}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug">
              <span className="font-semibold">@{e.user.username}</span> {eventText(e)}
            </p>
            <p className="mt-0.5 text-xs text-muted">{formatDatePT(e.refDate)}</p>
          </div>
        </Card>
      ))}
      {hasMore && (
        <button onClick={loadMore} disabled={busy} className="w-full py-3 text-sm font-medium text-accent disabled:opacity-40">
          {busy ? 'A carregar…' : 'Ver mais'}
        </button>
      )}
    </div>
  )
}
