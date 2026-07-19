/** Sugestão de ajuste às calorias, com base no ritmo real da balança.
 *
 * Sugere e explica; só muda alguma coisa se carregares em Aplicar. Se os dados
 * não chegarem (poucas pesagens, pouco tempo, diferença dentro do ruído) não
 * aparece de todo — ver os guardrails em lib/trend.ts.
 */

import { useEffect, useState } from 'react'
import type { Profile } from '../types'
import { api } from '../lib/api'
import { splitFromTargets, targetsFromSplit } from '../lib/calc'
import { haptic } from '../lib/store'
import { useToast } from '../lib/toast'
import { formatRate, suggestAdjustment, type TargetSuggestion, type Weight } from '../lib/trend'
import { Card } from './ui'

interface Props {
  profile: Profile
  setProfile: (p: Profile) => void
}

export default function AdjustTargetCard({ profile, setProfile }: Props) {
  const [suggestion, setSuggestion] = useState<TargetSuggestion | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let alive = true
    api<Weight[]>('/weights')
      .then((weights) => {
        if (alive) setSuggestion(suggestAdjustment(profile, weights))
      })
      .catch(() => {
        /* sem pesagens não há sugestão — e isso é um estado válido */
      })
    return () => {
      alive = false
    }
  }, [profile])

  if (!suggestion || dismissed) return null

  const { actualRate, expectedRate, deltaKcal, newKcal, capped } = suggestion
  const up = deltaKcal > 0

  const apply = () => {
    haptic(20)
    // mantém a repartição de macros que já tinhas em vez de voltar à fórmula
    const split = splitFromTargets(profile.targets)
    const targets = targetsFromSplit(
      newKcal,
      split.carbsPct,
      split.proteinPct,
      split.fatPct,
      profile.targets.waterMl,
    )
    setProfile({ ...profile, targets })
    setDismissed(true)
    toast(`Alvo actualizado para ${newKcal} kcal`)
  }

  return (
    <Card className="animate-in p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Ajustar as calorias?</h3>
        <span className="text-xs text-muted">sugestão</span>
      </div>

      <p className="mt-1.5 text-sm text-ink-2">
        Estás {formatRate(actualRate)}; o teu alvo aponta para {formatRate(expectedRate)}.{' '}
        {up
          ? 'Comer um pouco mais aproximaria o ritmo do plano.'
          : 'Comer um pouco menos aproximaria o ritmo do plano.'}
      </p>

      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-bg px-4 py-3">
        <span className="text-lg font-bold tabular-nums">{profile.targets.kcal}</span>
        <span className="text-muted" aria-hidden>→</span>
        <span className={`text-lg font-bold tabular-nums ${up ? 'text-good' : 'text-accent'}`}>
          {newKcal}
        </span>
        <span className="ml-auto text-xs tabular-nums text-muted">
          {up ? '+' : '−'}
          {Math.abs(deltaKcal)} kcal/dia
        </span>
      </div>

      {capped && (
        <p className="mt-1.5 text-[11px] text-muted">
          Ajuste limitado de propósito — vale mais mexer pouco e voltar a medir.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={apply}
          className="press flex-1 rounded-full bg-accent py-2.5 text-sm font-semibold text-white"
        >
          Aplicar
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="press rounded-full bg-surface px-4 py-2.5 text-sm font-medium text-muted"
        >
          Agora não
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-muted">
        Estimativa a partir do teu peso e do teu alvo, não um conselho clínico. O peso oscila com
        água e sal; se a semana foi atípica, ignora.
      </p>
    </Card>
  )
}
