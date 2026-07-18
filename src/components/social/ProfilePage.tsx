/** Perfil de alguém como página inteira (não uma sheet).
 *
 * Segue o padrão dos outros ecrãs cheios da app (Chat, Conversations,
 * NotificationCenter): overlay `fixed inset-0` com cabeçalho próprio. Regista
 * uma entrada no histórico para que o botão "voltar" do Android/browser feche a
 * página em vez de sair da app.
 *
 * PRIVACIDADE: stats/badges/mutuais/actividade só vêm preenchidos do servidor
 * para amigos. Aqui limitamo-nos a não inventar nada quando vêm vazios.
 */

import { useEffect, useState } from 'react'
import {
  BADGES,
  NUDGES,
  social,
  type FeedEvent,
  type NudgeKind,
  type PublicProfile,
  type PublicProfileLite,
} from '../../lib/social'
import { haptic } from '../../lib/store'
import Avatar from './Avatar'
import BadgeGrid from './BadgeGrid'
import { Card } from '../ui'

interface Props {
  username: string
  onMessage: (user: PublicProfileLite) => void
  onOpenProfile?: (username: string) => void
  onClose: () => void
}

function joinedLabel(iso?: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
  } catch {
    return null
  }
}

function eventLine(e: FeedEvent): string {
  const p = (e.payload ?? {}) as Record<string, unknown>
  if (e.kind === 'day_on_plan') return 'Cumpriu o plano'
  if (e.kind === 'streak') return `${p.days ?? ''} dias seguidos no plano`
  if (e.kind === 'rank_up') return 'Subiu na classificação'
  if (e.kind === 'friend_joined') return 'Fez uma nova amizade'
  if (e.kind.startsWith('badge_')) {
    const b = BADGES[String(p.badge ?? e.kind.replace('badge_', ''))]
    return b ? `Desbloqueou ${b.title}` : 'Desbloqueou uma conquista'
  }
  return 'Actividade'
}

