import { useEffect, useState } from 'react'
import type { Diary, Entry, ExerciseLog, Food, Profile, WaterLog, WeightLog } from './types'
import { usePersistedState, todayISO } from './lib/store'
import { withWaterTarget } from './lib/calc'
import Onboarding from './components/Onboarding'
import Diario from './components/Diario'
import Metas from './components/Metas'
import Progresso from './components/Progresso'
import Perfil from './components/Perfil'
import AddFoodSheet from './components/AddFoodSheet'
import { IconHome, IconPerson, IconTarget, IconTrend } from './components/ui'

type Tab = 'diario' | 'metas' | 'progresso' | 'perfil'

export default function App() {
  const [rawProfile, setProfile] = usePersistedState<Profile | null>('macros.profile', null)
  const [diary, setDiary] = usePersistedState<Diary>('macros.diary', {})
  const [water, setWater] = usePersistedState<WaterLog>('macros.water', {})
  const [exercise, setExercise] = usePersistedState<ExerciseLog>('macros.exercise', {})
  const [customFoods, setCustomFoods] = usePersistedState<Food[]>('macros.customFoods', [])
  const [weightLog, setWeightLog] = usePersistedState<WeightLog>('macros.weightLog', {})
  const [waterReminders] = usePersistedState<boolean>('macros.waterReminders', false)
  const [tab, setTab] = useState<Tab>('diario')
  const [quickAdd, setQuickAdd] = useState(false)

  useEffect(() => {
    if (!waterReminders || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const check = () => {
      const h = new Date().getHours()
      if (h < 9 || h >= 21) return
      const last = Number(localStorage.getItem('macros.lastWaterNotif') ?? 0)
      if (Date.now() - last < 2 * 60 * 60 * 1000) return
      const today = todayISO()
      const target = rawProfile ? withWaterTarget(rawProfile).targets.waterMl : 2500
      if ((water[today] ?? 0) >= target) return
      localStorage.setItem('macros.lastWaterNotif', String(Date.now()))
      new Notification('Hora de beber água 💧', {
        body: `Levas ${water[today] ?? 0} ml de ${target} ml hoje. Um copo agora?`,
        icon: 'icon-192.png',
      })
    }
    check()
    const timer = setInterval(check, 10 * 60 * 1000)
    return () => clearInterval(timer)
  }, [waterReminders, water, rawProfile])

  if (!rawProfile) {
    return <Onboarding onDone={setProfile} />
  }
  const profile = withWaterTarget(rawProfile)

  const quickAddEntry = (entry: Entry) => {
    const date = todayISO()
    setDiary((d) => ({ ...d, [date]: [...(d[date] ?? []), entry] }))
    setQuickAdd(false)
    setTab('diario')
  }
  const quickAddEntries = (newEntries: Entry[]) => {
    const date = todayISO()
    setDiary((d) => ({ ...d, [date]: [...(d[date] ?? []), ...newEntries] }))
    setQuickAdd(false)
    setTab('diario')
  }

  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto max-w-md pb-32">
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
            onEditGoal={() => setTab('metas')}
          />
        )}
        {tab === 'metas' && <Metas profile={profile} setProfile={setProfile} />}
        {tab === 'progresso' && <Progresso profile={profile} diary={diary} weightLog={weightLog} />}
        {tab === 'perfil' && (
          <Perfil
            profile={profile}
            setProfile={setProfile}
            weightLog={weightLog}
            setWeightLog={setWeightLog}
            allData={{ diary, water, exercise, customFoods, weightLog }}
            onReset={() => {
              setProfile(null)
              setDiary({})
              setWater({})
              setExercise({})
              setCustomFoods([])
              setWeightLog({})
              setTab('diario')
            }}
          />
        )}
      </div>

      {/* tab bar translúcida com botão + central */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-line/70 bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-end">
          <TabButton active={tab === 'diario'} onClick={() => setTab('diario')} label="Resumo" icon={<IconHome />} />
          <TabButton active={tab === 'metas'} onClick={() => setTab('metas')} label="Metas" icon={<IconTarget />} />

          <div className="flex flex-1 justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <button
              onClick={() => setQuickAdd(true)}
              aria-label="Adicionar alimento"
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_8px_20px_-6px_rgba(23,153,79,0.55)] transition-transform active:scale-95"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>

          <TabButton active={tab === 'progresso'} onClick={() => setTab('progresso')} label="Progresso" icon={<IconTrend />} />
          <TabButton active={tab === 'perfil'} onClick={() => setTab('perfil')} label="Perfil" icon={<IconPerson />} />
        </div>
      </nav>

      {quickAdd && (
        <AddFoodSheet
          meal={null}
          customFoods={customFoods}
          setCustomFoods={setCustomFoods}
          onAdd={quickAddEntry}
          onAddMany={quickAddEntries}
          onClose={() => setQuickAdd(false)}
        />
      )}
    </div>
  )
}

function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-1 flex-col items-center gap-0.5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[10.5px] font-bold transition-colors ${
        active ? 'text-accent' : 'text-muted'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
