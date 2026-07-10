import { useState } from 'react'
import type { Profile } from '../types'
import { splitFromTargets, targetsFromSplit } from '../lib/calc'
import { Card, LargeTitle } from './ui'

interface Props {
  profile: Profile
  setProfile: (p: Profile) => void
}

export default function Metas({ profile, setProfile }: Props) {
  const [editing, setEditing] = useState(false)
  const { targets } = profile
  const split = splitFromTargets(targets)

  return (
    <div>
      <LargeTitle title="Metas" subtitle="Os teus alvos diários" />

      <div className="space-y-3.5 px-4 pt-2">
        {/* meta de calorias */}
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-2xl" aria-hidden>
            🔥
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Meta de calorias</div>
            <div className="text-3xl font-bold tracking-tight">{targets.kcal.toLocaleString('pt-PT')} kcal</div>
          </div>
        </Card>

        {/* macronutrientes */}
        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">Macronutrientes</h2>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <MacroCol label="Hidratos" grams={targets.carbs} kcal={targets.carbs * 4} colorVar="--carbs" />
            <MacroCol label="Proteína" grams={targets.protein} kcal={targets.protein * 4} colorVar="--protein" />
            <MacroCol label="Gordura" grams={targets.fat} kcal={targets.fat * 9} colorVar="--fat" />
          </div>

          <Donut carbsPct={split.carbsPct} proteinPct={split.proteinPct} fatPct={split.fatPct} />

          {/* legenda — a cor identifica, o texto fica em tinta */}
          <div className="mt-4 flex justify-center gap-5 text-sm">
            <LegendItem label="Hidratos" colorVar="--carbs" />
            <LegendItem label="Proteína" colorVar="--protein" />
            <LegendItem label="Gordura" colorVar="--fat" />
          </div>

          <button
            onClick={() => setEditing(true)}
            className="mt-5 flex w-full items-center justify-between border-t border-line pt-4 text-left text-[15px] font-semibold text-accent"
          >
            Editar macronutrientes <span className="text-muted">›</span>
          </button>
        </Card>

        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-semibold">Meta de água</h2>
            <span className="tabular-nums text-ink-2">💧 {targets.waterMl.toLocaleString('pt-PT')} ml</span>
          </div>
          <p className="mt-1 text-xs text-muted">Ajustável no Perfil — por omissão ~35 ml por kg de peso.</p>
        </Card>
      </div>

      {editing && (
        <EditSheet
          kcal={targets.kcal}
          split={split}
          onClose={() => setEditing(false)}
          onSave={(kcal, carbsPct, proteinPct, fatPct) => {
            setProfile({ ...profile, targets: targetsFromSplit(kcal, carbsPct, proteinPct, fatPct, targets.waterMl) })
            setEditing(false)
          }}
        />
      )}
    </div>
  )
}

function MacroCol({ label, grams, kcal, colorVar }: { label: string; grams: number; kcal: number; colorVar: string }) {
  return (
    <div>
      <div className="text-sm font-bold" style={{ color: `var(${colorVar})` }}>
        {label}
      </div>
      <div className="mt-0.5 text-xl font-bold tabular-nums">{grams} g</div>
      <div className="text-xs text-muted">{kcal.toLocaleString('pt-PT')} kcal</div>
    </div>
  )
}

function LegendItem({ label, colorVar }: { label: string; colorVar: string }) {
  return (
    <span className="flex items-center gap-1.5 text-ink-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(${colorVar})` }} aria-hidden />
      {label}
    </span>
  )
}

