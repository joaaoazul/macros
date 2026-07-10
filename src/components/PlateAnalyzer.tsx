import { useRef, useState } from 'react'
import type { Entry, MealId } from '../types'
import { uid } from '../lib/store'
import { analyzePlate, downscaleImage, getApiKey, type PlateItem } from '../lib/ai'

interface Props {
  meal: MealId
  onAdd: (entries: Entry[]) => void
  onClose: () => void
}

type Phase = 'pick' | 'loading' | 'review' | 'error' | 'nokey'

/** Fluxo: foto → estimativa da IA → revisão/edição → registar no diário. */
export default function PlateAnalyzer({ meal, onAdd, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>(getApiKey() ? 'pick' : 'nokey')
  const [items, setItems] = useState<(PlateItem & { checked: boolean })[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const analyze = async (file: File) => {
    setPhase('loading')
    setPreview(URL.createObjectURL(file))
    try {
      const { base64, mediaType } = await downscaleImage(file)
      const result = await analyzePlate(base64, mediaType, getApiKey())
      if (result.items.length === 0) {
        setError(result.notes || 'Não encontrei comida na fotografia.')
        setPhase('error')
        return
      }
      setItems(result.items.map((i) => ({ ...i, checked: true })))
      setNotes(result.notes)
      setPhase('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na análise. Verifica a chave API e a ligação.')
      setPhase('error')
    }
  }

  const confirm = () => {
    const entries: Entry[] = items
      .filter((i) => i.checked)
      .map((i) => ({
        id: uid(),
        meal,
        foodName: i.name,
        emoji: '🤖',
        grams: Math.round(i.grams),
        unit: 'g' as const,
        kcal: i.kcal,
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat,
      }))
    if (entries.length > 0) onAdd(entries)
  }

  const totalKcal = Math.round(items.filter((i) => i.checked).reduce((s, i) => s + i.kcal, 0))

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[88dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-[1.75rem] bg-bg px-5 pb-8 pt-2"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Analisar prato com IA"
      >
        <div className="mx-auto h-1 w-9 shrink-0 rounded-full bg-line" aria-hidden />
        <h2 className="mt-4 text-xl font-extrabold">📸 Analisar prato com IA</h2>

        {phase === 'nokey' && (
          <div className="mt-4">
            <p className="text-[14px] leading-relaxed text-ink-2">
              Esta função usa a API da Claude (Anthropic) para estimar os macros a partir de uma foto. Precisa de uma chave API tua —
              configura-a no <strong>Perfil → Inteligência artificial</strong>. A chave fica guardada só neste dispositivo e pagas
              diretamente à Anthropic o que usares (cêntimos por foto).
            </p>
            <button onClick={onClose} className="mt-5 w-full rounded-full bg-accent px-6 py-3.5 font-bold text-on-accent">
              Entendi
            </button>
          </div>
        )}

        {phase === 'pick' && (
          <div className="mt-4">
            <p className="text-[14px] text-ink-2">Tira uma foto ao prato (de cima, com boa luz) e a IA estima os alimentos e macros. Confirmas tudo antes de registar.</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) analyze(f)
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-5 w-full rounded-full bg-accent px-6 py-3.5 font-bold text-on-accent transition-opacity active:opacity-80"
            >
              📷 Tirar / escolher foto
            </button>
            <p className="mt-3 text-center text-[12px] text-muted">A foto é enviada à API da Anthropic apenas para esta análise.</p>
          </div>
        )}

        {phase === 'loading' && (
          <div className="mt-4 text-center">
            {preview && <img src={preview} alt="Prato a analisar" className="mx-auto max-h-52 rounded-2xl object-cover" />}
            <div className="mt-5 flex items-center justify-center gap-2 text-[14.5px] font-semibold text-ink-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
              A analisar o prato…
            </div>
            <p className="mt-1 text-[12px] text-muted">Normalmente demora 5–15 segundos.</p>
          </div>
        )}

        {phase === 'review' && (
          <div className="mt-3">
            {preview && <img src={preview} alt="Prato analisado" className="mx-auto max-h-36 rounded-2xl object-cover" />}
            <p className="mt-3 text-[12.5px] text-muted">{notes} — ajusta os valores antes de registar.</p>

            <ul className="mt-3 space-y-2">
              {items.map((item, idx) => (
                <li key={idx} className={`rounded-2xl bg-surface p-3.5 ${item.checked ? '' : 'opacity-45'}`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => setItems((arr) => arr.map((x, i) => (i === idx ? { ...x, checked: !x.checked } : x)))}
                      className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                      aria-label={`Incluir ${item.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14.5px] font-bold">{item.name}</div>
                      <div className="text-[12px] tabular-nums text-muted">
                        P {Math.round(item.protein)} · H {Math.round(item.carbs)} · G {Math.round(item.fat)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={Math.round(item.grams)}
                        onChange={(e) => {
                          const g = Number(e.target.value)
                          setItems((arr) =>
                            arr.map((x, i) => {
                              if (i !== idx || !(g > 0)) return i === idx ? { ...x, grams: g } : x
                              const f = g / x.grams
                              return { ...x, grams: g, kcal: x.kcal * f, protein: x.protein * f, carbs: x.carbs * f, fat: x.fat * f }
                            }),
                          )
                        }}
                        className="w-16 rounded-lg bg-bg px-2 py-1 text-right text-[14px] font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                        aria-label={`Gramas de ${item.name}`}
                      />
                      <span className="text-[12px] text-muted">g</span>
                    </div>
                    <span className="w-12 text-right text-[14.5px] font-extrabold tabular-nums">{Math.round(item.kcal)}</span>
                  </div>
                </li>
              ))}
            </ul>

            <button
              onClick={confirm}
              disabled={items.every((i) => !i.checked)}
              className="mt-4 w-full rounded-full bg-accent px-6 py-3.5 font-bold text-on-accent transition-opacity active:opacity-80 disabled:opacity-40"
            >
              Registar {totalKcal} kcal
            </button>
            <button onClick={() => setPhase('pick')} className="mt-2 w-full py-2 text-center text-sm font-bold text-accent">
              Tentar outra foto
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div className="mt-4">
            <p className="rounded-2xl bg-surface p-4 text-[14px] leading-relaxed text-ink-2">⚠️ {error}</p>
            <button onClick={() => setPhase('pick')} className="mt-4 w-full rounded-full bg-accent px-6 py-3.5 font-bold text-on-accent">
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
