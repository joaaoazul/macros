/** Copiar os alimentos de uma refeição para outra — do mesmo dia (almoço → jantar)
 * ou de um dia anterior. Podes copiar tudo ou só alguns itens.
 *
 * Não escreve nada: devolve as entradas já clonadas (ids novos, refeição de
 * destino) para quem chama meter via setDiary — é isso que dispara o PUT
 * full-replace e respeita o portão de sincronização. */

import { useMemo, useState } from 'react'
import type { Diary, Entry, MealId } from '../types'
import { MEALS } from '../types'
import { formatDatePT, haptic, uid } from '../lib/store'
import { Z } from './ui'

interface Props {
  diary: Diary
  /** dia de destino */
  currentDate: string
  /** refeição de destino */
  target: MealId
  onCopy: (entries: Entry[]) => void
  onClose: () => void
}

/** Uma refeição de um dia, candidata a ser copiada. */
interface Source {
  iso: string
  meal: MealId
  entries: Entry[]
  kcal: number
}

const mealLabel = (id: MealId) => MEALS.find((m) => m.id === id)?.label ?? ''
const mealEmoji = (id: MealId) => MEALS.find((m) => m.id === id)?.emoji ?? '🍽️'

export default function CopyMealSheet({ diary, currentDate, target, onCopy, onClose }: Props) {
  const [source, setSource] = useState<Source | null>(null)
  const [skipped, setSkipped] = useState<Set<number>>(new Set())

  /** Todas as refeições com itens, exceto a própria de destino. Hoje primeiro,
   * depois os dias anteriores por ordem decrescente (30 dias no máximo). */
  const { todaySources, pastSources } = useMemo(() => {
    const build = (iso: string): Source[] =>
      MEALS.map((m) => (diary[iso] ?? []).filter((e) => e.meal === m.id))
        .filter((entries) => entries.length > 0)
        .map((entries) => ({
          iso,
          meal: entries[0].meal,
          entries,
          kcal: entries.reduce((s, e) => s + e.kcal, 0),
        }))

    const today = build(currentDate).filter((s) => s.meal !== target)
    const past = Object.keys(diary)
      .filter((iso) => iso !== currentDate)
      .sort((a, b) => (a < b ? 1 : -1)) // ISO desc = mais recente primeiro
      .slice(0, 30)
      .flatMap(build)
    return { todaySources: today, pastSources: past }
  }, [diary, currentDate, target])

  const open = (s: Source) => {
    haptic(8)
    setSource(s)
    setSkipped(new Set())
  }

  const toggle = (i: number) => {
    haptic(8)
    setSkipped((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const chosen = source ? source.entries.filter((_, i) => !skipped.has(i)) : []

  const confirm = () => {
    if (chosen.length === 0) return
    haptic(20)
    // ids novos para não colidir com a refeição de origem; a refeição passa a ser a de destino
    onCopy(chosen.map((e) => ({ ...e, id: uid(), meal: target })))
  }

  return (
    <div className={`fixed inset-0 ${Z.modal} flex items-end justify-center bg-black/40 sheet-backdrop`} onClick={onClose}>
      <div
        className="sheet-panel flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-[1.75rem] bg-bg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Copiar para ${mealLabel(target)}`}
      >
        <div className="mx-auto mb-3 mt-2 h-1 w-9 shrink-0 rounded-full bg-line" aria-hidden />

        {!source ? (
          <>
            <div className="px-5">
              <h2 className="text-lg font-bold">Copiar para {mealLabel(target).toLowerCase()}</h2>
              <p className="mt-0.5 text-sm text-muted">Escolhe a refeição de onde queres trazer os alimentos.</p>
            </div>

            <div className="scroll-contain flex-1 overflow-y-auto px-5 pb-6 pt-3">
              {todaySources.length === 0 && pastSources.length === 0 && (
                <p className="py-8 text-center text-sm text-muted">
                  Ainda não há refeições registadas para copiar.
                </p>
              )}

              {todaySources.length > 0 && (
                <>
                  <SectionLabel>Hoje</SectionLabel>
                  <ul className="space-y-2">
                    {todaySources.map((s) => (
                      <SourceRow key={`t-${s.meal}`} source={s} showDate={false} onPick={open} />
                    ))}
                  </ul>
                </>
              )}

              {pastSources.length > 0 && (
                <>
                  <SectionLabel>Dias anteriores</SectionLabel>
                  <ul className="space-y-2">
                    {pastSources.map((s) => (
                      <SourceRow key={`p-${s.iso}-${s.meal}`} source={s} showDate onPick={open} />
                    ))}
                  </ul>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="px-5">
              <button onClick={() => setSource(null)} className="text-sm font-medium text-accent">
                ‹ Outra refeição
              </button>
              <h2 className="mt-2 text-lg font-bold">
                {mealEmoji(source.meal)} {mealLabel(source.meal)}
                {source.iso !== currentDate && (
                  <span className="font-normal text-muted"> · {formatDatePT(source.iso)}</span>
                )}
              </h2>
              <p className="mt-0.5 text-sm text-muted">Toca para tirar o que não queres levar.</p>
            </div>

            <ul className="scroll-contain mt-3 flex-1 overflow-y-auto px-5">
              {source.entries.map((e, i) => {
                const on = !skipped.has(i)
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => toggle(i)}
                      className="row-press flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left"
                      aria-pressed={on}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          on ? 'bg-accent text-white' : 'bg-surface text-muted'
                        }`}
                        aria-hidden
                      >
                        {on ? '✓' : ''}
                      </span>
                      <span className="text-lg" aria-hidden>{e.emoji}</span>
                      <span className={`min-w-0 flex-1 ${on ? '' : 'opacity-40'}`}>
                        <span className="block truncate text-[15px] font-medium">{e.foodName}</span>
                        <span className="block text-[12px] text-muted">
                          {Math.round(e.grams)} {e.unit} · {Math.round(e.kcal)} kcal
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="border-t border-line px-5 pb-6 pt-3">
              <button
                onClick={confirm}
                disabled={chosen.length === 0}
                className="press w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-white disabled:opacity-40"
              >
                Copiar {chosen.length} {chosen.length === 1 ? 'alimento' : 'alimentos'} ·{' '}
                {Math.round(chosen.reduce((s, e) => s + e.kcal, 0))} kcal
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-muted first:mt-0">{children}</div>
}

function SourceRow({ source, showDate, onPick }: { source: Source; showDate: boolean; onPick: (s: Source) => void }) {
  return (
    <li>
      <button
        onClick={() => onPick(source)}
        className="press flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left"
      >
        <span className="text-xl" aria-hidden>{mealEmoji(source.meal)}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">
            {mealLabel(source.meal)}
            {showDate && <span className="font-normal text-muted"> · {formatDatePT(source.iso)}</span>}
          </div>
          <div className="truncate text-[12px] text-muted">
            {source.entries.map((e) => e.foodName).join(' + ')}
          </div>
        </div>
        <span className="shrink-0 text-[12px] tabular-nums text-muted">{Math.round(source.kcal)} kcal</span>
      </button>
    </li>
  )
}
