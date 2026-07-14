import { useState } from 'react'
import type { MealId, RecipeItem } from './types'
import { withWaterTarget } from './lib/calc'
import { api, ApiError } from './lib/api'
import { entryFromRecipeItem } from './lib/recipes'
import { todayISO } from './lib/store'
import { useAuth } from './lib/auth'
import { useSyncedData } from './lib/sync'
import { useSocialSocket } from './lib/ws'
import Onboarding from './components/Onboarding'
import Diario from './components/Diario'
import Metas from './components/Metas'
import Progresso from './components/Progresso'
import Receitas from './components/Receitas'
import Perfil from './components/Perfil'
import Social from './components/social/Social'
import { IconBook, IconChart, IconPeople, IconPerson, IconRecipe, IconTarget } from './components/ui'

type Tab = 'diario' | 'metas' | 'progresso' | 'receitas' | 'social' | 'perfil'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'diario', label: 'Diário', icon: <IconBook /> },
  { id: 'metas', label: 'Metas', icon: <IconTarget /> },
  { id: 'progresso', label: 'Progresso', icon: <IconChart /> },
  { id: 'receitas', label: 'Receitas', icon: <IconRecipe /> },
  { id: 'social', label: 'Social', icon: <IconPeople /> },
  { id: 'perfil', label: 'Perfil', icon: <IconPerson /> },
]

export default function App() {
  const { user } = useAuth()
  const data = useSyncedData(user!.id)
  const [tab, setTab] = useState<Tab>('diario')
  const socket = useSocialSocket(true)

  const {
    loading, migrationAvailable, importLocalData, dismissMigration,
    profile: rawProfile, setProfile, diary, setDiary,
    water, setWater, exercise, setExercise, customFoods, setCustomFoods,
    recipes, setRecipes, mealPlan, setMealPlan, pantry, setPantry,
  } = data

  /** Regista os itens de uma receita na refeição escolhida, no dia de hoje. */
  const logRecipeToday = (items: RecipeItem[], meal: MealId) => {
    const today = todayISO()
    const entries = items.map((i) => entryFromRecipeItem(i, meal))
    setDiary((d) => ({ ...d, [today]: [...(d[today] ?? []), ...entries] }))
    setTab('diario')
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-muted">
        <span aria-hidden className="animate-pulse text-3xl">🥗</span>
      </div>
    )
  }

  if (migrationAvailable) {
    return <MigrationPrompt onImport={importLocalData} onDismiss={dismissMigration} />
  }

  if (!rawProfile) {
    return <Onboarding onDone={setProfile} />
  }
  const profile = withWaterTarget(rawProfile)

  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto max-w-md pb-28">
        {user?.email_verified === false && <EmailBanner />}
        {tab === 'diario' && (
          <Diario
            profile={profile}
            setProfile={setProfile}
            diary={diary}
            setDiary={setDiary}
            water={water}
            setWater={setWater}
            exercise={exercise}
            setExercise={setExercise}
            customFoods={customFoods}
            setCustomFoods={setCustomFoods}
            recipes={recipes}
            setRecipes={setRecipes}
          />
        )}
        {tab === 'metas' && <Metas profile={profile} setProfile={setProfile} />}
        {tab === 'progresso' && <Progresso profile={profile} diary={diary} water={water} exercise={exercise} />}
        {tab === 'receitas' && (
          <Receitas
            recipes={recipes}
            setRecipes={setRecipes}
            customFoods={customFoods}
            mealPlan={mealPlan}
            setMealPlan={setMealPlan}
            pantry={pantry}
            setPantry={setPantry}
            onLog={logRecipeToday}
          />
        )}
        {tab === 'social' && <Social socket={socket} />}
        {tab === 'perfil' && <Perfil profile={profile} setProfile={setProfile} />}
      </div>

      {/* tab bar translúcida ao estilo iOS */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-line/70 bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[11px] font-medium transition-colors ${
                tab === t.id ? 'text-accent' : 'text-muted'
              }`}
            >
              <span className={`transition-transform duration-200 ${tab === t.id ? 'scale-110' : ''}`}>{t.icon}</span>
              {t.label}
              {t.id === 'social' && socket.unread + socket.notifUnread > 0 && (
                <span
                  className="animate-pop absolute right-[calc(50%-1.5rem)] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[9px] font-bold text-white"
                  aria-label={`${socket.unread + socket.notifUnread} novidades por ver`}
                >
                  {socket.unread + socket.notifUnread > 99 ? '99+' : socket.unread + socket.notifUnread}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

/** Aviso de email não confirmado, com reenvio; dispensável por sessão. */
function EmailBanner() {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('macros.emailBannerDismissed') === '1')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  if (dismissed) return null

  const resend = async () => {
    setState('sending')
    try {
      await api('/auth/resend-verification', { method: 'POST' })
      setState('sent')
    } catch (err) {
      setMessage(
        err instanceof ApiError && err.status === 429
          ? 'Já pedimos há pouco — verifica a caixa de entrada e o spam.'
          : 'Não foi possível reenviar. Tenta mais tarde.',
      )
      setState('error')
    }
  }

  return (
    <div className="mx-4 mt-4 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
      <div className="flex items-start gap-2">
        <span aria-hidden>✉️</span>
        <div className="flex-1">
          <p className="font-medium">O teu email ainda não foi confirmado.</p>
          {state === 'sent' ? (
            <p className="mt-0.5">Enviado ✓ — verifica a caixa de entrada.</p>
          ) : (
            <button onClick={resend} disabled={state === 'sending'} className="mt-0.5 font-semibold underline disabled:opacity-50">
              {state === 'sending' ? 'A enviar…' : 'Reenviar email de confirmação'}
            </button>
          )}
          {state === 'error' && <p className="mt-0.5">{message}</p>}
        </div>
        <button
          onClick={() => {
            sessionStorage.setItem('macros.emailBannerDismissed', '1')
            setDismissed(true)
          }}
          className="px-1 text-amber-900/60 dark:text-amber-200/60"
          aria-label="Dispensar aviso"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

/** Dados locais de antes da conta detetados — importar ou começar do zero. */
function MigrationPrompt({ onImport, onDismiss }: { onImport: () => Promise<void>; onDismiss: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const doImport = async () => {
    setBusy(true)
    setError(false)
    try {
      await onImport()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center bg-bg px-6">
      <div className="rounded-card bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h1 className="text-2xl font-bold tracking-tight">Dados encontrados 📦</h1>
        <p className="mt-2 text-ink-2">
          Encontrámos registos guardados neste dispositivo de antes de teres conta. Queres importá-los para a
          tua conta?
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-critical">
            Não foi possível importar. Verifica a ligação e tenta novamente.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={doImport}
            disabled={busy}
            className="rounded-full bg-accent px-6 py-3.5 font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
          >
            {busy ? 'A importar…' : 'Importar para a minha conta'}
          </button>
          <button onClick={onDismiss} disabled={busy} className="rounded-full bg-bg px-6 py-3.5 font-semibold text-ink-2">
            Começar do zero
          </button>
        </div>
      </div>
    </div>
  )
}
