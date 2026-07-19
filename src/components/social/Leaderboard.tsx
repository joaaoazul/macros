/** Classificação semanal (adesão ao plano) entre amigos. */

import { useEffect, useState } from 'react'
import { social, type LeaderboardOut } from '../../lib/social'
import { Card, ListSkeleton } from '../ui'

const MEDALS = ['🥇', '🥈', '🥉']

function weekLabel(start: string, end: string): string {
  const s = new Date(start + 'T00:00')
  const e = new Date(end + 'T00:00')
  const fmt = (d: Date) => d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
  return `Semana ${fmt(s)} – ${fmt(e)}`
}

export default function Leaderboard() {
  const [board, setBoard] = useState<LeaderboardOut | null>(null)

  useEffect(() => {
    social.leaderboard().then(setBoard).catch(() => setBoard({ week: { start: '', end: '' }, rows: [] }))
  }, [])

  if (!board) return <div className="px-4"><ListSkeleton rows={5} /></div>

  return (
    <div className="px-4">
      {board.week.start && (
        <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {weekLabel(board.week.start, board.week.end)} · dias no plano
        </p>
      )}
      <Card className="divide-y divide-line">
        {board.rows.map((r, i) => (
          <div
            key={r.userId}
            className={`animate-in flex items-center gap-3 p-4 ${r.isMe ? 'bg-accent-soft' : ''}`}
            style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
          >
            <span className="w-7 text-center text-lg font-bold" aria-label={`${r.rank}º lugar`}>
              {MEDALS[r.rank - 1] ?? r.rank}
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bg text-xl" aria-hidden>
              {r.avatar}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">
                @{r.username}
                {r.isMe && <span className="ml-1.5 text-xs font-medium text-accent">(tu)</span>}
              </div>
              {r.bonus > 0 && (
                <div className="text-xs text-muted" title="Bónus de água e exercício">
                  {'·'.repeat(0)}
                  {Array.from({ length: Math.min(r.bonus, 14) }).map((_, i) => (
                    <span key={i} className="text-accent">•</span>
                  ))}
                  <span className="ml-1">bónus</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xl font-bold">{r.daysOnPlan}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted">dias</div>
            </div>
          </div>
        ))}
        {board.rows.length <= 1 && (
          <p className="p-5 text-center text-sm text-ink-2">
            Adiciona amigos para competirem na classificação semanal. 🏆
          </p>
        )}
      </Card>
    </div>
  )
}
