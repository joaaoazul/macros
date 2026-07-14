/** Amigos: pesquisa, pedidos recebidos/enviados, lista com perfil público. */

import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../lib/api'
import {
  BADGES,
  NUDGES,
  social,
  type FriendsList,
  type NudgeKind,
  type PublicProfile,
  type PublicProfileLite,
  type SearchResult,
} from '../../lib/social'
import { haptic } from '../../lib/store'
import Avatar from './Avatar'
import { Card } from '../ui'

interface Props {
  onMessage: (user: PublicProfileLite) => void
}

export default function Friends({ onMessage }: Props) {
  const [list, setList] = useState<FriendsList | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [profile, setProfile] = useState<PublicProfile | null>(null)
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
      if (profile) setProfile(await social.profile(profile.username))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Algo correu mal. Tenta novamente.')
    }
  }

  if (!list) return <p className="px-5 py-10 text-center text-muted">A carregar…</p>

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
              <button onClick={() => social.profile(r.username).then(setProfile)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
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
              onClick={() => social.profile(f.user.username).then(setProfile)}
              className="flex w-full items-center gap-3 p-4 text-left"
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

      {/* perfil público em sheet */}
      {profile && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setProfile(null)}>
          <div
            className="sheet-panel w-full rounded-t-3xl bg-bg p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto max-w-md">
              <div className="flex items-center gap-4">
                <Avatar avatar={profile.avatar} avatarPhoto={profile.avatarPhoto} size={64} />
                <div>
                  <div className="text-xl font-bold">@{profile.username}</div>
                  <div className="text-sm text-muted">{profile.name}</div>
                </div>
              </div>
              {profile.bio && <p className="mt-3 text-sm text-ink-2">{profile.bio}</p>}

              {profile.badges.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {profile.badges.map((k) => {
                    const b = BADGES[k]
                    if (!b) return null
                    return (
                      <span
                        key={k}
                        title={b.description}
                        className="animate-pop flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-xs font-medium"
                      >
                        <span aria-hidden>{b.emoji}</span> {b.title}
                      </span>
                    )
                  })}
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold">{profile.stats.streak} 🔥</div>
                  <div className="text-xs uppercase tracking-wide text-muted">Streak</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold">{profile.stats.daysOnPlan7d}/7</div>
                  <div className="text-xs uppercase tracking-wide text-muted">Dias no plano</div>
                </Card>
              </div>

              <div className="mt-5 flex flex-col gap-2.5">
                {profile.friendship === 'friends' && (
                  <>
                    <button
                      onClick={() => {
                        onMessage(profile)
                        setProfile(null)
                      }}
                      className="press rounded-full bg-accent px-6 py-3 font-semibold text-white"
                    >
                      Enviar mensagem
                    </button>
                    <NudgeButton userId={profile.userId} />
                    <button
                      onClick={() => act(async () => {
                        await social.removeFriend(profile.userId)
                        setProfile(null)
                      })}
                      className="rounded-full px-6 py-3 text-sm font-medium text-critical"
                    >
                      Remover amigo
                    </button>
                  </>
                )}
                {profile.friendship === 'none' && (
                  <button onClick={() => act(() => social.sendRequest(profile.username))} className="rounded-full bg-accent px-6 py-3 font-semibold text-white">
                    Adicionar amigo
                  </button>
                )}
                {profile.friendship === 'outgoing' && (
                  <p className="text-center text-sm text-muted">Pedido pendente</p>
                )}
                {profile.friendship === 'incoming' && profile.friendshipId && (
                  <button onClick={() => act(() => social.accept(profile.friendshipId!))} className="rounded-full bg-accent px-6 py-3 font-semibold text-white">
                    Aceitar pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** "Dar um toque": expande num seletor de mensagens rápidas; envia com cooldown. */
function NudgeButton({ userId }: { userId: number }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  const send = async (kind: NudgeKind) => {
    haptic(20)
    setOpen(false)
    try {
      await social.nudge(userId, kind)
      setState('sent')
      setMsg('Toque enviado! 👋')
    } catch (e) {
      setState('error')
      setMsg(e instanceof ApiError ? e.message : 'Não foi possível enviar o toque.')
    }
    setTimeout(() => setState('idle'), 2500)
  }

  if (state === 'sent' || state === 'error') {
    return (
      <p className={`animate-fade text-center text-sm font-medium ${state === 'sent' ? 'text-good' : 'text-critical'}`}>
        {msg}
      </p>
    )
  }

  if (open) {
    return (
      <div className="animate-in grid grid-cols-2 gap-2">
        {NUDGES.map((n) => (
          <button
            key={n.kind}
            onClick={() => send(n.kind)}
            className="press flex items-center gap-2 rounded-xl bg-bg px-3 py-2.5 text-sm font-medium"
          >
            <span aria-hidden>{n.emoji}</span> {n.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <button onClick={() => { haptic(10); setOpen(true) }} className="press rounded-full bg-bg px-6 py-3 font-semibold text-ink-2">
      Dar um toque 👋
    </button>
  )
}
