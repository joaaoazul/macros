/** Foto do frigorífico/despensa → itens para pôr em stock.
 *
 * A IA identifica o que vê e sugere quantos dias dura cada coisa; a validade
 * final é sempre uma data editável. Nada entra sem passares os olhos: cada
 * linha vem marcada mas é destacável, e as quantidades são corrigíveis. */

import { useRef, useState } from 'react'
import type { PantryItem } from '../types'
import { ApiError } from '../lib/api'
import { analyzePantry, downscaleImage, getAnthropicKey, type PantryCandidate } from '../lib/ai'
import { defaultExpiryFor, todayISODate } from '../lib/pantry'
import { haptic, uid } from '../lib/store'
import { Button, Card, Z } from './ui'

interface Props {
  onAdd: (items: PantryItem[]) => void
  onClose: () => void
}

interface Row extends PantryCandidate {
  checked: boolean
  expiresOn: string
}

/** Data ISO daqui a N dias (setDate: imune à mudança de hora). */
function isoInDays(days: number): string {
  const d = new Date(`${todayISODate()}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function PantryPhotoSheet({ onAdd, onClose }: Props) {
  const [step, setStep] = useState<'input' | 'loading' | 'results'>('input')
  const [rows, setRows] = useState<Row[]>([])
  const [notes, setNotes] = useState<string | null>(null)
  const [error, setError] = useState('')
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const hasKey = getAnthropicKey() !== null

  const analyze = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setStep('loading')
    try {
      const imageBase64 = await downscaleImage(file)
      const res = await analyzePantry(imageBase64)
      if (res.items.length === 0) {
        setError('Não reconheci alimentos nessa foto. Tenta com mais luz ou mais perto.')
        setStep('input')
        return
      }
      setRows(
        res.items.map((it) => ({
          ...it,
          checked: true,
          // o palpite da IA manda; sem ele, a tabela local de prazos do app
          expiresOn: it.shelfLifeDays != null ? isoInDays(it.shelfLifeDays) : defaultExpiryFor(it.name),
        })),
      )
      setNotes(res.notes ?? null)
      setStep('results')
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'A análise falhou.')
      setStep('input')
    }
  }

  const selected = rows.filter((r) => r.checked)

  const addAll = () => {
    haptic(20)
    onAdd(
      selected.map((r) => ({
        id: uid(),
        kind: 'stock' as const,
        name: r.name,
        emoji: r.emoji || '🧺',
        qty: r.qty > 0 ? r.qty : 1,
        expiresOn: r.expiresOn,
      })),
    )
  }

  return (
    <div className={`fixed inset-0 ${Z.modal} flex items-end justify-center bg-black/40 sheet-backdrop`} onClick={onClose}>
      <div
        className="sheet-panel flex h-[85dvh] w-full max-w-md flex-col rounded-t-[1.75rem] bg-bg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Encher a despensa com uma foto"
      >
        <header className="flex items-center justify-between px-5 pb-1 pt-4">
          <h2 className="text-lg font-bold">📸 Foto da despensa</h2>
          <button onClick={onClose} className="rounded-full px-2 py-1 text-muted" aria-label="Fechar">
            ✕
          </button>
        </header>

        <div className="scroll-contain flex flex-1 flex-col overflow-y-auto px-5 pb-6">
          {!hasKey && (
            <p className="mt-3 rounded-xl bg-surface p-4 text-sm text-ink-2">
              Para usar a foto da despensa, configura a tua chave Anthropic no separador{' '}
              <strong>Perfil</strong>. A chave fica só neste dispositivo.
            </p>
          )}

          {step === 'input' && (
            <>
              <p className="mt-2 text-sm text-ink-2">
                Abre o frigorífico e tira uma foto. Identificamos o que lá está e sugerimos uma
                validade para cada coisa — confirmas antes de entrar.
              </p>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => void analyze(e.target.files?.[0])}
              />
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void analyze(e.target.files?.[0])}
              />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => cameraRef.current?.click()}
                  disabled={!hasKey}
                  className="press rounded-xl border border-dashed border-line px-4 py-6 text-sm font-medium text-accent disabled:opacity-40"
                >
                  📷 Câmara
                </button>
                <button
                  onClick={() => galleryRef.current?.click()}
                  disabled={!hasKey}
                  className="press rounded-xl border border-dashed border-line px-4 py-6 text-sm font-medium text-accent disabled:opacity-40"
                >
                  🖼️ Galeria
                </button>
              </div>
              {error && <p role="alert" className="mt-3 text-sm font-medium text-critical">{error}</p>}
            </>
          )}

          {step === 'loading' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <span className="animate-pulse text-4xl" aria-hidden>🧺</span>
              <p className="text-sm text-muted">A ver o que lá está… pode demorar até 15 s.</p>
            </div>
          )}

          {step === 'results' && (
            <>
              <p className="mt-2 text-xs text-muted">
                Toca na data para corrigir. As validades são estimativas — a embalagem manda.
              </p>
              <Card className="mt-3 divide-y divide-line overflow-hidden">
                {rows.map((r, i) => (
                  <div key={i} className={`flex items-center gap-2.5 p-3 ${r.checked ? '' : 'opacity-45'}`}>
                    <input
                      type="checkbox"
                      checked={r.checked}
                      onChange={() =>
                        setRows((rs) => rs.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))
                      }
                      className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                      aria-label={`Incluir ${r.name}`}
                    />
                    <span aria-hidden>{r.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{r.name}</div>
                      <input
                        type="date"
                        value={r.expiresOn}
                        onChange={(e) =>
                          setRows((rs) => rs.map((x, j) => (j === i ? { ...x, expiresOn: e.target.value } : x)))
                        }
                        aria-label={`Validade de ${r.name}`}
                        className="mt-0.5 w-full min-w-0 rounded-lg bg-bg px-2 py-1 text-[11px] tabular-nums text-ink-2 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() =>
                          setRows((rs) => rs.map((x, j) => (j === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))
                        }
                        className="press flex h-6 w-6 items-center justify-center rounded-full bg-surface text-sm"
                        aria-label={`Menos um ${r.name}`}
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-xs font-semibold tabular-nums">{r.qty}</span>
                      <button
                        onClick={() => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, qty: x.qty + 1 } : x)))}
                        className="press flex h-6 w-6 items-center justify-center rounded-full bg-surface text-sm"
                        aria-label={`Mais um ${r.name}`}
                      >
                        ＋
                      </button>
                    </div>
                  </div>
                ))}
              </Card>

              {notes && <p className="mt-3 text-xs text-muted">💡 {notes}</p>}

              <button onClick={() => setStep('input')} className="mt-3 self-start text-sm font-medium text-accent">
                ‹ Tirar outra foto
              </button>

              <Button full size="lg" onClick={addAll} disabled={selected.length === 0} className="mt-auto">
                Pôr {selected.length} {selected.length === 1 ? 'item' : 'itens'} na despensa
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
