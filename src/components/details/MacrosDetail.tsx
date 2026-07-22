import { useState } from 'react'
import type { Profile } from '../../types'
import { Card, Z } from '../ui'

interface Props {
  profile: Profile
  setProfile: (p: Profile) => void
  onClose: () => void
}

/** Detalhe das metas por macro: gramas, kcal (4-4-9) e %, com edição direta por gramas. */
export default function MacrosDetail({ profile, setProfile, onClose }: Props) {
  const { targets } = profile
  const [carbs, setCarbs] = useState(String(targets.carbs))
  const [protein, setProtein] = useState(String(targets.protein))
  const [fat, setFat] = useState(String(targets.fat))

  const carbsN = Number(carbs)
  const proteinN = Number(protein)
  const fatN = Number(fat)
  const kcal = Math.round(carbsN * 4 + proteinN * 4 + fatN * 9)
  const valid =
    carbsN >= 0 && proteinN >= 0 && fatN >= 0 && kcal >= 800 && kcal <= 8000 &&
    carbs !== '' && protein !== '' && fat !== ''
  const changed = carbsN !== targets.carbs || proteinN !== targets.protein || fatN !== targets.fat

  const pct = (macroKcal: number) => (kcal > 0 ? Math.round((macroKcal / kcal) * 100) : 0)

  const save = () => {
    setProfile({
      ...profile,
      targets: { ...targets, kcal, carbs: carbsN, protein: proteinN, fat: fatN },
    })
    onClose()
  }

  return (
    <div className={`sheet-panel scroll-contain fixed inset-0 ${Z.screen} overflow-y-auto bg-bg`}>
      <div className="mx-auto max-w-md px-4 pb-10">
        <header className="pt-5">
          <button onClick={onClose} className="text-sm font-medium text-accent">
            ‹ Metas
          </button>
        </header>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Detalhe dos macros</h1>
        <p className="mt-1 text-sm text-muted">Edita as gramas — as calorias recalculam-se (4-4-9).</p>

        <Card className="mt-4 divide-y divide-line">
          <MacroRow label="Hidratos" colorVar="--carbs" grams={carbs} setGrams={setCarbs} kcalPerG={4} pct={pct(carbsN * 4)} />
          <MacroRow label="Proteína" colorVar="--protein" grams={protein} setGrams={setProtein} kcalPerG={4} pct={pct(proteinN * 4)} />
          <MacroRow label="Gordura" colorVar="--fat" grams={fat} setGrams={setFat} kcalPerG={9} pct={pct(fatN * 9)} />
        </Card>

        <Card className="mt-3.5 flex items-center justify-between p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Meta de calorias resultante</div>
            <div className="text-3xl font-bold tracking-tight tabular-nums">{kcal.toLocaleString('pt-PT')} kcal</div>
          </div>
          <span className="text-2xl" aria-hidden>🔥</span>
        </Card>

        {!valid && (
          <p role="alert" className="mt-3 text-center text-sm font-medium text-critical">
            A meta tem de ficar entre 800 e 8000 kcal.
          </p>
        )}

        <button
          onClick={save}
          disabled={!valid || !changed}
          className="mt-5 w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
        >
          Guardar metas
        </button>
      </div>
    </div>
  )
}

function MacroRow({
  label,
  colorVar,
  grams,
  setGrams,
  kcalPerG,
  pct,
}: {
  label: string
  colorVar: string
  grams: string
  setGrams: (v: string) => void
  kcalPerG: number
  pct: number
}) {
  const kcal = Math.round((Number(grams) || 0) * kcalPerG)
  return (
    <div className="flex items-center gap-4 p-4">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: `var(${colorVar})` }} aria-hidden />
      <div className="flex-1">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs tabular-nums text-muted">
          {kcal.toLocaleString('pt-PT')} kcal · {pct}% · {kcalPerG} kcal/g
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          className="w-20 rounded-lg bg-bg px-3 py-1.5 text-right text-lg font-bold focus:outline-none focus:ring-2 focus:ring-accent"
          aria-label={`Gramas de ${label}`}
        />
        <span className="text-sm font-semibold text-muted">g</span>
      </div>
    </div>
  )
}
