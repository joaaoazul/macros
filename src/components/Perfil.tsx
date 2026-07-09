import { useState } from 'react'
import type { Profile } from '../types'
import { ACTIVITY_LEVELS, GOALS, computeTargets } from '../lib/calc'

interface Props {
  profile: Profile
  setProfile: (p: Profile) => void
  onReset: () => void
}

export default function Perfil({ profile, setProfile, onReset }: Props) {
  const [weight, setWeight] = useState(String(profile.weightKg))
  const [confirmReset, setConfirmReset] = useState(false)

  const goalInfo = GOALS.find((g) => g.value === profile.goal)
  const activityInfo = ACTIVITY_LEVELS.find((a) => a.value === profile.activity)

  const updateWeight = () => {
    const w = Number(weight)
    if (!(w >= 35 && w <= 250) || w === profile.weightKg) return
    const targets = computeTargets(profile.sex, w, profile.heightCm, profile.age, profile.activity, profile.goal)
    setProfile({ ...profile, weightKg: w, targets })
  }

  const setGoal = (goal: Profile['goal']) => {
    const targets = computeTargets(profile.sex, profile.weightKg, profile.heightCm, profile.age, profile.activity, goal)
    setProfile({ ...profile, goal, targets })
  }

  const setActivity = (activity: number) => {
    const targets = computeTargets(profile.sex, profile.weightKg, profile.heightCm, profile.age, activity, profile.goal)
    setProfile({ ...profile, activity, targets })
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">Olá, {profile.name} 👋</h1>
      <p className="mt-1 text-sm text-ink-2">
        {profile.age} anos · {profile.heightCm} cm · {goalInfo?.label.toLowerCase()} · {activityInfo?.label.toLowerCase()}
      </p>

      {/* alvos atuais */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="font-semibold">Alvos diários</h2>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <Target value={profile.targets.kcal.toLocaleString('pt-PT')} label="kcal" />
          <Target value={`${profile.targets.protein}g`} label="Proteína" dotVar="--protein" />
          <Target value={`${profile.targets.carbs}g`} label="Hidratos" dotVar="--carbs" />
          <Target value={`${profile.targets.fat}g`} label="Gordura" dotVar="--fat" />
        </div>
        <p className="mt-3 text-xs text-muted">Recalculados automaticamente quando alteras peso, objetivo ou atividade.</p>
      </section>

      {/* atualizar peso */}
      <section className="mt-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="font-semibold">Peso atual</h2>
        <div className="mt-3 flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full rounded-xl border border-line bg-bg px-4 py-3 font-semibold focus:border-accent focus:outline-none"
          />
          <button
            onClick={updateWeight}
            disabled={Number(weight) === profile.weightKg || !(Number(weight) >= 35 && Number(weight) <= 250)}
            className="shrink-0 rounded-xl bg-accent px-5 py-3 font-semibold text-white disabled:opacity-40"
          >
            Atualizar
          </button>
        </div>
      </section>

      {/* objetivo */}
      <section className="mt-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="font-semibold">Objetivo</h2>
        <div className="mt-3 space-y-2">
          {GOALS.map((g) => (
            <button
              key={g.value}
              onClick={() => setGoal(g.value)}
              className={`block w-full rounded-xl border px-4 py-2.5 text-left text-sm ${
                profile.goal === g.value ? 'border-accent bg-accent-soft font-semibold' : 'border-line bg-bg'
              }`}
            >
              <span aria-hidden>{g.emoji}</span> {g.label} <span className="text-muted">· {g.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {/* atividade */}
      <section className="mt-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="font-semibold">Nível de atividade</h2>
        <div className="mt-3 space-y-2">
          {ACTIVITY_LEVELS.map((a) => (
            <button
              key={a.value}
              onClick={() => setActivity(a.value)}
              className={`block w-full rounded-xl border px-4 py-2.5 text-left text-sm ${
                profile.activity === a.value ? 'border-accent bg-accent-soft font-semibold' : 'border-line bg-bg'
              }`}
            >
              {a.label} <span className="text-muted">· {a.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {/* zona de perigo */}
      <section className="mt-4 mb-2 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="text-sm font-medium text-critical">
            Apagar todos os dados…
          </button>
        ) : (
          <div>
            <p className="text-sm text-ink-2">Isto apaga o perfil e todo o diário. Não há volta a dar.</p>
            <div className="mt-3 flex gap-2">
              <button onClick={onReset} className="rounded-xl bg-critical px-4 py-2 text-sm font-semibold text-white">
                Sim, apagar tudo
              </button>
              <button onClick={() => setConfirmReset(false)} className="rounded-xl border border-line px-4 py-2 text-sm font-medium">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function Target({ value, label, dotVar }: { value: string; label: string; dotVar?: string }) {
  return (
    <div>
      {dotVar ? (
        <span className="mx-auto mb-1 block h-1.5 w-1.5 rounded-full" style={{ background: `var(${dotVar})` }} aria-hidden />
      ) : (
        <span className="mx-auto mb-1 block h-1.5 w-1.5" aria-hidden />
      )}
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  )
}
