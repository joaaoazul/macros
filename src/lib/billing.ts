/** Cliente de billing: estado de acesso + Checkout/Portal do Stripe (hosted).
 *
 * O frontend nunca toca em chaves do Stripe: pede um URL ao backend e redireciona.
 * Falha aberto do lado do cliente — se o /status falhar, não bloqueamos (o backend
 * continua a ser o verdadeiro portão via require_access/402). */

import { useEffect, useState } from 'react'
import { api } from './api'

export interface BillingStatus {
  access: boolean
  status: string // none|trialing|active|past_due|canceled
  comped: boolean
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  billingEnabled: boolean
}

export type Plan = 'monthly' | 'annual'

export const billing = {
  status: () => api<BillingStatus>('/billing/status'),
  checkout: (plan: Plan) => api<{ url: string }>('/billing/checkout', { method: 'POST', body: { plan } }),
  portal: () => api<{ url: string }>('/billing/portal', { method: 'POST' }),
}

/** Dias inteiros que faltam até ao fim do trial (0 se já passou / sem data). */
export function trialDaysLeft(status: BillingStatus): number {
  if (!status.trialEndsAt) return 0
  const ms = new Date(status.trialEndsAt).getTime() - Date.now()
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000)
}

interface BillingState {
  loading: boolean
  data: BillingStatus | null
}

/** Carrega o estado de billing uma vez. data=null enquanto carrega ou em erro
 * (fail-open: quem chama só bloqueia quando data.access é explicitamente false). */
export function useBillingStatus(): BillingState {
  const [state, setState] = useState<BillingState>({ loading: true, data: null })
  useEffect(() => {
    let alive = true
    billing
      .status()
      .then((d) => alive && setState({ loading: false, data: d }))
      .catch(() => alive && setState({ loading: false, data: null }))
    return () => {
      alive = false
    }
  }, [])
  return state
}
