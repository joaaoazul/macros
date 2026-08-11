/** Integração com o shell nativo (Android): botão voltar, status bar, splash,
 *  haptics e links externos. Tudo aqui é no-op na web. */

import { setHapticImpl } from './store'
import { isNative } from './native'

/** Devolve true se tratou do voltar (ex.: fechou uma folha). */
export type BackHandler = () => boolean

const backHandlers: BackHandler[] = []

/**
 * Regista um tratador para o botão voltar do Android. Os tratadores são
 * chamados do mais recente para o mais antigo — o primeiro que devolver true
 * consome o evento, o que dá a ordem certa quando há folhas sobrepostas.
 * Devolve a função para desregistar (usar no cleanup do efeito).
 */
export function registerBackHandler(fn: BackHandler): () => void {
  backHandlers.push(fn)
  return () => {
    const i = backHandlers.lastIndexOf(fn)
    if (i >= 0) backHandlers.splice(i, 1)
  }
}

function runBackHandlers(): boolean {
  for (let i = backHandlers.length - 1; i >= 0; i--) {
    if (backHandlers[i]()) return true
  }
  return false
}

/** Abre um URL externo fora do WebView (browser do sistema). */
export async function openExternal(url: string): Promise<void> {
  if (!isNative) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url })
}

/** Links para outra origem abrem no browser do sistema, não dentro da app. */
function interceptExternalLinks() {
  document.addEventListener('click', (ev) => {
    if (ev.defaultPrevented || ev.button !== 0) return
    const anchor = (ev.target as Element | null)?.closest?.('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (!href) return

    let url: URL
    try {
      url = new URL(href, location.href)
    } catch {
      return
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return
    // links internos ficam com o router
    if (url.origin === location.origin) return

    ev.preventDefault()
    void openExternal(url.href)
  })
}

/** Segue o tema do sistema para os ícones da status bar. */
async function followSystemTheme() {
  const { StatusBar, Style } = await import('@capacitor/status-bar')
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = (dark: boolean) => {
    // Style.Dark = conteúdo claro sobre fundo escuro
    void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {})
  }
  apply(query.matches)
  query.addEventListener('change', (e) => apply(e.matches))
}

let started = false

/** Arranca a integração nativa. Idempotente; no-op fora do APK. */
export async function initNativeShell(): Promise<void> {
  if (!isNative || started) return
  started = true

  const [{ App }, { SplashScreen }, { Haptics, ImpactStyle }, { Keyboard, KeyboardResize }] =
    await Promise.all([
      import('@capacitor/app'),
      import('@capacitor/splash-screen'),
      import('@capacitor/haptics'),
      import('@capacitor/keyboard'),
    ])

  setHapticImpl((ms) => {
    const style = ms >= 30 ? ImpactStyle.Heavy : ms >= 20 ? ImpactStyle.Medium : ImpactStyle.Light
    void Haptics.impact({ style }).catch(() => {})
  })

  // o layout usa dvh; deixar o WebView encolher com o teclado mantém isso certo
  void Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {})

  void followSystemTheme()
  interceptExternalLinks()

  await App.addListener('backButton', ({ canGoBack }) => {
    if (runBackHandlers()) return
    if (canGoBack) {
      window.history.back()
      return
    }
    // na raiz não fechamos a app — mandamos para segundo plano, como é hábito
    void App.minimizeApp().catch(() => {})
  })

  // `launchAutoHide` está desligado: a splash só sai depois do primeiro
  // desenho do React, senão via-se um flash branco entre as duas.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
  void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {})
}
