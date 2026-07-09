import { useState } from 'react'
import type { Profile } from '../types'
import { ACTIVITY_LEVELS, GOALS, bmi, bmr, computeTargets } from '../lib/calc'
import { Card, LargeTitle } from './ui'

interface Props {
  profile: Profile
  setProfile: (p: Profile) => void
  onReset: () => void
}

export default function Perfil({ profile, setProfile, onReset }: Props) {
  const [weight, setWeight] = useState(String(profile.weightKg))
  const [waterMl, setWaterMl] = useState(String(profile.targets.waterMl))
  const [confirmReset, setConfirmReset] = useState(false)

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

        {/* zona de perigo */}
        <Card className="mb-2 p-5">
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} className="text-sm font-medium text-critical">
              Apagar todos os dados…
            </button>
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
