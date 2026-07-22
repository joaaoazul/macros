import { useEffect, useRef, useState } from 'react'
import type { Entry, MealId } from '../types'
import { ApiError } from '../lib/api'
import { analyzeMeal, downscaleImage, getAnthropicKey, type AnalyzedFood } from '../lib/ai'
import { uid } from '../lib/store'
import { SegmentedControl } from './ui'

interface Props {
  meal: MealId
  /** foto já escolhida noutro sítio (ex.: partilhada de outra app) */
  initialPhoto?: File | null
  onAdd: (entry: Entry) => void
  onDone: () => void
  onCancel: () => void
}

type Step = 'input' | 'loading' | 'results'

interface ResultRow extends AnalyzedFood {
  checked: boolean
  /** macros originais para rescalar proporcionalmente ao editar gramas */
  base: AnalyzedFood
}

export default function AiMealAnalysis({ meal, initialPhoto = null, onAdd, onDone, onCancel }: Props) {
  const [step, setStep] = useState<Step>('input')
  const [mode, setMode] = useState<'meal' | 'buffet'>('meal')
  const [description, setDescription] = useState('')
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [rows, setRows] = useState<ResultRow[]>([])
  const [notes, setNotes] = useState<string | null>(null)
  const [error, setError] = useState('')
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const hasKey = getAnthropicKey() !== null

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      setImageBase64(await downscaleImage(file))
    } catch {
      setError('Não foi possível processar a foto.')
    }
  }

  // foto que veio partilhada de outra app: entra como se a tivesses escolhido
  useEffect(() => {
    if (initialPhoto) void pickPhoto(initialPhoto)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPhoto])

  const analyze = async () => {
    setError('')
    setStep('loading')
    try {
      const result = await analyzeMeal({
        description: description.trim() || undefined,
        imageBase64: imageBase64 ?? undefined,
        mode,
      })
      setRows(result.foods.map((f) => ({ ...f, checked: true, base: f })))
      setNotes(result.notes ?? null)
      setStep('results')
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'A análise falhou.')
      setStep('input')
    }
  }

  const setGrams = (i: number, grams: number) => {
    setRows((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r
        const factor = r.base.grams > 0 && grams > 0 ? grams / r.base.grams : 0
        return {
          ...r,
          grams,
          kcal: r.base.kcal * factor,
          protein: r.base.protein * factor,
          carbs: r.base.carbs * factor,
          fat: r.base.fat * factor,
          // o intervalo do buffet acompanha a quantidade, senão passava a mentir
          kcalMin: r.base.kcalMin != null ? r.base.kcalMin * factor : r.base.kcalMin,
          kcalMax: r.base.kcalMax != null ? r.base.kcalMax * factor : r.base.kcalMax,
        }
      }),
    )
  }

  const selected = rows.filter((r) => r.checked && r.grams > 0)

  const addAll = () => {
    for (const r of selected) {
      onAdd({
        id: uid(),
        meal,
        foodName: r.name,
        emoji: r.emoji,
        grams: r.grams,
        unit: r.unit,
        kcal: r.kcal,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
      })
    }
    onDone()
  }

  const canAnalyze = hasKey && (description.trim().length > 0 || imageBase64 !== null)

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-5 pt-4">
      <button onClick={onCancel} className="self-start text-sm font-medium text-accent">
        ‹ Voltar à pesquisa
      </button>
      <h3 className="mt-3 font-semibold">✨ Analisar refeição com IA</h3>

      {step === 'input' && (
        <>
          <SegmentedControl
            className="mt-3"
            options={[
              { id: 'meal' as const, label: 'Refeição' },
              { id: 'buffet' as const, label: 'Buffet' },
            ]}
            value={mode}
            onChange={setMode}
          />
          {mode === 'buffet' && (
            <p className="mt-2 text-xs text-ink-2">
              Num buffet não há embalagem nem peças para contar. Em vez de um número que só parece
              certo, damos-te um intervalo — e registamos o meio.
            </p>
          )}
        </>
      )}

      {!hasKey && (
        <p className="mt-3 rounded-xl bg-surface p-4 text-sm text-ink-2">
          Para usar a análise por IA, configura a tua chave Anthropic no separador <strong>Perfil</strong>. A
          chave fica só neste dispositivo.
        </p>
      )}

      {step === 'input' && (
        <>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />
          {imageBase64 ? (
            <div className="relative mt-4">
              <img
                src={`data:image/jpeg;base64,${imageBase64}`}
                alt="Foto da refeição"
                className="max-h-52 w-full rounded-xl object-cover"
              />
              <button
                onClick={() => setImageBase64(null)}
                className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-sm text-white"
                aria-label="Remover foto"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => cameraRef.current?.click()}
                disabled={!hasKey}
                className="rounded-xl border border-dashed border-line px-4 py-6 text-sm font-medium text-accent transition active:scale-[0.98] disabled:opacity-40"
              >
                📷 Câmara
              </button>
              <button
                onClick={() => galleryRef.current?.click()}
                disabled={!hasKey}
                className="rounded-xl border border-dashed border-line px-4 py-6 text-sm font-medium text-accent transition active:scale-[0.98] disabled:opacity-40"
              >
                🖼️ Galeria
              </button>
            </div>
          )}

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!hasKey}
            placeholder={
              mode === 'buffet'
                ? 'Ou descreve o prato… (ex.: prato de buffet chinês: arroz chau chau, frango agridoce e rolinhos)'
                : 'Ou descreve a refeição… (ex.: 18 peças de sushi variado e 2 imperiais)'
            }
            rows={3}
            className="mt-3 w-full rounded-xl bg-surface px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-40"
          />

          {error && <p role="alert" className="mt-2 text-sm font-medium text-critical">{error}</p>}

          <button
            onClick={analyze}
            disabled={!canAnalyze}
            className="mt-auto mb-6 rounded-full bg-accent px-6 py-3.5 font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
          >
            Analisar refeição
          </button>
        </>
      )}

      {step === 'loading' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="animate-pulse text-4xl" aria-hidden>✨</span>
          <p className="text-sm text-muted">A analisar a refeição… pode demorar até 15 s.</p>
        </div>
      )}

      {step === 'results' && (
        <>
          <ul className="mt-4 space-y-2">
            {rows.map((r, i) => (
              <li key={i} className={`rounded-xl bg-surface p-3 ${r.checked ? '' : 'opacity-50'}`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={r.checked}
                    onChange={() => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))}
                    className="h-5 w-5 accent-[var(--accent)]"
                    aria-label={`Incluir ${r.name}`}
                  />
                  <span className="text-xl" aria-hidden>{r.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.name}</div>
                    <div className="text-xs text-muted">
                      {r.kcalMin != null && r.kcalMax != null
                        ? `${Math.round(r.kcalMin)}–${Math.round(r.kcalMax)} kcal`
                        : `${Math.round(r.kcal)} kcal`}
                      {' · '}H {Math.round(r.carbs)} · P {Math.round(r.protein)} · G {Math.round(r.fat)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={Math.round(r.grams)}
                      onChange={(e) => setGrams(i, Number(e.target.value))}
                      className="w-16 rounded-lg bg-bg px-2 py-1.5 text-right text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                      aria-label={`Quantidade de ${r.name}`}
                    />
                    <span className="text-xs text-muted">{r.unit}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {selected.some((r) => r.kcalMin != null && r.kcalMax != null) && (
            <div className="mt-3 rounded-xl bg-surface p-3.5 text-sm">
              <div className="font-semibold tabular-nums">
                {Math.round(selected.reduce((s, r) => s + (r.kcalMin ?? r.kcal), 0))}–
                {Math.round(selected.reduce((s, r) => s + (r.kcalMax ?? r.kcal), 0))} kcal no prato
              </div>
              <p className="mt-0.5 text-xs text-ink-2">
                Regista {Math.round(selected.reduce((s, r) => s + r.kcal, 0))} kcal, o meio do intervalo.
                Ajusta as gramas se souberes que comeste mais ou menos.
              </p>
            </div>
          )}

          {notes && <p className="mt-3 text-xs text-muted">💡 {notes}</p>}

          <button
            onClick={() => setStep('input')}
            className="mt-3 self-start text-sm font-medium text-accent"
          >
            ‹ Analisar outra vez
          </button>

          <button
            onClick={addAll}
            disabled={selected.length === 0}
            className="mt-auto mb-6 rounded-full bg-accent px-6 py-3.5 font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
          >
            Adicionar {selected.length} alimento{selected.length === 1 ? '' : 's'}
          </button>
        </>
      )}
    </div>
  )
}
