/** O que fazer a um alimento já registado: mudar a quantidade, mudá-lo de
 * refeição, duplicar ou apagar.
 *
 * Antes disto a única saída era apagar e voltar a adicionar. As macros são
 * reescaladas a partir das que já estão na entrada (nunca vamos buscar o
 * alimento outra vez — a entrada é um instantâneo e assim continua a ser). */

import { useState } from 'react'
import type { Entry, MealId } from '../types'
import { MEALS } from '../types'
import { haptic } from '../lib/store'
import { Z } from './ui'

interface Props {
  entry: Entry
  onSave: (entry: Entry) => void
  onDuplicate: (entry: Entry) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** Reescala uma entrada para uma nova quantidade, mantendo a proporção. */
export function scaleEntry(e: Entry, grams: number): Entry {
  const factor = e.grams > 0 ? grams / e.grams : 0
  return {
    ...e,
    grams,
    kcal: Math.round(e.kcal * factor),
    protein: r1(e.protein * factor),
    carbs: r1(e.carbs * factor),
    fat: r1(e.fat * factor),
  }
}

export default function EntryActionsSheet({ entry, onSave, onDuplicate, onDelete, onClose }: Props) {
  const [qty, setQty] = useState(String(Math.round(entry.grams)))
  const [meal, setMeal] = useState<MealId>(entry.meal)

  const qtyN = Number(qty)
  const valid = qtyN > 0
  const preview = valid ? scaleEntry(entry, qtyN) : entry
  const changed = valid && (qtyN !== entry.grams || meal !== entry.meal)

  const save = () => {
    if (!changed) return onClose()
    haptic(20)
    onSave({ ...scaleEntry(entry, qtyN), meal })
  }

  return (
    <div className={`fixed inset-0 ${Z.modal} flex items-end justify-center bg-black/40 sheet-backdrop`} onClick={onClose}>
      <div
        className="sheet-panel flex max-h-[85dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-[1.75rem] bg-bg px-5 pb-8 pt-2"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Editar ${entry.foodName}`}
      >
        <div className="mx-auto mb-4 h-1 w-9 shrink-0 rounded-full bg-line" aria-hidden />

        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>{entry.emoji}</span>
          <div className="min-w-0">
            <div className="truncate font-semibold">{entry.foodName}</div>
            <div className="text-xs text-muted">{Math.round(entry.grams)} {entry.unit} registados</div>
          </div>
        </div>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Quantidade ({entry.unit})</span>
          <input
            type="number"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full rounded-xl bg-surface px-4 py-3 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-accent"
            autoFocus
          />
        </label>

        <div className="mt-3 flex gap-2">
          {[0.5, 1, 1.5, 2].map((m) => {
            const g = Math.round(entry.grams * m)
            return (
              <button
                key={m}
                onClick={() => setQty(String(g))}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium ${
                  qty === String(g) ? 'border-accent bg-accent-soft text-accent' : 'border-transparent bg-surface text-ink-2'
                }`}
              >
                {m}×
              </button>
            )
          })}
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 rounded-2xl bg-surface p-4 text-center text-sm">
          <div><div className="font-bold tabular-nums">{Math.round(preview.carbs)}</div><div className="text-[10px] text-muted">Hidratos</div></div>
          <div><div className="font-bold tabular-nums">{Math.round(preview.protein)}</div><div className="text-[10px] text-muted">Proteína</div></div>
          <div><div className="font-bold tabular-nums">{Math.round(preview.fat)}</div><div className="text-[10px] text-muted">Gordura</div></div>
          <div><div className="font-bold tabular-nums">{Math.round(preview.kcal)}</div><div className="text-[10px] text-muted">kcal</div></div>
        </div>

        <span className="mb-1.5 mt-5 block text-sm font-medium text-ink-2">Refeição</span>
        <div className="flex flex-wrap gap-2">
          {MEALS.map((m) => (
            <button
              key={m.id}
              onClick={() => { haptic(8); setMeal(m.id) }}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                meal === m.id ? 'border-accent bg-accent-soft text-accent' : 'border-transparent bg-surface text-ink-2'
              }`}
            >
              {m.emoji} {m.label}
            </button>
          ))}
        </div>

        <button
          onClick={save}
          disabled={!valid}
          className="press mt-6 w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-white disabled:opacity-40"
        >
          {changed ? 'Guardar alterações' : 'Fechar'}
        </button>

        <div className="mt-2 flex gap-2">
          <button
            onClick={() => { haptic(10); onDuplicate(entry) }}
            className="press flex-1 rounded-full bg-surface py-2.5 text-sm font-semibold text-accent"
          >
            Duplicar
          </button>
          <button
            onClick={() => { haptic(10); onDelete(entry.id) }}
            className="press flex-1 rounded-full bg-surface py-2.5 text-sm font-semibold text-critical"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}
