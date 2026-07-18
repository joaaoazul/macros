/** Toasts: confirmação curta no topo do ecrã.
 *
 * A classe `.animate-toast` já existia no index.css desde a ronda 6 mas nunca
 * teve quem a usasse — várias acções (guardar uma partilha, importar um link,
 * registar do planeador) aconteciam sem qualquer confirmação visível.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type ToastKind = 'ok' | 'error'
interface Toast {
  id: number
  kind: ToastKind
  text: string
}

const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {})

/** `const toast = useToast(); toast('Guardado')` — ou `toast('Falhou', 'error')`. */
export function useToast() {
  return useContext(ToastCtx)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((text: string, kind: ToastKind = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }, [])

  const value = useMemo(() => show, [show])

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div
          className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[80] flex flex-col items-center gap-2 px-4"
          role="status"
          aria-live="polite"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`animate-toast max-w-md rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg ${
                t.kind === 'error' ? 'bg-critical text-white' : 'bg-ink text-bg'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}
    </ToastCtx.Provider>
  )
}
