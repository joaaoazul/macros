/** Escolher em que dias/refeições pôr uma receita — "cozinhar uma vez, comer três dias".
 *
 * Os slots já ocupados ficam marcados: substituir é legítimo, mas nunca deve
 * ser surpresa, por isso o botão diz quantos vai substituir. */

import { useState } from 'react'
import { PLAN_MEALS, WEEKDAYS_SHORT, todayWeekday } from '../lib/shopping'
import type { PlanMeal, SlotTarget } from '../lib/planner'
import { haptic } from '../lib/store'
import { Button, Z } from './ui'

interface Props {
  title: string
  emoji?: string
  /** slots já preenchidos, para avisar que vão ser substituídos */
  occupied: (day: number, meal: PlanMeal) => boolean
  /** slot de origem, que não deve aparecer como alvo (ao copiar) */
  exclude?: SlotTarget
  onConfirm: (targets: SlotTarget[]) => void
  onClose: () => void
}

const keyOf = (t: SlotTarget) => `${t.day}|${t.meal}`

export default function PlanTargetSheet({ title, emoji, occupied, exclude, onConfirm, onClose }: Props) {
  const [picked, setPicked] = useState<SlotTarget[]>([])
  const today = todayWeekday()

  const isPicked = (t: SlotTarget) => picked.some((p) => keyOf(p) === keyOf(t))
  const toggle = (t: SlotTarget) => {
    haptic(8)
    setPicked((ps) => (isPicked(t) ? ps.filter((p) => keyOf(p) !== keyOf(t)) : [...ps, t]))
  }

  const replacing = picked.filter((t) => occupied(t.day, t.meal)).length

  return (
    <div className={`fixed inset-0 ${Z.modal} flex items-end justify-center bg-black/40 sheet-backdrop`} onClick={onClose}>
      <div
        className="sheet-panel flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-[1.75rem] bg-bg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Escolher dias e refeições"
      >
        <header className="px-5 pb-1 pt-4">
          <h2 className="truncate text-lg font-bold">
            {emoji && <span aria-hidden>{emoji} </span>}
            {title}
          </h2>
          <p className="text-sm text-muted">Escolhe os dias e as refeições.</p>
        </header>

        <div className="scroll-contain flex-1 overflow-y-auto px-5 pt-2">
          <div className="overflow-hidden rounded-card bg-surface">
            {WEEKDAYS_SHORT.map((label, day) => (
              <div key={day} className="hairline-b flex items-center gap-2 px-3 py-2 last:border-b-0">
                <span className={`w-9 shrink-0 text-[13px] font-semibold ${day === today ? 'text-accent' : 'text-ink-2'}`}>
                  {label}
                </span>
                {PLAN_MEALS.map((m) => {
                  const t: SlotTarget = { day, meal: m.id }
                  if (exclude && keyOf(exclude) === keyOf(t)) {
                    return (
                      <span key={m.id} className="flex-1 py-2 text-center text-xs text-muted" aria-hidden>
                        origem
                      </span>
                    )
                  }
                  const on = isPicked(t)
                  const taken = occupied(day, m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggle(t)}
                      aria-pressed={on}
                      className={`press flex-1 rounded-xl py-2 text-xs font-semibold transition-colors ${
                        on ? 'bg-accent text-white' : 'bg-bg text-ink-2'
                      }`}
                    >
                      {m.label}
                      {taken && (
                        <span className={`ml-1 text-[10px] font-medium ${on ? 'text-white/80' : 'text-muted'}`}>
                          • ocupado
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          {replacing > 0 && (
            <p className="mt-2 px-1 text-xs text-muted">
              {replacing === 1
                ? 'Vais substituir 1 refeição já planeada.'
                : `Vais substituir ${replacing} refeições já planeadas.`}
            </p>
          )}
        </div>

        <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
          <Button full size="lg" disabled={picked.length === 0} onClick={() => onConfirm(picked)}>
            {picked.length === 0 ? 'Escolhe um dia' : `Planear (${picked.length})`}
          </Button>
        </div>
      </div>
    </div>
  )
}
