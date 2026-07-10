import { useState } from 'react'
import { getApiKey, setApiKey } from '../lib/ai'
import { todayISO, usePersistedState } from '../lib/store'
import { deleteAccount, forgotPassword, getAuth, getFeed, listRequests, login, logout, pendingCount, requestFriend, resetPassword, respondRequest, searchUsers, setShareStats, setUsername, socialMe, syncNow, unfriendUser, type FeedEntry } from '../lib/sync'
import type { Diary, ExerciseLog, Food, Profile, WaterLog, WeightLog } from '../types'
import { MEALS } from '../types'
import { ACTIVITY_LEVELS, GOALS, bmi, bmr, computeTargets } from '../lib/calc'
import { Card, LargeTitle } from './ui'

interface Props {
  profile: Profile
  setProfile: (p: Profile) => void
  weightLog: WeightLog
  setWeightLog: React.Dispatch<React.SetStateAction<WeightLog>>
  allData: { diary: Diary; water: WaterLog; exercise: ExerciseLog; customFoods: Food[]; weightLog: WeightLog }
  onReset: () => void
}

export default function Perfil({ profile, setProfile, weightLog, setWeightLog, allData, onReset }: Props) {
  const [weight, setWeight] = useState(String(profile.weightKg))
  const [waterMl, setWaterMl] = useState(String(profile.targets.waterMl))
  const [confirmReset, setConfirmReset] = useState(false)
  const [apiKey, setApiKeyState] = useState(getApiKey())
  const [keySaved, setKeySaved] = useState(false)
  const [reminders, setReminders] = usePersistedState<boolean>('macros.waterReminders', false)

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
    setWeightLog((log) => ({ ...log, [todayISO()]: w }))
  }

  const updateWater = () => {
    const ml = Number(waterMl)
    if (!(ml >= 500 && ml <= 8000) || ml === profile.targets.waterMl) return
    setProfile({ ...profile, targets: { ...profile.targets, waterMl: ml } })
  }

  const download = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportJSON = () => {
    download(`macros-${todayISO()}.json`, JSON.stringify({ profile, ...allData }, null, 2), 'application/json')
  }

  const exportCSV = () => {
    const mealLabel = (id: string) => MEALS.find((m) => m.id === id)?.label ?? id
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const rows = [['data', 'refeicao', 'alimento', 'quantidade', 'unidade', 'kcal', 'proteina_g', 'hidratos_g', 'gordura_g'].join(';')]
    for (const [date, entries] of Object.entries(allData.diary).sort()) {
      for (const e of entries) {
        rows.push([date, esc(mealLabel(e.meal)), esc(e.foodName), e.grams, e.unit, Math.round(e.kcal), Math.round(e.protein), Math.round(e.carbs), Math.round(e.fat)].join(';'))
      }
    }
    download(`macros-diario-${todayISO()}.csv`, '\uFEFF' + rows.join('\n'), 'text/csv;charset=utf-8')
  }

  const toggleReminders = async () => {
    if (reminders) {
      setReminders(false)
      return
    }
    if (typeof Notification === 'undefined') return
    const perm = await Notification.requestPermission()
    if (perm === 'granted') setReminders(true)
  }

  const weightCount = Object.keys(weightLog).length

  return (
    <div>
      <LargeTitle title={profile.name} subtitle="Perfil" />

      <div className="space-y-3.5 px-4 pt-2">
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
                  className="ml-auto rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity active:opacity-80 disabled:opacity-40"
                >
                  Atualizar
                </button>
              </div>
            </div>
          </div>
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
                  className="ml-auto rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity active:opacity-80 disabled:opacity-40"
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


        {/* conta e sincronização */}
        <AccountCard />

        {/* amigos */}
        {getAuth() && <FriendsCard />}

        {/* lembretes de água */}
        <Card className="flex items-center gap-4 p-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-xl" aria-hidden>
            🔔
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-bold">Lembretes de água</div>
            <div className="text-xs text-muted">A cada 2 h (9h–21h), com a app aberta e abaixo da meta.</div>
          </div>
          <button
            onClick={toggleReminders}
            role="switch"
            aria-checked={reminders}
            aria-label="Lembretes de água"
            className={`h-8 w-14 shrink-0 rounded-full p-1 transition-colors ${reminders ? 'bg-accent' : 'bg-line'}`}
          >
            <span className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${reminders ? 'translate-x-6' : ''}`} />
          </button>
        </Card>

        {/* inteligência artificial */}
        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">🤖 Inteligência artificial</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Para a análise de pratos por foto (botão 📸 na pesquisa) precisas de uma chave da API da Anthropic
            (console.anthropic.com). Fica guardada apenas neste dispositivo; cada análise custa cêntimos, pagos diretamente à Anthropic.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKeyState(e.target.value)
                setKeySaved(false)
              }}
              placeholder="sk-ant-…"
              autoComplete="off"
              className="w-full rounded-xl bg-bg px-4 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Chave API da Anthropic"
            />
            <button
              onClick={() => {
                setApiKey(apiKey)
                setKeySaved(true)
              }}
              disabled={keySaved}
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-40"
            >
              {keySaved ? 'Guardada ✓' : 'Guardar'}
            </button>
          </div>
        </Card>

        {/* exportar dados */}
        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">📤 Exportar dados</h2>
          <p className="mt-1 text-xs text-muted">
            Faz uma cópia de segurança ou leva o diário para uma folha de cálculo. {weightCount > 0 && `Inclui ${weightCount} registos de peso.`}
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={exportCSV} className="flex-1 rounded-full bg-accent-soft px-4 py-2.5 text-sm font-bold text-accent">
              CSV (diário)
            </button>
            <button onClick={exportJSON} className="flex-1 rounded-full bg-accent-soft px-4 py-2.5 text-sm font-bold text-accent">
              JSON (tudo)
            </button>
          </div>
        </Card>

        {/* guia de nutrição */}
        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">📚 Guia de nutrição</h2>
          <p className="mt-1 text-xs text-muted">Mini-artigos para tirares mais partido do tracking.</p>
          <div className="mt-3 divide-y divide-line">
            {GUIDE.map((g) => (
              <GuideItem key={g.q} q={g.q} a={g.a} />
            ))}
          </div>
        </Card>

        {/* sobre */}
        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">Sobre a app</h2>
          <div className="mt-3 space-y-2.5 text-[13.5px] leading-relaxed text-ink-2">
            <p>
              <strong className="text-ink">Macros</strong> · versão 1.0 — tracker de nutrição pessoal, feito à medida.
            </p>
            <p>
              🔒 <strong className="text-ink">Privacidade total:</strong> todos os dados ficam guardados apenas neste dispositivo. Não há contas, servidores nem análise de dados.
            </p>
            <p>
              🛒 Dados de produtos por <strong className="text-ink">Open Food Facts</strong> (base de dados aberta, licença ODbL) — obrigado à comunidade que a mantém.
            </p>
            <p>
              🧮 Alvos calculados com a equação de <strong className="text-ink">Mifflin-St Jeor</strong>; proteína por kg de peso conforme o objetivo, gordura a 25% das kcal, hidratos com o restante.
            </p>
            <p>
              🛡️ <strong className="text-ink">Privacidade (RGPD):</strong> sem conta, nada sai do dispositivo. Com conta, guardamos apenas o email
              (com password encriptada) e os teus registos, exclusivamente para sincronização — nunca para publicidade ou análise. Tens direito de
              acesso e portabilidade (Exportar dados), retificação (edita na app) e apagamento ("Eliminar conta no servidor" apaga tudo,
              de imediato e sem cópias). A partilha de estatísticas com amigos está desligada por omissão e limita-se a streak e dias registados —
              nunca calorias, peso ou refeições.
            </p>
            <p className="text-muted">
              ⚠️ Esta app é uma ferramenta de registo e não substitui aconselhamento médico ou de um nutricionista. Se tens condições de saúde ou historial de distúrbios alimentares, fala primeiro com um profissional.
            </p>
          </div>
        </Card>

        {/* zona de perigo */}
        <Card className="mb-2 p-5">
          {!confirmReset ? (
            <div className="space-y-2">
              <button onClick={() => setConfirmReset(true)} className="block text-sm font-medium text-critical">
                Apagar todos os dados…
              </button>
              {getAuth() && (
                <button
                  onClick={async () => {
                    if (!confirm('Eliminar a conta apaga TODOS os teus dados no servidor (RGPD — direito ao apagamento). Os dados locais mantêm-se. Continuar?')) return
                    try {
                      await deleteAccount()
                      window.location.reload()
                    } catch {
                      alert('Sem ligação ao servidor — tenta mais tarde.')
                    }
                  }}
                  className="block text-sm font-medium text-critical"
                >
                  Eliminar conta no servidor…
                </button>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm text-ink-2">Isto apaga o perfil e todo o diário. Não há volta a dar.</p>
              <div className="mt-3 flex gap-2">
                <button onClick={onReset} className="rounded-full bg-critical px-4 py-2 text-sm font-semibold text-white">
                  Sim, apagar tudo
                </button>
                <button onClick={() => setConfirmReset(false)} className="rounded-full bg-bg px-4 py-2 text-sm font-medium">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
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

const GUIDE: { q: string; a: string }[] = [
  {
    q: 'O que são macros?',
    a: 'Macronutrientes são os três grandes grupos de onde vêm as calorias: proteína (4 kcal/g), hidratos de carbono (4 kcal/g) e gordura (9 kcal/g). Contar macros em vez de só calorias garante que perdes gordura (e não músculo) e que tens energia para treinar.',
  },
  {
    q: 'Quanta proteína preciso?',
    a: 'Para quem treina, a ciência aponta para 1,6–2,2 g por kg de peso corporal por dia. Em défice calórico convém ficar no topo do intervalo (≈2,2 g/kg) para proteger a massa muscular. Distribui por 3–5 refeições com 25–40 g cada.',
  },
  {
    q: 'Défice, manutenção e superavit',
    a: 'Perder gordura exige comer menos do que gastas (défice, tipicamente 10–25%); ganhar músculo é mais eficiente com um pequeno excedente (5–15%). Mudanças de peso sustentáveis rondam 0,25–0,75 kg por semana — mais rápido do que isso costuma custar músculo ou aderência.',
  },
  {
    q: 'A gordura não é o inimigo',
    a: 'Gordura alimentar é essencial para hormonas e absorção de vitaminas (A, D, E, K). Não desças de ~0,6 g/kg/dia por longos períodos. Prefere fontes como azeite, peixe gordo, ovos, frutos secos e abacate.',
  },
  {
    q: 'Como ler um rótulo',
    a: 'Compara sempre por 100 g e não por porção (as porções variam para parecer menos calórico). Olha primeiro para calorias, proteína e açúcares. Listas de ingredientes curtas e reconhecíveis são geralmente melhor sinal do que alegações na frente da embalagem.',
  },
  {
    q: 'Água e desempenho',
    a: 'Mesmo 2% de desidratação reduz o desempenho físico e mental. A referência de ~35 ml/kg/dia sobe com calor e treino. Urina amarelo-claro é o indicador prático mais fiável.',
  },
  {
    q: 'Consistência > perfeição',
    a: 'O tracking funciona pela média semanal, não pelo dia perfeito. Um dia acima do alvo não estraga nada — volta ao plano na refeição seguinte. Registar todos os dias (mesmo os maus) é o que gera resultados; é para isso que serve a chama 🔥 no ecrã inicial.',
  },
]

function GuideItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 py-3 text-left" aria-expanded={open}>
        <span className="text-[14.5px] font-bold">{q}</span>
        <span className={`text-muted transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden>
          ›
        </span>
      </button>
      {open && <p className="pb-3 text-[13.5px] leading-relaxed text-ink-2">{a}</p>}
    </div>
  )
}

