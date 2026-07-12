import { useMemo, useState } from 'react'
import type { Profile, WaterLog } from '../../types'
import { shiftDate, todayISO } from '../../lib/store'
import { BarChart } from '../charts'
import { Card } from '../ui'

interface Props {
  profile: Profile
  setProfile: (p: Profile) => void
  water: WaterLog
  onClose: () => void
}

/** Histórico de água dos últimos 14 dias, com ajuste rápido da meta. */
export default function AguaDetail({ profile, setProfile, water, onClose }: Props) {
  const target = profile.targets.waterMl
  const [waterMl, setWaterMl] = useState(String(target))

  const points = useMemo(() => {
    const today = todayISO()
    return Array.from({ length: 14 }, (_, i) => {
      const iso = shiftDate(today, i - 13)
      const [, m, d] = iso.split('-').map(Number)
      const value = water[iso] ?? 0
      return {
        iso,
        label: `${d}/${m}`,
        value,
        logged: value > 0,
      }
    })
  }, [water])

  const loggedDays = points.filter((p) => p.logged)
  const avg = loggedDays.length > 0 ? Math.round(loggedDays.reduce((s, p) => s + p.value, 0) / loggedDays.length) : 0
  const daysOnTarget = points.filter((p) => p.value >= target).length
  let streak = 0
  for (let i = points.length - 1; i >= 0 && points[i].value >= target; i--) streak++

  const updateTarget = () => {
    const ml = Number(waterMl)
    if (!(ml >= 500 && ml <= 8000) || ml === target) return
    setProfile({ ...profile, targets: { ...profile.targets, waterMl: ml } })
  }

  return (
    <div className="sheet-panel scroll-contain fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto max-w-md px-4 pb-10">
        <header className="pt-5">
          <button onClick={onClose} className="text-sm font-medium text-accent">
            ‹ Diário
          </button>
        </header>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">💧 Água · 14 dias</h1>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatTile value={`${avg.toLocaleString('pt-PT')}`} label="média ml/dia" />
          <StatTile value={`${daysOnTarget}/14`} label="dias na meta" />
          <StatTile value={String(streak)} label="dias seguidos" />
        </div>

        <Card className="mt-3.5 p-5">
          <h2 className="text-[17px] font-semibold">Consumo por dia</h2>
          <BarChart
            points={points}
            target={target}
            ariaLabel="Água consumida nos últimos 14 dias"
            barColor="var(--water)"
            formatValue={(v) => `${Math.round(v).toLocaleString('pt-PT')} ml`}
          />
        </Card>

        <Card className="mt-3.5 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Meta diária</div>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={waterMl}
              onChange={(e) => setWaterMl(e.target.value)}
              className="w-28 rounded-lg bg-bg px-3 py-1.5 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Meta de água em ml"
            />
            <span className="self-center text-lg font-bold">ml</span>
            <button
              onClick={updateTarget}
              disabled={Number(waterMl) === target || !(Number(waterMl) >= 500 && Number(waterMl) <= 8000)}
              className="ml-auto rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
            >
              Atualizar
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card bg-surface p-4 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="text-xl font-bold">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted">{label}</div>
    </div>
  )
}
