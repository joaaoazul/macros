import { useState } from 'react'
import type { Goal, Profile, Sex } from '../types'
import { ACTIVITY_LEVELS, GOALS, computeTargets } from '../lib/calc'

interface Props {
  onDone: (p: Profile) => void
}

export default function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [sex, setSex] = useState<Sex>('M')
  const [age, setAge] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [activity, setActivity] = useState(1.55)
  const [goal, setGoal] = useState<Goal>('maintain')

  const ageN = Number(age)
  const heightN = Number(heightCm)
  const weightN = Number(weightKg)
  const dataOk =
    name.trim().length > 0 &&
    ageN >= 14 && ageN <= 100 &&
    heightN >= 120 && heightN <= 230 &&
    weightN >= 35 && weightN <= 250

  const targets = dataOk ? computeTargets(sex, weightN, heightN, ageN, activity, goal) : null

  const finish = () => {
    if (!targets) return
    onDone({ name: name.trim(), sex, age: ageN, heightCm: heightN, weightKg: weightN, activity, goal, targets })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg px-6 py-10">
      {/* progresso */}
      <div className="mb-8 flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-line'}`} />
        ))}
      </div>

      {step === 0 && (
        <section className="flex flex-1 flex-col">
          <h1 className="text-3xl font-bold tracking-tight">
            Olá! <span aria-hidden>👋</span>
          </h1>
          <p className="mt-2 text-ink-2">Vamos calcular as tuas necessidades diárias. Primeiro, fala-nos de ti.</p>

          <div className="mt-8 space-y-4">
            <Field label="Nome">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="O teu nome" className={inputCls} autoFocus />
            </Field>

            <Field label="Sexo">
              <div className="grid grid-cols-2 gap-2">
                {(['M', 'F'] as Sex[]).map((s) => (
                  <ChoiceButton key={s} active={sex === s} onClick={() => setSex(s)}>
                    {s === 'M' ? 'Masculino' : 'Feminino'}
                  </ChoiceButton>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Idade">
                <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="25" className={inputCls} />
              </Field>
              <Field label="Altura (cm)">
                <input type="number" inputMode="numeric" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="175" className={inputCls} />
              </Field>
              <Field label="Peso (kg)">
                <input type="number" inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="70" className={inputCls} />
              </Field>
            </div>
          </div>

          <PrimaryButton className="mt-auto" disabled={!dataOk} onClick={() => setStep(1)}>
            Continuar
          </PrimaryButton>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-1 flex-col">
          <h1 className="text-3xl font-bold tracking-tight">Nível de atividade</h1>
          <p className="mt-2 text-ink-2">Quão ativo és no dia a dia?</p>

          <div className="mt-8 space-y-2">
            {ACTIVITY_LEVELS.map((a) => (
              <ChoiceButton key={a.value} active={activity === a.value} onClick={() => setActivity(a.value)} block>
                <span className="font-semibold">{a.label}</span>
                <span className="block text-sm text-ink-2">{a.hint}</span>
              </ChoiceButton>
            ))}
          </div>

          <div className="mt-auto flex gap-3">
            <SecondaryButton onClick={() => setStep(0)}>Voltar</SecondaryButton>
            <PrimaryButton className="flex-1" onClick={() => setStep(2)}>
              Continuar
            </PrimaryButton>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-1 flex-col">
          <h1 className="text-3xl font-bold tracking-tight">Objetivo</h1>
          <p className="mt-2 text-ink-2">O que queres alcançar?</p>

          <div className="mt-8 space-y-2">
            {GOALS.map((g) => (
              <ChoiceButton key={g.value} active={goal === g.value} onClick={() => setGoal(g.value)} block>
                <span className="font-semibold">
                  <span aria-hidden>{g.emoji}</span> {g.label}
                </span>
                <span className="block text-sm text-ink-2">{g.hint}</span>
              </ChoiceButton>
            ))}
          </div>

          <div className="mt-auto flex gap-3">
            <SecondaryButton onClick={() => setStep(1)}>Voltar</SecondaryButton>
            <PrimaryButton className="flex-1" onClick={() => setStep(3)}>
              Ver o meu plano
            </PrimaryButton>
          </div>
        </section>
      )}

      {step === 3 && targets && (
        <section className="flex flex-1 flex-col">
          <h1 className="text-3xl font-bold tracking-tight">O teu plano, {name.trim()}</h1>
          <p className="mt-2 text-ink-2">Calculado com a equação de Mifflin-St Jeor. Podes ajustar tudo depois no Perfil.</p>

          <div className="mt-8 rounded-card bg-surface p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="text-sm font-medium text-muted uppercase tracking-wide">Calorias diárias</div>
            <div className="mt-1 text-5xl font-bold tracking-tight">{targets.kcal.toLocaleString('pt-PT')}</div>
            <div className="text-sm text-muted">kcal</div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <MacroCard color="bg-protein" label="Proteína" grams={targets.protein} />
            <MacroCard color="bg-carbs" label="Hidratos" grams={targets.carbs} />
            <MacroCard color="bg-fat" label="Gordura" grams={targets.fat} />
          </div>

          <div className="mt-auto flex gap-3">
            <SecondaryButton onClick={() => setStep(2)}>Voltar</SecondaryButton>
            <PrimaryButton className="flex-1" onClick={finish}>
              Começar 🚀
            </PrimaryButton>
          </div>
        </section>
      )}
    </div>
  )
}

const inputCls =
  'w-full rounded-xl bg-surface px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>
      {children}
    </label>
  )
}

function ChoiceButton({
  active,
  onClick,
  children,
  block,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  block?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-colors ${block ? 'block w-full' : ''} ${
        active ? 'border-accent bg-accent-soft' : 'border-transparent bg-surface'
      }`}
    >
      {children}
    </button>
  )
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full bg-accent px-6 py-3.5 font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full bg-surface px-6 py-3.5 font-semibold text-ink">
      {children}
    </button>
  )
}

function MacroCard({ color, label, grams }: { color: string; label: string; grams: number }) {
  return (
    <div className="rounded-card bg-surface p-4 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <span className={`mx-auto block h-2 w-2 rounded-full ${color}`} aria-hidden />
      <div className="mt-2 text-xl font-bold">{grams} g</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}
