import { useState } from 'react'
import { billing, trialDaysLeft, type BillingStatus, type Plan } from '../lib/billing'
import { useAuth } from '../lib/auth'

/** Ecrã de subscrição. Sem onClose é o paywall obrigatório (trial acabou); com
 * onClose é voluntário (o utilizador em trial foi "ver planos"). */
export default function Paywall({ status, onClose }: { status: BillingStatus; onClose?: () => void }) {
  const { logout } = useAuth()
  const [plan, setPlan] = useState<Plan>('annual')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const trialing = status.status === 'trialing'
  const daysLeft = trialDaysLeft(status)

  const subscribe = async () => {
    setBusy(true)
    setError('')
    try {
      const { url } = await billing.checkout(plan)
      window.location.href = url // Checkout alojado do Stripe
    } catch {
      setError('Não foi possível abrir o pagamento. Tenta novamente.')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg px-6 py-10">
      <div className="flex-1">
        <span className="text-4xl" aria-hidden>🥗</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          {trialing ? 'Continua com o Macros' : 'O teu teste terminou'}
        </h1>
        <p className="mt-2 text-ink-2">
          {trialing
            ? daysLeft > 0
              ? `Faltam ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'} de teste. Subscreve quando quiseres.`
              : 'O teu teste está a terminar. Subscreve para não perderes o acesso.'
            : 'Subscreve para continuares a registar e a acompanhar o teu progresso. Os teus dados ficam guardados.'}
        </p>

        <div className="mt-8 space-y-3">
          <PlanCard
            active={plan === 'annual'}
            onSelect={() => setPlan('annual')}
            title="Anual"
            price="29,99 € / ano"
            hint="Poupa ~2 meses"
            badge="Melhor valor"
          />
          <PlanCard
            active={plan === 'monthly'}
            onSelect={() => setPlan('monthly')}
            title="Mensal"
            price="3,99 € / mês"
            hint="Cancela quando quiseres"
          />
        </div>

        {error && <p role="alert" className="mt-4 text-sm font-medium text-critical">{error}</p>}
      </div>

      <div className="mt-8 space-y-3">
        <button
          onClick={subscribe}
          disabled={busy}
          className="w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
        >
          {busy ? 'A abrir pagamento…' : 'Subscrever'}
        </button>
        {onClose ? (
          <button onClick={onClose} className="w-full rounded-full bg-surface px-6 py-3.5 font-semibold text-ink-2">
            Agora não
          </button>
        ) : (
          <button onClick={() => void logout()} className="w-full py-2 text-sm font-medium text-muted">
            Terminar sessão
          </button>
        )}
        <p className="text-center text-[11px] leading-snug text-muted">
          Pagamento seguro via Stripe. Podes gerir ou cancelar a subscrição a qualquer momento no teu perfil.
        </p>
      </div>
    </div>
  )
}

function PlanCard({
  active,
  onSelect,
  title,
  price,
  hint,
  badge,
}: {
  active: boolean
  onSelect: () => void
  title: string
  price: string
  hint: string
  badge?: string
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
        active ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
          active ? 'border-accent' : 'border-muted'
        }`}
        aria-hidden
      >
        {active && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-semibold">{title}</span>
          {badge && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">{badge}</span>}
        </span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
      <span className="shrink-0 font-semibold tabular-nums">{price}</span>
    </button>
  )
}
