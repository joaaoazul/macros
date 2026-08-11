/** Notificações no cliente.
 *
 *  Web: Web Push — service worker, subscrição e cancelamento.
 *  APK Android: o WebView não tem service worker, por isso os mesmos lembretes
 *  são agendados como notificações locais (ver `nativeNotifications.ts`). A
 *  interface do Perfil usa estas funções sem saber em qual dos dois está.
 */

import { api, ApiError } from './api'
import { isNative } from './native'

export type PushState = 'unsupported' | 'ios-needs-install' | 'denied' | 'off' | 'on'

/** iOS só permite Web Push com a PWA instalada no ecrã inicial (standalone). */
function isIosSafari(): boolean {
  const ua = navigator.userAgent
  return /iP(hone|ad|od)/.test(ua)
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // Safari iOS expõe navigator.standalone
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function pushSupported(): boolean {
  if (isNative) return true
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getPushState(): Promise<PushState> {
  if (isNative) {
    const { checkNativePermission } = await import('./nativeNotifications')
    const perm = await checkNativePermission()
    return perm === 'granted' ? 'on' : perm === 'denied' ? 'denied' : 'off'
  }
  if (!pushSupported()) {
    return isIosSafari() && !isStandalone() ? 'ios-needs-install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return sub ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

/** Regista o service worker (idempotente). Chamado no arranque. */
export async function registerServiceWorker(): Promise<void> {
  // no APK os assets já são locais e não há Push API — o SW não serve de nada
  if (isNative || !('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/sw.js')
  } catch {
    // sem SW não há push, mas a app funciona na mesma
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** Pede permissão, subscreve no browser e regista a subscrição no servidor. */
export async function subscribeToPush(): Promise<PushState> {
  if (isNative) {
    const { requestNativePermission } = await import('./nativeNotifications')
    const perm = await requestNativePermission()
    if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off'
    // com permissão dada, agenda já os lembretes guardados no servidor
    const { listReminders } = await import('./reminders')
    await listReminders().catch(() => {})
    return 'on'
  }

  if (!pushSupported()) throw new Error('unsupported')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  const { key } = await api<{ key: string }>('/push/vapid-public-key')
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  })

  const json = sub.toJSON()
  await api<void>('/push/subscribe', {
    method: 'POST',
    body: { endpoint: json.endpoint, keys: json.keys },
  })
  return 'on'
}

export async function unsubscribeFromPush(): Promise<PushState> {
  if (isNative) {
    const { cancelNativeReminders } = await import('./nativeNotifications')
    await cancelNativeReminders().catch(() => {})
    return 'off'
  }

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await api<void>('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(
        (e) => {
          if (!(e instanceof ApiError)) throw e
        },
      )
      await sub.unsubscribe()
    }
  } catch {
    // ignora — o estado será re-lido a seguir
  }
  return 'off'
}
