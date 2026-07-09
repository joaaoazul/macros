import { useState } from 'react'
import type { Diary, ExerciseLog, Food, Profile, WaterLog } from './types'
import { usePersistedState } from './lib/store'
import { withWaterTarget } from './lib/calc'
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
  const [rawProfile, setProfile] = usePersistedState<Profile | null>('macros.profile', null)
  const [diary, setDiary] = usePersistedState<Diary>('macros.diary', {})
  const [water, setWater] = usePersistedState<WaterLog>('macros.water', {})
  const [exercise, setExercise] = usePersistedState<ExerciseLog>('macros.exercise', {})
  const [customFoods, setCustomFoods] = usePersistedState<Food[]>('macros.customFoods', [])
  const [tab, setTab] = useState<Tab>('diario')

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
        {tab === 'perfil' && (
          <Perfil
            profile={profile}
            setProfile={setProfile}
            onReset={() => {
              setProfile(null)
              setDiary({})
              setWater({})
              setExercise({})
              setCustomFoods([])
              setTab('diario')
            }}
          />
        )}
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
