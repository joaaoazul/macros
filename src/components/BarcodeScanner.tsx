import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { Z } from './ui'

interface Props {
  onDetected: (code: string) => void
  onClose: () => void
}

type CamError = 'denied' | 'unavailable' | null

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<CamError>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const trackRef = useRef<MediaStreamTrack | null>(null)

  useEffect(() => {
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
    ])
    const reader = new BrowserMultiFormatReader(hints)
    let stopped = false
    let controls: { stop: () => void } | null = null

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current!,
        (result) => {
          if (result && !stopped) {
            stopped = true
            navigator.vibrate?.(50)
            controls?.stop()
            onDetected(result.getText())
          }
        },
      )
      .then((c) => {
        controls = c
        if (stopped) {
          c.stop()
          return
        }
        const stream = videoRef.current?.srcObject as MediaStream | null
        const track = stream?.getVideoTracks()[0] ?? null
        trackRef.current = track
        const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined
        if (caps?.torch) setTorchSupported(true)
      })
      .catch((err: DOMException) => {
        if (stopped) return
        setError(err?.name === 'NotAllowedError' ? 'denied' : 'unavailable')
      })

    return () => {
      stopped = true
      controls?.stop()
      const stream = videoRef.current?.srcObject as MediaStream | null
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onDetected])

  const toggleTorch = async () => {
    const track = trackRef.current
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] })
      setTorchOn((t) => !t)
    } catch {
      setTorchSupported(false)
    }
  }

  return (
    <div className={`fixed inset-0 ${Z.modal} flex flex-col bg-black`} role="dialog" aria-modal="true" aria-label="Ler código de barras">
      <header className="flex items-center justify-between px-5 pt-4 text-white">
        <h2 className="text-base font-semibold">Ler código de barras</h2>
        <button onClick={onClose} className="rounded-full px-3 py-1.5 text-white/80" aria-label="Fechar">
          ✕
        </button>
      </header>

      {error === null && (
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none relative z-10 h-32 w-64 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" aria-hidden />
          <p className="absolute bottom-24 z-10 px-6 text-center text-sm text-white/80">
            Aponta a câmara ao código de barras do produto
          </p>
          {torchSupported && (
            <button
              onClick={toggleTorch}
              className={`absolute bottom-8 z-10 rounded-full px-5 py-2.5 text-sm font-medium ${torchOn ? 'bg-white text-black' : 'bg-white/20 text-white'}`}
            >
              {torchOn ? '🔦 Desligar luz' : '🔦 Ligar luz'}
            </button>
          )}
        </div>
      )}

      {error !== null && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center text-white">
          <span className="text-3xl" aria-hidden>📷</span>
          <p className="text-sm text-white/90">
            {error === 'denied'
              ? 'Sem permissão para usar a câmara. Autoriza o acesso nas definições do navegador ou digita o código.'
              : 'Não foi possível aceder à câmara neste dispositivo. Digita o código de barras na pesquisa.'}
          </p>
          <button onClick={onClose} className="mt-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black">
            Digitar o código
          </button>
        </div>
      )}
    </div>
  )
}
