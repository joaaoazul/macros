/** Cartão do alimento: factos nutricionais completos por 100 g/ml + sugestões de uso por IA. */

import { useState } from 'react'
import type { Food } from '../types'
import { foodTips, getAnthropicKey, type FoodTips } from '../lib/ai'

interface Props {
  food: Food
  onChoose: (f: Food) => void // ir para o ecrã de quantidade
  onClose: () => void
}

export default function FoodCard({ food, onChoose, onClose }: Props) {
  const [tips, setTips] = useState<FoodTips | null>(null)
  const [tipsState, setTipsState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [tipsError, setTipsError] = useState('')

  const loadTips = async () => {
    setTipsState('loading')
    setTipsError('')
    try {
      const t = await foodTips({
        name: food.name,
        brand: food.brand,
        kcal: food.kcal,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        unit: food.unit,
      })
      setTips(t)
      setTipsState('idle')
    } catch (e) {
      setTipsError(e instanceof Error ? e.message : 'Não foi possível obter sugestões.')
      setTipsState('error')
    }
  }

  const hasMicros =
    food.fiber != null || food.sugar != null || food.saturates != null || food.salt != null
  const hasAiKey = !!getAnthropicKey()

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="sheet-panel flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-[1.75rem] bg-bg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes de ${food.name}`}
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line" aria-hidden />

        <div className="flex items-start justify-between px-5 pt-3">
          <div className="flex items-center gap-3">
            <span className="text-4xl" aria-hidden>{food.emoji}</span>
            <div>
              <h2 className="text-lg font-bold leading-tight">{food.name}</h2>
              <p className="text-xs text-muted">
                {food.brand ? `${food.brand} · ` : ''}valores por 100 {food.unit}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full px-2 py-1 text-muted" aria-label="Fechar">✕</button>
        </div>

        <div className="scroll-contain flex-1 overflow-y-auto px-5 pb-4 pt-4">
          {/* macros principais */}
          <div className="grid grid-cols-4 gap-2 rounded-2xl bg-surface p-4 text-center">
            <Fact label="kcal" value={Math.round(food.kcal)} />
            <Fact label="Hidratos" value={food.carbs} suffix="g" dotVar="--carbs" />
            <Fact label="Proteína" value={food.protein} suffix="g" dotVar="--protein" />
            <Fact label="Gordura" value={food.fat} suffix="g" dotVar="--fat" />
          </div>

          {hasMicros && (
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-2xl bg-surface px-4 py-3 text-sm">
              {food.sugar != null && <FactRow label="dos quais açúcares" value={food.sugar} />}
              {food.fiber != null && <FactRow label="Fibra" value={food.fiber} />}
              {food.saturates != null && <FactRow label="dos quais saturadas" value={food.saturates} />}
              {food.salt != null && <FactRow label="Sal" value={food.salt} />}
            </div>
          )}

          {food.portions && food.portions.length > 0 && (
            <div className="mt-3">
              <SectionLabel>Medidas caseiras</SectionLabel>
              <ul className="flex flex-wrap gap-1.5">
                {food.portions.map((p, i) => (
                  <li key={i} className="rounded-full bg-surface px-3 py-1 text-xs">
                    1 {p.label} = {p.grams} {food.unit}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* sugestões IA — só se o utilizador tiver chave Anthropic configurada */}
          {hasAiKey && (
          <div className="mt-4">
            <SectionLabel>Como usar</SectionLabel>
            {!tips && tipsState !== 'error' && (
              <button
                onClick={loadTips}
                disabled={tipsState === 'loading'}
                className="w-full rounded-xl border border-dashed border-line px-4 py-3 text-sm font-medium text-accent disabled:opacity-50"
              >
                {tipsState === 'loading' ? 'A pensar…' : '✨ Ver sugestões de uso'}
              </button>
            )}
            {tipsState === 'error' && (
              <div className="rounded-xl bg-surface px-4 py-3 text-sm text-muted">
                {tipsError}
                <button onClick={loadTips} className="mt-2 block font-medium text-accent">Tentar de novo</button>
              </div>
            )}
            {tips && (
              <div className="space-y-3">
                <p className="text-sm text-ink-2">{tips.summary}</p>
                {tips.uses.length > 0 && (
                  <ul className="space-y-1.5">
                    {tips.uses.map((u, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="text-accent" aria-hidden>•</span>
                        <span>{u}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {tips.pairs_with.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted">Combina com</div>
                    <ul className="flex flex-wrap gap-1.5">
                      {tips.pairs_with.map((p, i) => (
                        <li key={i} className="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-[11px] text-muted">Sugestões geradas por IA — usa o bom senso.</p>
              </div>
            )}
          </div>
          )}
        </div>

        <div className="border-t border-line px-5 py-3">
          <button
            onClick={() => onChoose(food)}
            className="w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-white transition active:scale-[0.98]"
          >
            Adicionar ao diário
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{children}</div>
}

function Fact({ label, value, suffix = '', dotVar }: { label: string; value: number; suffix?: string; dotVar?: string }) {
  return (
    <div>
      {dotVar ? (
        <span className="mx-auto mb-1 block h-1.5 w-1.5 rounded-full" style={{ background: `var(${dotVar})` }} aria-hidden />
      ) : (
        <span className="mx-auto mb-1 block h-1.5 w-1.5" aria-hidden />
      )}
      <div className="text-lg font-bold tabular-nums">
        {value % 1 === 0 ? value : value.toFixed(1)}
        {suffix && <span className="text-xs font-normal text-muted"> {suffix}</span>}
      </div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  )
}

function FactRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums font-medium">{value % 1 === 0 ? value : value.toFixed(1)} g</span>
    </div>
  )
}
