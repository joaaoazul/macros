import { useEffect, useRef, useState } from 'react'

interface Props {
  onDetect: (code: string) => void
  onClose: () => void
}

/**
 * Leitor de códigos de barras com a câmara (ZXing, carregado sob demanda).
 * Requer HTTPS e permissão de câmara; em caso de falha mostra o erro
 * e o utilizador pode sempre escrever o código à mão na pesquisa.
 */
export default function BarcodeScanner({ onDetect, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stopped = false
    let controls: { stop: () => void } | undefined

    ;(async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (result && !stopped) {
            stopped = true
            controls?.stop()
            onDetect(result.getText())
          }
        })
        if (stopped) controls.stop()
      } catch {
        setError('Não foi possível aceder à câmara. Confirma a permissão (e que estás em HTTPS), ou escreve o código à mão na pesquisa.')
      }
    })()

    return () => {
      stopped = true
      controls?.stop()
    }
  }, [onDetect])

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Ler código de barras">
      <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <h2 className="text-lg font-extrabold text-white">Aponta ao código de barras</h2>
        <button onClick={onClose} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold text-white" aria-label="Fechar leitor">
          Fechar ✕
        </button>
      </div>

      <div className="relative mt-4 flex-1">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        {/* moldura de mira */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <div className="h-40 w-72 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {error && (
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-2xl bg-black/85 p-5 text-center text-sm text-white">
            {error}
          </div>
        )}
      </div>

      <p className="px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-[13px] text-white/70">
        O produto é procurado no Open Food Facts assim que o código for lido.
      </p>
    </div>
  )
}
