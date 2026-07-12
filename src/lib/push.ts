/** Web Push no cliente: registo do service worker, subscrição e cancelamento. */

import { api, ApiError } from './api'

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
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getPushState(): Promise<PushState> {
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
  if (!('serviceWorker' in navigator)) return
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
