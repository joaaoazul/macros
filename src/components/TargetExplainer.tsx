import { useState } from 'react'
import type { Profile } from '../types'
import { ACTIVITY_LEVELS, GOALS, ageFromBirthdate, bmr, computeTargets, tdee } from '../lib/calc'

/** "Como calculámos" — um só painel que explica de onde vem a meta de calorias.
 *
 * Toda a matemática vem de calc.ts/trend.ts (nada de novo aqui): TMB → TDEE →
 * objetivo → meta. Junta os quatro "métodos" numa história em vez de os espalhar
 * por Metas/Perfil/Progresso. A manutenção aprendida entra só quando quem chama
 * já a tem (Progresso), porque precisa do diário + pesagens. */
export default function TargetExplainer({
  profile,
  learnedMaintenance,
}: {
  profile: Profile
  /** manutenção estimada pelos dados (Progresso passa; Metas/Perfil não têm). */
  learnedMaintenance?: number | null
}) {
  const [open, setOpen] = useState(false)

  const age = ageFromBirthdate(profile.birthdate, profile.age)
  const usingKatch = profile.bodyFatPct != null && profile.bodyFatPct > 0
  const tmb = Math.round(bmr(profile.sex, profile.weightKg, profile.heightCm, age, profile.bodyFatPct))
  const tdeeVal = Math.round(tdee(profile.sex, profile.weightKg, profile.heightCm, age, profile.activity, profile.bodyFatPct))
  const formulaKcal = computeTargets(
    profile.sex, profile.weightKg, profile.heightCm, age, profile.activity, profile.goal, profile.bodyFatPct,
  ).kcal
  const activityInfo = ACTIVITY_LEVELS.find((a) => a.value === profile.activity)
  const goalInfo = GOALS.find((g) => g.value === profile.goal)
  const manual = profile.targets.kcal !== formulaKcal

  const kcal = (n: number) => `${n.toLocaleString('pt-PT')} kcal`

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-left text-[13px] font-semibold text-accent"
      >
        <span aria-hidden>ⓘ</span> Como calculámos
        <span className={`ml-auto text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>▾</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2.5 border-t border-line pt-3 text-sm">
          <Step
            n={1}
            title={`Metabolismo basal (TMB) · ${usingKatch ? 'Katch-McArdle' : 'Mifflin-St Jeor'}`}
            hint={usingKatch ? 'Usa a tua % de gordura corporal.' : 'Do teu sexo, peso, altura e idade.'}
            value={kcal(tmb)}
          />
          <Step
            n={2}
            title={`Atividade · ${activityInfo?.label ?? ''} (×${profile.activity})`}
            hint="O que gastas ao mexeres-te num dia normal — dá o TDEE."
            value={kcal(tdeeVal)}
          />
          <Step
            n={3}
            title={`Objetivo · ${goalInfo?.label ?? ''}`}
            hint={goalInfo?.hint ?? ''}
            value={kcal(formulaKcal)}
          />
          {learnedMaintenance != null && (
            <Step
              n={4}
              title="Ajuste pelos teus dados"
              hint="Manutenção real aprendida do teu consumo e da balança — já inclui o treino."
              value={kcal(learnedMaintenance)}
              accent
            />
          )}

          <div className="mt-1 flex items-center justify-between rounded-xl bg-bg px-4 py-3">
            <span className="text-[13px] font-semibold text-muted">A tua meta</span>
            <span className="text-lg font-bold tabular-nums">{kcal(profile.targets.kcal)}</span>
          </div>
          {manual && (
            <p className="text-[11px] text-muted">
              Ajustaste a meta à mão — por isso difere da conta acima ({kcal(formulaKcal)}).
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Step({
  n,
  title,
  hint,
  value,
  accent,
}: {
  n: number
  title: string
  hint: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          accent ? 'bg-accent text-white' : 'bg-surface text-muted'
        }`}
        aria-hidden
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium">{title}</span>
          <span className="shrink-0 tabular-nums font-semibold">{value}</span>
        </div>
        {hint && <p className="text-[11px] leading-snug text-muted">{hint}</p>}
      </div>
    </div>
  )
}
