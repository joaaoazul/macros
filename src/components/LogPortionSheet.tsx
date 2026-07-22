/** Registar uma receita/refeição planeada, escolhendo que parte dela comeste.
 *
 * Cozinhaste para quatro e comeste uma dose? Escolhes ¼ e vai ¼ para o diário.
 * Mostra sempre as kcal resultantes: como as receitas tanto podem estar
 * guardadas por dose como pelo tacho todo, o número é que tira a dúvida.
 */

import { useState } from 'react'
import type { MealId, RecipeItem } from '../types'
import { MEALS } from '../types'
import { scaleItems } from '../lib/recipes'
import { haptic } from '../lib/store'
import { useToast } from '../lib/toast'
import { Z } from './ui'

const PORTIONS: { factor: number; label: string }[] = [
  { factor: 0.25, label: '¼' },
  { factor: 1 / 3, label: '⅓' },
  { factor: 0.5, label: '½' },
  { factor: 1, label: '1' },
  { factor: 1.5, label: '1½' },
  { factor: 2, label: '2' },
]

interface Props {
  title: string
  emoji: string
  items: RecipeItem[]
  /** se vier definida, não se pergunta a refeição (ex.: almoço do planeador) */
  meal?: MealId
  onLog: (items: RecipeItem[], meal: MealId) => void
  onClose: () => void
}

export default function LogPortionSheet({ title, emoji, items, meal, onLog, onClose }: Props) {
  const [factor, setFactor] = useState(1)
  const toast = useToast()

  const totalKcal = items.reduce((s, i) => s + i.kcal, 0)
  const shownKcal = Math.round(totalKcal * factor)

  const log = (m: MealId) => {
    haptic(30)
    onLog(scaleItems(items, factor), m)
    toast(`${title} registado · ${shownKcal} kcal`)
  }

  return (
    <div className={`fixed inset-0 ${Z.screen} flex items-end justify-center bg-black/40 sheet-backdrop`} onClick={onClose}>
      <div
        className="sheet-panel w-full max-w-md rounded-t-[1.75rem] bg-bg px-5 pb-8 pt-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Registar ${title}`}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" aria-hidden />

        <div className="flex items-center gap-2.5">
          <span className="text-2xl" aria-hidden>{emoji}</span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold leading-tight">{title}</h2>
            <p className="text-sm text-muted">hoje · {shownKcal} kcal</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            Que parte comeste?
          </div>
          <div className="flex gap-1.5">
            {PORTIONS.map((p) => (
              <button
                key={p.label}
                onClick={() => { haptic(8); setFactor(p.factor) }}
                aria-pressed={factor === p.factor}
                className={`press flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                  factor === p.factor ? 'bg-accent text-white' : 'bg-surface text-ink-2'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {meal ? (
          <button
            onClick={() => log(meal)}
            className="press mt-5 w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-white"
          >
            Registar no {MEALS.find((m) => m.id === meal)?.label.toLowerCase() ?? 'diário'}
          </button>
        ) : (
          <div className="mt-4 space-y-2">
            <div className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
              Em que refeição?
            </div>
            {MEALS.map((m) => (
              <button
                key={m.id}
                onClick={() => log(m.id)}
                className="press flex w-full items-center gap-3 rounded-xl bg-surface px-4 py-3.5 text-left"
              >
                <span className="text-2xl" aria-hidden>{m.emoji}</span>
                <span className="font-semibold">{m.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