/** Donut SVG da repartição de macros, com rótulos de % dentro das fatias. */
function Donut({ carbsPct, proteinPct, fatPct }: { carbsPct: number; proteinPct: number; fatPct: number }) {
  const size = 190
  const cx = size / 2
  const r = 62
  const thickness = 40

  const slices = [
    { pct: carbsPct, colorVar: '--carbs', label: 'Hidratos' },
    { pct: proteinPct, colorVar: '--protein', label: 'Proteína' },
    { pct: fatPct, colorVar: '--fat', label: 'Gordura' },
  ].filter((s) => s.pct > 0)

  let acc = 0
  const arcs = slices.map((s) => {
    const start = (acc / 100) * Math.PI * 2 - Math.PI / 2
    acc += s.pct
    const end = (acc / 100) * Math.PI * 2 - Math.PI / 2
    const mid = (start + end) / 2
    return { ...s, start, end, mid }
  })

  const point = (angle: number, radius: number) => [cx + radius * Math.cos(angle), cx + radius * Math.sin(angle)]

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto mt-5 block w-48"
      role="img"
      aria-label={`Repartição: hidratos ${carbsPct}%, proteína ${proteinPct}%, gordura ${fatPct}%`}
    >
      {arcs.map((a) => {
        const [x1, y1] = point(a.start, r)
        const [x2, y2] = point(a.end, r)
        const large = a.pct > 50 ? 1 : 0
        return (
          <path
            key={a.colorVar}
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
            fill="none"
            stroke={`var(${a.colorVar})`}
            strokeWidth={thickness}
            // 2px de superfície entre fatias (regra de espaçadores)
            strokeDasharray={`${(a.end - a.start) * r - 2} ${Math.PI * 2 * r}`}
          />
        )
      })}
      {arcs.map((a) => {
        if (a.pct < 8) return null
        const [lx, ly] = point(a.mid, r)
        return (
          <text key={`t${a.colorVar}`} x={lx} y={ly + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill="#ffffff">
            {a.pct}
          </text>
        )
      })}
    </svg>
  )
}

function EditSheet({
  kcal: kcal0,
  split,
  onSave,
  onClose,
}: {
  kcal: number
  split: { carbsPct: number; proteinPct: number; fatPct: number }
  onSave: (kcal: number, carbsPct: number, proteinPct: number, fatPct: number) => void
  onClose: () => void
}) {
  const [kcal, setKcal] = useState(String(kcal0))
  const [carbs, setCarbs] = useState(String(split.carbsPct))
  const [protein, setProtein] = useState(String(split.proteinPct))
  const [fat, setFat] = useState(String(split.fatPct))

  const pcts = [Number(carbs), Number(protein), Number(fat)]
  const total = pcts[0] + pcts[1] + pcts[2]
  const kcalN = Number(kcal)
  const valid = total === 100 && pcts.every((p) => p >= 0 && p <= 100) && kcalN >= 800 && kcalN <= 8000

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-[1.75rem] bg-bg px-5 pb-8 pt-2"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Editar macronutrientes"
      >
        <div className="mx-auto h-1 w-9 rounded-full bg-line" aria-hidden />
        <h2 className="mt-4 text-xl font-bold">Editar macronutrientes</h2>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Meta de calorias (kcal)</span>
          <input type="number" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} className={inputCls} />
        </label>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <PctField label="Hidratos" colorVar="--carbs" value={carbs} onChange={setCarbs} />
          <PctField label="Proteína" colorVar="--protein" value={protein} onChange={setProtein} />
          <PctField label="Gordura" colorVar="--fat" value={fat} onChange={setFat} />
        </div>

        <p className={`mt-3 text-center text-sm font-medium ${total === 100 ? 'text-good' : 'text-critical'}`}>
          Total: {total} % {total !== 100 && '(tem de somar 100)'}
        </p>

        <button
          onClick={() => onSave(kcalN, Number(carbs), Number(protein), Number(fat))}
          disabled={!valid}
          className="mt-4 w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-on-accent transition-opacity active:opacity-80 disabled:opacity-40"
        >
          Guardar
        </button>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-xl bg-surface px-4 py-3 text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-accent'

function PctField({ label, colorVar, value, onChange }: { label: string; colorVar: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-center">
      <span className="mb-1.5 block text-sm font-bold" style={{ color: `var(${colorVar})` }}>
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} pr-7 text-center`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">%</span>
      </div>
    </label>
  )
}
