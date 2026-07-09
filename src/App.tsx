import { useState } from 'react'
import type { Diary, Food, Profile } from './types'
import { usePersistedState } from './lib/store'
import Onboarding from './components/Onboarding'
import Diario from './components/Diario'
import Progresso from './components/Progresso'
import Perfil from './components/Perfil'

type Tab = 'diario' | 'progresso' | 'perfil'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'diario', label: 'Diário', icon: '📖' },
  { id: 'progresso', label: 'Progresso', icon: '📊' },
  { id: 'perfil', label: 'Perfil', icon: '👤' },
]

export default function App() {
  const [profile, setProfile] = usePersistedState<Profile | null>('macros.profile', null)
  const [diary, setDiary] = usePersistedState<Diary>('macros.diary', {})
  const [customFoods, setCustomFoods] = usePersistedState<Food[]>('macros.customFoods', [])
  const [tab, setTab] = useState<Tab>('diario')

  if (!profile) {
    return <Onboarding onDone={setProfile} />
  }

  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto max-w-md pb-24">
        {tab === 'diario' && (
          <Diario
            profile={profile}
            diary={diary}
            setDiary={setDiary}
            customFoods={customFoods}
            setCustomFoods={setCustomFoods}
          />
        )}
        {tab === 'progresso' && <Progresso profile={profile} diary={diary} />}
        {tab === 'perfil' && (
          <Perfil
            profile={profile}
            setProfile={setProfile}
            onReset={() => {
              setProfile(null)
              setDiary({})
              setCustomFoods([])
              setTab('diario')
            }}
          />
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-md">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-xs font-medium transition-colors ${
                tab === t.id ? 'text-accent' : 'text-muted'
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
