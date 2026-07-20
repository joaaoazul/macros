/** Biblioteca de receitas: procura + filtro por etiqueta sobre o catálogo
 * empacotado (src/data/recipes.pt), carregado em lazy. "Adicionar" delega ao
 * pai (Receitas), que trata do limite e da sincronização via setRecipes. */

import { useEffect, useMemo, useState } from 'react'
import type { LibraryRecipe } from '../types'
import { haptic } from '../lib/store'
import { Button, Card, EmptyState, ListSkeleton, Z } from './ui'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const kcalPerServing = (r: LibraryRecipe) =>
  Math.round(r.items.reduce((s, i) => s + i.kcal, 0) / Math.max(1, r.servings))

export default function RecipeLibrary({
  onAdd,
  onClose,
}: {
  onAdd: (r: LibraryRecipe) => boolean
  onClose: () => void
}) {
  const [all, setAll] = useState<LibraryRecipe[] | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let alive = true
    import('../data/recipes.pt').then((m) => {
      if (!alive) return
      setAll(m.RECIPES_PT)
      setTags(m.RECIPE_TAGS)
    })
    return () => {
      alive = false
    }
  }, [])

  const results = useMemo(() => {
    if (!all) return []
    const q = norm(query.trim())
    return all.filter((r) => {
      if (tag && !r.tags.includes(tag)) return false
      if (!q) return true
      return (
        norm(r.name).includes(q) ||
        r.tags.some((t) => norm(t).includes(q)) ||
        r.items.some((i) => norm(i.foodName).includes(q))
      )
    })
  }, [all, query, tag])

  const add = (r: LibraryRecipe) => {
    haptic()
    if (onAdd(r)) setAdded((s) => new Set(s).add(r.id))
  }

  return (
    <div className={`fixed inset-0 ${Z.sheet} flex flex-col bg-bg`}>
      <header className="flex items-center justify-between border-b border-line/70 bg-surface/80 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div>
          <h2 className="text-lg font-bold">Biblioteca de receitas</h2>
          <p className="text-xs text-muted">Receitas prontas a adicionar às tuas</p>
        </div>
        <button onClick={onClose} className="press text-accent" aria-label="Fechar">
          <span className="text-sm font-medium">Fechar</span>
        </button>
      </header>

      <div className="px-4 pt-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Procurar receita ou ingrediente…"
          className="w-full rounded-xl bg-surface px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {tags.length > 0 && (
          <div className="scroll-contain -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-1">
            <TagChip label="Todas" active={tag === null} onClick={() => setTag(null)} />
            {tags.map((t) => (
              <TagChip key={t} label={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)} />
            ))}
          </div>
        )}
      </div>

      <div className="scroll-contain flex-1 space-y-2.5 overflow-y-auto px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {all === null ? (
          <ListSkeleton rows={5} avatar={false} />
        ) : results.length === 0 ? (
          <EmptyState emoji="🍽️" title="Nada encontrado" hint="Tenta outra palavra ou etiqueta." />
        ) : (
          results.map((r) => (
            <Card key={r.id} className="p-3.5">
              <div className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden>{r.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{r.name}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {kcalPerServing(r)} kcal/dose · {r.servings} {r.servings === 1 ? 'dose' : 'doses'}
                    {r.minutes ? ` · ${r.minutes} min` : ''}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {r.tags.slice(0, 3).map((t) => (
                      <span key={t} className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 truncate text-xs text-ink-2">
                    {r.items.map((i) => i.foodName).join(', ')}
                  </p>
                </div>
                {added.has(r.id) ? (
                  <span className="shrink-0 self-center text-xs font-semibold text-muted">Adicionada ✓</span>
                ) : (
                  <Button size="sm" onClick={() => add(r)} className="shrink-0 self-center">
                    Adicionar
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

function TagChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`press shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
        active ? 'bg-accent text-white' : 'bg-surface text-ink-2'
      }`}
    >
      {label}
    </button>
  )
}
