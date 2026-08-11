/** Ambiente nativo (Capacitor): detecção de plataforma e origem da API.
 *
 *  Na web a app e a API partilham origem (o nginx faz proxy de `/api`), por
 *  isso os pedidos são relativos e os cookies viajam como same-origin.
 *  No APK os assets são servidos pelo WebView em `https://localhost`, logo a
 *  API está noutra origem: os URLs passam a absolutos e os cookies a
 *  cross-site (`credentials: 'include'` + `SameSite=None` do lado do servidor).
 */

import { Capacitor } from '@capacitor/core'

export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform()

/** Origem por omissão da build nativa, se `VITE_API_ORIGIN` não for definida. */
const DEFAULT_NATIVE_ORIGIN = 'https://macros.joaoazul.dev'

const configured = (import.meta.env.VITE_API_ORIGIN ?? '').trim().replace(/\/+$/, '')

/** Vazio = same-origin (web). Preenchido = API noutra origem (nativo). */
export const apiOrigin = configured || (isNative ? DEFAULT_NATIVE_ORIGIN : '')

/** Cross-origin obriga a `include` para os cookies httpOnly seguirem. */
export const apiCredentials: RequestCredentials = apiOrigin ? 'include' : 'same-origin'

/** URL absoluto (nativo) ou relativo (web) para um caminho da API. */
export function apiUrl(path: string): string {
  return `${apiOrigin}${path}`
}

/** URL do WebSocket para um caminho da API. */
export function wsUrl(path: string): string {
  if (apiOrigin) return `${apiOrigin.replace(/^http/, 'ws')}${path}`
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}${path}`
}
