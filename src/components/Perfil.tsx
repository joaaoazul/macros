import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Profile } from '../types'
import { api, ApiError } from '../lib/api'
import { clearAnthropicKey, getAnthropicKey, setAnthropicKey } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { ACTIVITY_LEVELS, GOALS, bmi, bmr, computeTargets } from '../lib/calc'
import { clearLocalCache } from '../lib/sync'
import { getPushState, subscribeToPush, unsubscribeFromPush, type PushState } from '../lib/push'
import { social, type SocialMe } from '../lib/social'
import PesoDetail from './details/PesoDetail'
import Avatar from './social/Avatar'
import EditProfileSheet from './social/EditProfileSheet'
import { Card, LargeTitle } from './ui'

interface Props {
  profile: Profile
  setProfile: (p: Profile) => void
}

export default function Perfil({ profile, setProfile }: Props) {
  const [weight, setWeight] = useState(String(profile.weightKg))
  const [waterMl, setWaterMl] = useState(String(profile.targets.waterMl))
  const [showPeso, setShowPeso] = useState(false)

  const goalInfo = GOALS.find((g) => g.value === profile.goal)
  const activityInfo = ACTIVITY_LEVELS.find((a) => a.value === profile.activity)
  const tmb = Math.round(bmr(profile.sex, profile.weightKg, profile.heightCm, profile.age))
  const imc = bmi(profile.weightKg, profile.heightCm)

  const recompute = (patch: Partial<Pick<Profile, 'weightKg' | 'goal' | 'activity'>>) => {
    const next = { ...profile, ...patch }
    const targets = computeTargets(next.sex, next.weightKg, next.heightCm, next.age, next.activity, next.goal)
    setProfile({ ...next, targets })
    setWaterMl(String(targets.waterMl))
  }

  const updateWeight = () => {
    const w = Number(weight)
    if (!(w >= 35 && w <= 250) || w === profile.weightKg) return
    recompute({ weightKg: w })
  }

  const updateWater = () => {
    const ml = Number(waterMl)
    if (!(ml >= 500 && ml <= 8000) || ml === profile.targets.waterMl) return
    setProfile({ ...profile, targets: { ...profile.targets, waterMl: ml } })
  }

  return (
    <div>
      <LargeTitle title={profile.name} subtitle="Perfil" />

      <div className="space-y-3.5 px-4 pt-2">
      {/* acesso SOC (só admins) */}
      <AdminAccessCard />

      {/* perfil social */}
      <SocialProfileCard />

      {/* dados base */}
      <Card className="p-5">
        <div className="grid grid-cols-3 divide-x divide-line text-center">
          <div>
            <div className="text-xl font-bold text-carbs">{profile.heightCm}</div>
            <div className="text-xs uppercase tracking-wide text-muted">Altura</div>
          </div>
          <div>
            <div className="text-xl font-bold text-protein">{profile.sex === 'M' ? 'Homem' : 'Mulher'}</div>
            <div className="text-xs uppercase tracking-wide text-muted">Género</div>
          </div>
          <div>
            <div className="text-xl font-bold text-good">{profile.age}</div>
            <div className="text-xs uppercase tracking-wide text-muted">Idade</div>
          </div>
        </div>
        <div className="mt-4 border-t border-line pt-3 text-center">
          <div className="font-bold">{activityInfo?.label}</div>
          <div className="text-xs uppercase tracking-wide text-muted">Nível de atividade</div>
        </div>
        <div className="mt-3 border-t border-line pt-3 text-center">
          <div className="font-bold">{goalInfo?.label}</div>
          <div className="text-xs uppercase tracking-wide text-muted">Objetivo</div>
        </div>
      </Card>
        {/* peso */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-xl" aria-hidden>
              ⚖️
            </span>
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Peso</div>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-24 rounded-lg bg-bg px-3 py-1.5 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                  aria-label="Peso em kg"
                />
                <span className="self-center text-lg font-bold">kg</span>
                <button
                  onClick={updateWeight}
                  disabled={Number(weight) === profile.weightKg || !(Number(weight) >= 35 && Number(weight) <= 250)}
                  className="ml-auto rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
                >
                  Atualizar
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowPeso(true)}
            className="mt-3 flex w-full items-center justify-between border-t border-line pt-3 text-left text-sm font-semibold text-accent"
          >
            Ver histórico <span className="text-muted">›</span>
          </button>
        </Card>

        {/* métricas */}
        <Card className="divide-y divide-line">
          <MetricRow emoji="🔥" label="TMB (metabolismo basal)" value={`${tmb.toLocaleString('pt-PT')} kcal`} />
          <MetricRow emoji="📐" label="IMC" value={imc.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} hint={imcClass(imc)} />
          <div className="flex items-center gap-4 p-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-xl" aria-hidden>
              💧
            </span>
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Meta de água</div>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={waterMl}
                  onChange={(e) => setWaterMl(e.target.value)}
                  className="w-28 rounded-lg bg-bg px-3 py-1.5 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                  aria-label="Meta de água em ml"
                />
                <span className="self-center text-lg font-bold">ml</span>
                <button
                  onClick={updateWater}
                  disabled={Number(waterMl) === profile.targets.waterMl || !(Number(waterMl) >= 500 && Number(waterMl) <= 8000)}
                  className="ml-auto rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
                >
                  Atualizar
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* objetivo */}
        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">Objetivo</h2>
          <div className="mt-3 space-y-2">
            {GOALS.map((g) => (
              <button
                key={g.value}
                onClick={() => recompute({ goal: g.value })}
                className={`block w-full rounded-xl border px-4 py-2.5 text-left text-sm ${
                  profile.goal === g.value ? 'border-accent bg-accent-soft font-semibold' : 'border-transparent bg-bg'
                }`}
              >
                <span aria-hidden>{g.emoji}</span> {g.label} <span className="text-muted">· {g.hint}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* atividade */}
        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">Nível de atividade</h2>
          <div className="mt-3 space-y-2">
            {ACTIVITY_LEVELS.map((a) => (
              <button
                key={a.value}
                onClick={() => recompute({ activity: a.value })}
                className={`block w-full rounded-xl border px-4 py-2.5 text-left text-sm ${
                  profile.activity === a.value ? 'border-accent bg-accent-soft font-semibold' : 'border-transparent bg-bg'
                }`}
              >
                {a.label} <span className="text-muted">· {a.hint}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* notificações push */}
        <NotificationsCard />

        {/* chave IA */}
        <ApiKeyCard />

        {/* conta */}
        <ContaCard />
      </div>

      {showPeso && (
        <PesoDetail
          profile={profile}
          onWeightToday={(kg) => {
            setWeight(String(kg))
            if (kg !== profile.weightKg) recompute({ weightKg: kg })
          }}
          onClose={() => setShowPeso(false)}
        />
      )}
    </div>
  )
}

/** Atalho para a consola SOC — visível apenas a administradores. */
function AdminAccessCard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  if (!user?.is_admin) return null
  return (
    <button
      onClick={() => navigate('/admin')}
      className="flex w-full items-center gap-4 rounded-card bg-[#111a23] p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(56,189,248,0.12)] text-xl" aria-hidden>🛡️</span>
      <div className="flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-[#6a7b8b]">Segurança</div>
        <div className="font-semibold text-[#cbd6e2]">Consola SOC</div>
      </div>
      <span className="text-[#6a7b8b]">›</span>
    </button>
  )
}

/** Ativar/desativar notificações push (Web Push). */
function NotificationsCard() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getPushState().then(setState)
  }, [])

  const toggle = async () => {
    setBusy(true)
    setError('')
    try {
      setState(state === 'on' ? await unsubscribeFromPush() : await subscribeToPush())
    } catch {
      setError('Não foi possível alterar as notificações.')
    } finally {
      setBusy(false)
    }
  }

  const canToggle = state === 'on' || state === 'off'

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-xl" aria-hidden>🔔</span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Notificações</div>
          <div className="text-sm text-ink-2">
            {state === 'on' && 'Ativas — recebes avisos de mensagens e amizades.'}
            {state === 'off' && 'Ativa para receber mensagens e pedidos de amizade.'}
            {state === 'denied' && 'Bloqueadas — autoriza nas definições do navegador.'}
            {state === 'ios-needs-install' && 'No iPhone, adiciona a app ao ecrã inicial primeiro.'}
            {state === 'unsupported' && 'Este dispositivo não suporta notificações push.'}
            {state === null && 'A verificar…'}
          </div>
        </div>
        {canToggle && (
          <button
            onClick={toggle}
            disabled={busy}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-40 ${
              state === 'on' ? 'bg-bg text-critical' : 'bg-accent text-white'
            }`}
          >
            {busy ? '…' : state === 'on' ? 'Desativar' : 'Ativar'}
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-medium text-critical">{error}</p>}
    </Card>
  )
}

/** Cartão do perfil social: avatar/username/bio + acesso à edição. */
function SocialProfileCard() {
  const [me, setMe] = useState<SocialMe | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    social.me().then(setMe).catch(() => setMe(null))
  }, [])

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <Avatar avatar={me?.avatar ?? '🙂'} avatarPhoto={me?.avatarPhoto} size={56} />
        <div className="min-w-0 flex-1">
          {me?.username ? (
            <>
              <div className="truncate font-semibold">@{me.username}</div>
              {me.bio ? (
                <div className="truncate text-sm text-muted">{me.bio}</div>
              ) : (
                <div className="text-sm text-muted">Sem bio</div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted">Ainda sem perfil social</div>
          )}
        </div>
      </div>
      <button
        onClick={() => setEditing(true)}
        disabled={!me}
        className="mt-3 flex w-full items-center justify-between border-t border-line pt-3 text-left text-sm font-semibold text-accent disabled:opacity-40"
      >
        {me?.username ? 'Editar perfil' : 'Criar perfil social'} <span className="text-muted">›</span>
      </button>

      {editing && me && (
        <EditProfileSheet
          me={me}
          onSaved={(updated) => {
            setMe(updated)
            setEditing(false)
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </Card>
  )
}

/** Chave Anthropic (BYOK) para a análise de refeições por IA — só em localStorage. */
function ApiKeyCard() {
  const [saved, setSaved] = useState(() => getAnthropicKey())
  const [input, setInput] = useState('')
  const [show, setShow] = useState(false)

  const masked = saved ? `${saved.slice(0, 10)}…${saved.slice(-4)}` : ''
  const looksValid = input.trim().startsWith('sk-ant-') && input.trim().length >= 20

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-xl" aria-hidden>
          ✨
        </span>
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Análise de refeições por IA</div>
          {saved ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-sm">{masked}</span>
              <button
                onClick={() => {
                  clearAnthropicKey()
                  setSaved(null)
                }}
                className="ml-auto rounded-full bg-bg px-3 py-1.5 text-sm font-medium text-critical"
              >
                Remover
              </button>
            </div>
          ) : (
            <div className="mt-1 flex gap-2">
              <input
                type={show ? 'text' : 'password'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="sk-ant-…"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg bg-bg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label="Chave da API Anthropic"
              />
              <button onClick={() => setShow((s) => !s)} className="text-sm text-muted" aria-label={show ? 'Ocultar chave' : 'Mostrar chave'}>
                {show ? '🙈' : '👁️'}
              </button>
              <button
                onClick={() => {
                  setAnthropicKey(input.trim())
                  setSaved(input.trim())
                  setInput('')
                }}
                disabled={!looksValid}
                className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                Guardar
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        A chave fica guardada só neste dispositivo e nunca é armazenada no servidor. Cria uma em console.anthropic.com.
      </p>
    </Card>
  )
}

/** Sessão, exportação GDPR e eliminação de conta. */
function ContaCard() {
  const { user, logout, clearSession } = useAuth()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const doLogout = async () => {
    await logout()
    clearLocalCache()
    navigate('/login', { replace: true })
  }

  const doExport = async () => {
    try {
      const resp = await fetch('/api/v1/gdpr/export', {
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'fetch' },
      })
      if (!resp.ok) throw new Error()
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'macros-dados.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Não foi possível exportar os dados.')
    }
  }

  const doDelete = async () => {
    setBusy(true)
    setError('')
    try {
      await api('/gdpr/account', { method: 'DELETE', body: { password } })
      clearLocalCache()
      clearSession()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível eliminar a conta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-2 divide-y divide-line">
      <div className="p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Conta</div>
        <div className="mt-0.5 font-medium">{user?.email}</div>
      </div>
      <button onClick={doExport} className="block w-full p-4 text-left text-sm font-medium text-accent">
        Exportar os meus dados (JSON)
      </button>
      <button onClick={doLogout} className="block w-full p-4 text-left text-sm font-medium text-accent">
        Terminar sessão
      </button>
      <div className="p-4">
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="text-sm font-medium text-critical">
            Eliminar conta…
          </button>
        ) : (
          <div>
            <p className="text-sm text-ink-2">
              Isto elimina a tua conta e todos os dados dos nossos servidores, permanentemente. Confirma com a
              tua password.
            </p>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="A tua password"
              className="mt-3 w-full rounded-xl bg-bg px-4 py-2.5 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-critical"
              aria-label="Password para confirmar eliminação"
            />
            {error && (
              <p role="alert" className="mt-2 text-sm font-medium text-critical">{error}</p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={doDelete}
                disabled={busy || password.length === 0}
                className="rounded-full bg-critical px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? 'A eliminar…' : 'Sim, eliminar tudo'}
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false)
                  setPassword('')
                  setError('')
                }}
                className="rounded-full bg-bg px-4 py-2 text-sm font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

function MetricRow({ emoji, label, value, hint }: { emoji: string; label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center gap-4 p-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-xl" aria-hidden>
        {emoji}
      </span>
      <div className="flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
        <div className="text-xl font-bold">
          {value}
          {hint && <span className="ml-2 text-sm font-normal text-muted">{hint}</span>}
        </div>
      </div>
    </div>
  )
}

function imcClass(v: number): string {
  if (v < 18.5) return 'abaixo do peso'
  if (v < 25) return 'peso normal'
  if (v < 30) return 'excesso de peso'
  return 'obesidade'
}
