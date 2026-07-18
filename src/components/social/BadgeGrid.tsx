/** Vitrine de conquistas: todas as badges do catálogo, ganhas a cores vs por desbloquear. */

import { useEffect, useMemo, useState } from 'react'
import { social, type BadgeCatalogItem, type BadgeEarned } from '../../lib/social'

interface Props {
  earned: string[]
  earnedDetail?: BadgeEarned[]
  onClose: () => void
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function BadgeGrid({ earned, earnedDetail, onClose }: Props) {
  const [catalog, setCatalog] = useState<BadgeCatalogItem[] | null>(null)
  const earnedSet = useMemo(() => new Set(earned), [earned])
  const dates = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of earnedDetail ?? []) m.set(b.kind, b.earnedOn)
    return m
  }, [earnedDetail])

  useEffect(() => {
    social.badgesCatalog().then(setCatalog).catch(() => setCatalog([]))
  }, [])

  const sorted = useMemo(() => {
    if (!catalog) return []
    return [...catalog].sort((a, b) => Number(earnedSet.has(b.kind)) - Number(earnedSet.has(a.kind)))
  }, [catalog, earnedSet])

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/40 sheet-backdrop" onClick={onClose}>
      <div
        className="sheet-panel max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-bg p-5 scroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Conquistas</h2>
          {catalog && (
            <span className="text-sm text-muted">{earnedSet.size}/{catalog.length}</span>
          )}
        </div>

        {catalog === null ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton aspect-square rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {sorted.map((b, i) => {
              const got = earnedSet.has(b.kind)
              const on = dates.get(b.kind)
              return (
                <div
                  key={b.kind}
                  title={b.description}
                  style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                  className={`animate-in flex flex-col items-center rounded-2xl p-3 text-center ${
                    got ? 'bg-surface' : 'bg-surface/50 opacity-50 grayscale'
                  }`}
                >
                  <span className={`text-3xl ${got ? 'animate-pop' : ''}`} aria-hidden>{b.emoji}</span>
                  <div className="mt-1.5 text-[11px] font-semibold leading-tight">{b.title}</div>
                  <div className="mt-0.5 text-[10px] leading-tight text-muted">
                    {got ? (on ? formatDate(on) : 'Desbloqueada') : b.description}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
