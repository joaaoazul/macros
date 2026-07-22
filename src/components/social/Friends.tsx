/** Amigos: pesquisa, pedidos recebidos/enviados, lista com perfil público. */

import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../lib/api'
import {
  social,
  type FriendsList,
  type PublicProfileLite,
  type SearchResult,
} from '../../lib/social'
import Avatar from './Avatar'
import ProfilePage from './ProfilePage'
import { Card, ListSkeleton } from '../ui'

interface Props {
  onMessage: (user: PublicProfileLite) => void
}

export default function Friends({ onMessage }: Props) {
  const [list, setList] = useState<FriendsList | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [profileUser, setProfileUser] = useState<string | null>(null)
  const [error, setError] = useState('')
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reload = () => social.friends().then(setList).catch(() => setList({ friends: [], incoming: [], outgoing: [] }))
  useEffect(() => {
    reload()
  }, [])

  const onQuery = (q: string) => {
    setQuery(q)
    setError('')
    if (debounce.current) clearTimeout(debounce.current)
    if (q.trim().length < 3) {
      setResults(null)
      return
    }
    debounce.current = setTimeout(() => {
      social.search(q.trim().toLowerCase()).then(setResults).catch(() => setResults([]))
    }, 300)
  }

  const act = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
      await reload()
      if (query.trim().length >= 3) setResults(await social.search(query.trim().toLowerCase()))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Algo correu mal. Tenta novamente.')
    }
  }

  if (!list) return <div className="px-4"><ListSkeleton rows={4} /></div>

  return (
    <div className="space-y-4 px-4">
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Procurar por @username…"
        autoCapitalize="none"
        autoCorrect="off"
        className="w-full rounded-xl bg-surface px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label="Procurar utilizadores"
      />

      {error && <p role="alert" className="text-sm font-medium text-critical">{error}</p>}

      {results !== null && (
        <Card className="divide-y divide-line">
          {results.length === 0 && <p className="p-4 text-sm text-muted">Sem resultados para “{query}”.</p>}
          {results.map((r) => (
            <div key={r.userId} className="flex items-center gap-3 p-4">
              <button onClick={() => setProfileUser(r.username)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Avatar avatar={r.avatar} avatarPhoto={r.avatarPhoto} size={40} />
                <div className="min-w-0">
                  <div className="truncate font-semibold">@{r.username}</div>
                  <div className="truncate text-xs text-muted">{r.name}</div>
                </div>
              </button>
              {r.friendship === 'none' && (
                <button onClick={() => act(() => social.sendRequest(r.username))} className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white">
                  Adicionar
                </button>
              )}
              {r.friendship === 'outgoing' && <span className="text-xs font-medium text-muted">Pendente</span>}
              {r.friendship === 'incoming' && <span className="text-xs font-medium text-accent">Quer ser teu amigo</span>}
              {r.friendship === 'friends' && <span className="text-xs font-medium text-good">Amigos ✓</span>}
            </div>
          ))}
        </Card>
      )}

      {list.incoming.length > 0 && (
        <section>
          <h3 className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Pedidos recebidos</h3>
          <Card className="divide-y divide-line">
            {list.incoming.map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-4">
                <Avatar avatar={f.user.avatar} avatarPhoto={f.user.avatarPhoto} size={40} />
                <div className="min-w-0 flex-1 truncate font-semibold">@{f.user.username}</div>
                <button onClick={() => act(() => social.accept(f.id))} className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white">
                  Aceitar
                </button>
                <button onClick={() => act(() => social.declineOrCancel(f.id))} className="rounded-full bg-bg px-3 py-1.5 text-sm font-medium">
                  Recusar
                </button>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section>
        <h3 className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          Amigos ({list.friends.length})
        </h3>
        <Card className="divide-y divide-line">
          {list.friends.length === 0 && (
            <p className="p-5 text-center text-sm text-ink-2">
              Ainda não tens amigos. Procura pelo @username deles acima. 👆
            </p>
          )}
          {list.friends.map((f) => (
            <button
              key={f.id}
              onClick={() => setProfileUser(f.user.username)}
              className="row-press flex w-full items-center gap-3 p-4 text-left"
            >
              <Avatar avatar={f.user.avatar} avatarPhoto={f.user.avatarPhoto} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">@{f.user.username}</div>
                <div className="truncate text-xs text-muted">{f.user.name}</div>
              </div>
              <span className="text-muted" aria-hidden>›</span>
            </button>
          ))}
        </Card>
      </section>

      {list.outgoing.length > 0 && (
        <section>
          <h3 className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Pedidos enviados</h3>
          <Card className="divide-y divide-line">
            {list.outgoing.map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-4">
                <Avatar avatar={f.user.avatar} avatarPhoto={f.user.avatarPhoto} size={40} />
                <div className="min-w-0 flex-1 truncate font-semibold">@{f.user.username}</div>
                <button onClick={() => act(() => social.declineOrCancel(f.id))} className="rounded-full bg-bg px-3 py-1.5 text-sm font-medium">
                  Cancelar
                </button>
              </div>
            ))}
          </Card>
        </section>
      )}

      {profileUser && (
        <ProfilePage
          username={profileUser}
          onMessage={onMessage}
          onOpenProfile={(u) => setProfileUser(u)}
          onClose={() => { setProfileUser(null); void reload() }}
        />
      )}
    </div>
  )
}