export default function ProfilePage({ username, onMessage, onOpenProfile, onClose }: Props) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showBadges, setShowBadges] = useState(false)

  useEffect(() => {
    setLoading(true)
    social
      .profile(username)
      .then(setProfile)
      .catch(() => setError('Não foi possível abrir este perfil.'))
      .finally(() => setLoading(false))
  }, [username])

  // botão "voltar" do sistema fecha a página em vez de sair da app
  useEffect(() => {
    window.history.pushState({ profile: username }, '')
    const onPop = () => onClose()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username])

  const back = () => {
    // desfaz a entrada que criámos (o popstate trata do onClose)
    window.history.back()
  }

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      const fresh = await social.profile(username)
      setProfile(fresh)
    } catch {
      setError('Não foi possível concluir.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg scroll-contain">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line/70 bg-surface/80 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <button onClick={back} aria-label="Voltar" className="press text-accent">
          ‹ <span className="text-sm font-medium">Voltar</span>
        </button>
        {profile && <span className="truncate font-semibold">@{profile.username}</span>}
      </header>

      <div className="mx-auto max-w-md px-4 pb-12 pt-4">
        {loading && (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="skeleton h-24 w-24 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-5 w-1/2 rounded" />
                <div className="skeleton h-3.5 w-1/3 rounded" />
              </div>
            </div>
            <div className="skeleton h-20 rounded-card" />
          </div>
        )}

        {!loading && error && !profile && (
          <p role="alert" className="py-10 text-center text-sm text-critical">{error}</p>
        )}

        {profile && (
          <>
            <div className="animate-in flex items-center gap-4">
              <Avatar avatar={profile.avatar} avatarPhoto={profile.avatarPhoto} size={96} />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold leading-tight">{profile.name}</h1>
                <div className="truncate text-accent">@{profile.username}</div>
                {joinedLabel(profile.joinedAt) && (
                  <div className="mt-0.5 text-xs text-muted">Desde {joinedLabel(profile.joinedAt)}</div>
                )}
              </div>
            </div>

            {profile.bio && <p className="animate-in mt-3 text-[15px] leading-snug text-ink-2">{profile.bio}</p>}

            {/* acções */}
            <div className="animate-in mt-5 flex flex-col gap-2.5">
              {profile.friendship === 'friends' && (
                <>
                  <button
                    onClick={() => { onMessage(profile); onClose() }}
                    className="press rounded-full bg-accent px-6 py-3 font-semibold text-white"
                  >
                    Enviar mensagem
                  </button>
                  <NudgeButton userId={profile.userId} />
                </>
              )}
              {profile.friendship === 'none' && (
                <button
                  onClick={() => void act(() => social.sendRequest(profile.username))}
                  disabled={busy}
                  className="press rounded-full bg-accent px-6 py-3 font-semibold text-white disabled:opacity-50"
                >
                  Adicionar amigo
                </button>
              )}
              {profile.friendship === 'outgoing' && (
                <p className="text-center text-sm text-muted">Pedido pendente</p>
              )}
              {profile.friendship === 'incoming' && profile.friendshipId && (
                <button
                  onClick={() => void act(() => social.accept(profile.friendshipId!))}
                  disabled={busy}
                  className="press rounded-full bg-accent px-6 py-3 font-semibold text-white disabled:opacity-50"
                >
                  Aceitar pedido
                </button>
              )}
            </div>

            {/* progresso — só amigos */}
            {profile.stats ? (
              <div className="animate-in mt-5 grid grid-cols-2 gap-3">
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold">{profile.stats.streak} 🔥</div>
                  <div className="text-xs uppercase tracking-wide text-muted">Streak</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold">{profile.stats.daysOnPlan7d}/7</div>
                  <div className="text-xs uppercase tracking-wide text-muted">Dias no plano</div>
                </Card>
              </div>
            ) : (
              <p className="animate-in mt-5 rounded-2xl bg-surface px-4 py-3 text-center text-sm text-muted">
                Fica amigo para veres o progresso.
              </p>
            )}

            {profile.badges.length > 0 && (
              <section className="animate-in mt-5">
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Conquistas</h2>
                  <button onClick={() => setShowBadges(true)} className="press text-sm font-semibold text-accent">
                    Ver todas ›
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.badges.slice(0, 6).map((k) => {
                    const b = BADGES[k]
                    if (!b) return null
                    return (
                      <span key={k} title={b.description} className="animate-pop flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium">
                        <span aria-hidden>{b.emoji}</span> {b.title}
                      </span>
                    )
                  })}
                </div>
              </section>
            )}

            {profile.mutualFriends && profile.mutualFriends.length > 0 && (
              <section className="animate-in mt-5">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  Amigos em comum · {profile.mutualFriends.length}
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-1 scroll-contain">
                  {profile.mutualFriends.map((m) => (
                    <button
                      key={m.userId}
                      onClick={() => onOpenProfile?.(m.username)}
                      className="press w-16 shrink-0 text-center"
                    >
                      <Avatar avatar={m.avatar} avatarPhoto={m.avatarPhoto} size={48} />
                      <div className="mt-1 truncate text-[11px] text-muted">@{m.username}</div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {profile.recentEvents && profile.recentEvents.length > 0 && (
              <section className="animate-in mt-5">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Actividade recente</h2>
                <Card className="divide-y divide-line">
                  {profile.recentEvents.map((e) => (
                    <div key={e.id} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm">{eventLine(e)}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">{e.refDate.slice(5)}</span>
                    </div>
                  ))}
                </Card>
              </section>
            )}

            {profile.friendship === 'friends' && (
              <button
                onClick={() => void act(async () => { await social.removeFriend(profile.userId); onClose() })}
                disabled={busy}
                className="press mt-6 w-full rounded-full px-6 py-3 text-sm font-medium text-critical disabled:opacity-50"
              >
                Remover amigo
              </button>
            )}

            {error && <p role="alert" className="mt-3 text-center text-sm text-critical">{error}</p>}
          </>
        )}
      </div>

      {showBadges && profile && (
        <BadgeGrid earned={profile.badges} onClose={() => setShowBadges(false)} />
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
      setMsg('Toque enviado 👋')
    } catch {
      setState('error')
      setMsg('Já deste um toque há pouco.')
    }
    setTimeout(() => setState('idle'), 2500)
  }

  if (state !== 'idle') {
    return <p className={`text-center text-sm ${state === 'sent' ? 'text-good' : 'text-muted'}`}>{msg}</p>
  }

  return (
    <div>
      <button
        onClick={() => { haptic(10); setOpen((o) => !o) }}
        className="press w-full rounded-full bg-accent-soft px-6 py-3 font-semibold text-accent"
      >
        Dar um toque
      </button>
      {open && (
        <div className="animate-pop mt-2 grid grid-cols-2 gap-2">
          {NUDGES.map((n) => (
            <button
              key={n.kind}
              onClick={() => void send(n.kind)}
              className="press rounded-xl bg-surface px-3 py-2.5 text-sm font-medium"
            >
              <span aria-hidden>{n.emoji}</span> {n.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