function AccountCard() {
  const [auth, setAuthState] = useState(getAuth())
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [synced, setSynced] = useState(false)
  const [forgot, setForgot] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await login(email.trim(), password, mode === 'register')
      setAuthState(getAuth())
      // remonta a app para refletir dados vindos do servidor
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na ligação ao servidor.')
    } finally {
      setBusy(false)
    }
  }

  const inputCls = 'w-full rounded-xl bg-bg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <Card className="p-5">
      <h2 className="text-[17px] font-semibold">☁️ Conta e sincronização</h2>
      {auth ? (
        <div className="mt-2">
          <p className="text-[13.5px] text-ink-2">
            Sessão iniciada como <strong className="text-ink">{auth.email}</strong>. Os teus dados sincronizam entre dispositivos.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={async () => {
                setBusy(true)
                try {
                  const touched = await syncNow()
                  setSynced(true)
                  setTimeout(() => setSynced(false), 2500)
                  if (touched) window.location.reload()
                } catch {
                  setError('Sem ligação ao servidor.')
                } finally {
                  setBusy(false)
                }
              }}
              disabled={busy}
              className="rounded-full bg-accent-soft px-4 py-2 text-sm font-bold text-accent disabled:opacity-40"
            >
              {synced ? 'Sincronizado ✓' : busy ? 'A sincronizar…' : `Sincronizar agora${pendingCount() > 0 ? ` (${pendingCount()})` : ''}`}
            </button>
            <button
              onClick={() => {
                logout()
                setAuthState(null)
              }}
              className="rounded-full px-4 py-2 text-sm font-bold text-critical"
            >
              Sair
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-critical">{error}</p>}
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-[13px] text-muted">
            Opcional — cria conta para sincronizares o diário entre o telemóvel e o computador. Sem conta, tudo continua a funcionar só neste dispositivo.
          </p>
          <div className="mt-3 flex gap-1.5">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${mode === m ? 'bg-accent text-on-accent' : 'bg-bg text-ink-2'}`}
              >
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" className={inputCls} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Password (mín. 8 caracteres)' : 'Password'}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              className={inputCls}
            />
          </div>
          {error && <p className="mt-2 text-xs text-critical">{error}</p>}
          {mode === 'login' && (
            <button onClick={() => setForgot(true)} className="mt-2 text-xs font-bold text-accent">
              Esqueci-me da password
            </button>
          )}
          <button
            onClick={submit}
            disabled={busy || !email.includes('@') || password.length < (mode === 'register' ? 8 : 1)}
            className="mt-3 w-full rounded-full bg-accent px-6 py-3 font-bold text-on-accent transition-opacity active:opacity-80 disabled:opacity-40"
          >
            {busy ? 'Aguarda…' : mode === 'login' ? 'Entrar' : 'Criar conta e sincronizar'}
          </button>
        </div>
      )}
      {forgot && <ForgotSheet onClose={() => setForgot(false)} />}
    </Card>
  )
}

function FriendsCard() {
  const [me, setMe] = useState<{ username: string | null; shareStats: boolean; followers: number } | null>(null)
  const [feed, setFeed] = useState<FeedEntry[]>([])
  const [requests, setRequests] = useState<string[]>([])
  const [nameInput, setNameInput] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<string[]>([])
  const [sent, setSent] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(false)

  const refresh = () => {
    socialMe().then(setMe).catch(() => setOffline(true))
    getFeed().then((r) => setFeed(r.feed)).catch(() => {})
    listRequests().then((r) => setRequests(r.requests)).catch(() => {})
  }
  useState(() => {
    refresh()
    return undefined
  })

  const search = async (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    try {
      const r = await searchUsers(q.trim())
      setResults(r.users.filter((u) => !feed.some((f) => f.username === u)))
    } catch {}
  }

  const inputCls = 'w-full rounded-xl bg-bg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent'
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`)

  if (offline) return null

  return (
    <Card className="p-5">
      <h2 className="text-[17px] font-semibold">👥 Amigos</h2>

      {me && !me.username && (
        <div className="mt-2">
          <p className="text-[13px] text-muted">Escolhe um username público para os teus amigos te encontrarem (3–20 caracteres: a–z, 0–9, _).</p>
          <div className="mt-3 flex gap-2">
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value.toLowerCase())} placeholder="o_teu_username" className={inputCls} />
            <button
              onClick={async () => {
                setError('')
                try {
                  await setUsername(nameInput.trim())
                  refresh()
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Erro.')
                }
              }}
              disabled={nameInput.trim().length < 3}
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-critical">{error}</p>}
        </div>
      )}

      {me?.username && (
        <div className="mt-2">
          <p className="text-[13px] text-ink-2">
            És <strong className="text-ink">@{me.username}</strong>
          </p>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[13.5px] font-bold">Partilhar as minhas estatísticas</div>
              <div className="text-[11.5px] text-muted">Só streak e dias registados — nunca calorias, peso ou refeições.</div>
            </div>
            <button
              onClick={async () => {
                const next = !me.shareStats
                await setShareStats(next).catch(() => {})
                setMe({ ...me, shareStats: next })
              }}
              role="switch"
              aria-checked={me.shareStats}
              aria-label="Partilhar estatísticas"
              className={`h-8 w-14 shrink-0 rounded-full p-1 transition-colors ${me.shareStats ? 'bg-accent' : 'bg-line'}`}
            >
              <span className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${me.shareStats ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          {requests.length > 0 && (
            <div className="mt-4">
              <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Pedidos de amizade</div>
              <ul className="mt-1.5 space-y-1.5">
                {requests.map((u) => (
                  <li key={u} className="flex items-center justify-between rounded-xl bg-accent-soft px-3 py-2">
                    <span className="text-sm font-bold">@{u}</span>
                    <span className="flex gap-1.5">
                      <button
                        onClick={async () => {
                          await respondRequest(u, true).catch(() => {})
                          refresh()
                        }}
                        className="rounded-full bg-accent px-3 py-1 text-[12.5px] font-bold text-on-accent"
                      >
                        Aceitar ✓
                      </button>
                      <button
                        onClick={async () => {
                          await respondRequest(u, false).catch(() => {})
                          refresh()
                        }}
                        className="rounded-full px-2 py-1 text-[12.5px] font-bold text-muted"
                        aria-label={`Recusar ${u}`}
                      >
                        ✕
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">🏆 Ranking da semana</div>
            <ul className="mt-1 divide-y divide-line">
              {feed.map((f, i) => (
                <li key={f.username} className={`flex items-center gap-3 py-2.5 ${f.isMe ? 'rounded-xl bg-accent-soft px-2' : ''}`}>
                  <span className="w-8 text-center text-lg" aria-hidden>
                    {medal(i)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-bold">
                      @{f.username} {f.isMe && <span className="text-[11px] font-semibold text-accent">(tu)</span>}
                    </div>
                    <div className="text-[12px] text-muted">
                      {f.stats
                        ? `${f.stats.last7}/7 dias esta semana · 🔥 ${f.stats.streak} · ${f.stats.loggedToday ? 'registou hoje ✓' : 'ainda não registou hoje'}`
                        : 'estatísticas privadas'}
                    </div>
                  </div>
                  {!f.isMe && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Remover @${f.username} dos amigos?`)) return
                        await unfriendUser(f.username).catch(() => {})
                        refresh()
                      }}
                      className="rounded-full px-2 py-1 text-xs font-bold text-muted"
                      aria-label={`Remover ${f.username}`}
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {feed.length <= 1 && <p className="mt-1 text-[12.5px] text-muted">Convida amigos para veres o ranking a compor-se!</p>}
          </div>

          <input value={query} onChange={(e) => search(e.target.value)} placeholder="Procurar amigos por username…" className={`${inputCls} mt-4`} />
          {results.length > 0 && (
            <ul className="mt-2 space-y-1">
              {results.map((u) => (
                <li key={u} className="flex items-center justify-between rounded-xl bg-bg px-3 py-2">
                  <span className="text-sm font-semibold">@{u}</span>
                  {sent[u] ? (
                    <span className="text-[12.5px] font-bold text-good">{sent[u] === 'accepted' ? 'Amigos! 🎉' : 'Pedido enviado ✓'}</span>
                  ) : (
                    <button
                      onClick={async () => {
                        try {
                          const r = await requestFriend(u)
                          setSent((m) => ({ ...m, [u]: r.status }))
                          if (r.status === 'accepted') refresh()
                        } catch {}
                      }}
                      className="rounded-full bg-accent-soft px-3 py-1 text-[12.5px] font-bold text-accent"
                    >
                      Pedir amizade
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}

/** Recuperar password: email → código enviado por email → nova password. */
export function ForgotSheet({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const inputCls = 'w-full rounded-xl bg-surface px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-[1.75rem] bg-bg px-5 pb-8 pt-2" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Recuperar password">
        <div className="mx-auto h-1 w-9 rounded-full bg-line" aria-hidden />
        <h2 className="mt-4 text-xl font-extrabold">Recuperar password</h2>

        {step === 'email' ? (
          <div className="mt-3">
            <p className="text-sm text-muted">Enviamos um código de 6 dígitos para o teu email (válido 15 minutos).</p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email da conta" className={`${inputCls} mt-3`} autoFocus />
            {error && <p className="mt-2 text-xs text-critical">{error}</p>}
            <button
              onClick={async () => {
                setBusy(true)
                setError('')
                try {
                  await forgotPassword(email.trim())
                  setStep('code')
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Erro de ligação.')
                } finally {
                  setBusy(false)
                }
              }}
              disabled={busy || !email.includes('@')}
              className="mt-4 w-full rounded-full bg-accent px-6 py-3.5 font-bold text-on-accent disabled:opacity-40"
            >
              {busy ? 'A enviar…' : 'Enviar código'}
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-muted">Verifica o email <strong className="text-ink">{email}</strong> e escreve o código.</p>
            <div className="mt-3 space-y-2">
              <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de 6 dígitos" className={inputCls} autoFocus />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nova password (mín. 8)" autoComplete="new-password" className={inputCls} />
            </div>
            {error && <p className="mt-2 text-xs text-critical">{error}</p>}
            <button
              onClick={async () => {
                setBusy(true)
                setError('')
                try {
                  await resetPassword(email.trim(), code.trim(), password)
                  window.location.reload()
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Código inválido.')
                  setBusy(false)
                }
              }}
              disabled={busy || code.trim().length !== 6 || password.length < 8}
              className="mt-4 w-full rounded-full bg-accent px-6 py-3.5 font-bold text-on-accent disabled:opacity-40"
            >
              {busy ? 'Aguarda…' : 'Definir nova password'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
