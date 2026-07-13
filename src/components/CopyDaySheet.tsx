/** Copiar todas as refeições de um dia anterior para o dia atual (novos ids). */

import { useMemo } from 'react'
import type { Diary, Entry } from '../types'
import { sumEntries } from '../lib/calc'
import { formatDatePT, uid } from '../lib/store'

interface Props {
  diary: Diary
  currentDate: string // dia de destino (não aparece na lista)
  onCopy: (entries: Entry[]) => void
  onClose: () => void
}

/** Dia candidato: tem entradas e não é o dia de destino. Mais recentes primeiro. */
interface Candidate {
  iso: string
  entries: Entry[]
  kcal: number
}

export default function CopyDaySheet({ diary, currentDate, onCopy, onClose }: Props) {
  const candidates = useMemo<Candidate[]>(() => {
    return Object.entries(diary)
      .filter(([iso, entries]) => iso !== currentDate && entries.length > 0)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // ISO desc = mais recente primeiro
      .slice(0, 30)
      .map(([iso, entries]) => ({ iso, entries, kcal: sumEntries(entries).kcal }))
  }, [diary, currentDate])

  const copy = (c: Candidate) => {
    // clona cada entrada com um id novo para não colidir com o dia de origem
    const cloned = c.entries.map((e) => ({ ...e, id: uid() }))
    navigator.vibrate?.(20)
    onCopy(cloned)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="sheet-panel flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-[1.75rem] bg-bg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Copiar dia"
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line" aria-hidden />
        <div className="px-5 pt-3">
          <h2 className="text-lg font-bold">Copiar de outro dia</h2>
          <p className="mt-0.5 text-sm text-muted">As refeições são adicionadas ao dia atual.</p>
        </div>

        <div className="scroll-contain flex-1 overflow-y-auto px-5 pb-6 pt-3">
          {candidates.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Ainda não há dias anteriores com refeições para copiar.
            </p>
          ) : (
            <ul className="space-y-2">
              {candidates.map((c) => (
                <li key={c.iso}>
                  <button
                    onClick={() => copy(c)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left transition active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold capitalize">{formatDatePT(c.iso)}</div>
                      <div className="text-[12px] text-muted">
                        {c.entries.length} {c.entries.length === 1 ? 'alimento' : 'alimentos'} ·{' '}
                        {Math.round(c.kcal)} kcal
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                      Copiar
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
