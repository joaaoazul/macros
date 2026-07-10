import { useState } from 'react'
import { withWaterTarget } from './lib/calc'
import { useAuth } from './lib/auth'
import { useSyncedData } from './lib/sync'
import Onboarding from './components/Onboarding'
import Diario from './components/Diario'
import Metas from './components/Metas'
import Progresso from './components/Progresso'
import Perfil from './components/Perfil'
import { IconBook, IconChart, IconPerson, IconTarget } from './components/ui'

type Tab = 'diario' | 'metas' | 'progresso' | 'perfil'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'diario', label: 'Diário', icon: <IconBook /> },
  { id: 'metas', label: 'Metas', icon: <IconTarget /> },
  { id: 'progresso', label: 'Progresso', icon: <IconChart /> },
  { id: 'perfil', label: 'Perfil', icon: <IconPerson /> },
]

export default function App() {
  const { user } = useAuth()
  const data = useSyncedData(user!.id)
  const [tab, setTab] = useState<Tab>('diario')

  const {
    loading, migrationAvailable, importLocalData, dismissMigration,
    profile: rawProfile, setProfile, diary, setDiary,
    water, setWater, exercise, setExercise, customFoods, setCustomFoods,
  } = data

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
        {tab === 'diario' && (
          <Diario
            profile={profile}
            diary={diary}
            setDiary={setDiary}
            water={water}
            setWater={setWater}
            exercise={exercise}
            setExercise={setExercise}
            customFoods={customFoods}
            setCustomFoods={setCustomFoods}
          />
        )}
        {tab === 'metas' && <Metas profile={profile} setProfile={setProfile} />}
        {tab === 'progresso' && <Progresso profile={profile} diary={diary} />}
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
              className={`flex flex-1 flex-col items-center gap-0.5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[11px] font-medium transition-colors ${
                tab === t.id ? 'text-accent' : 'text-muted'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>
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
