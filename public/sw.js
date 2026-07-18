/* Service worker do Macros: shell offline + Web Push.
 *
 * A camada de dados já funcionava offline (cache em localStorage + fila de
 * escritas que faz retry no evento 'online', ver src/lib/sync.ts), mas sem
 * cache do shell a app nem sequer abria sem rede. Agora abre.
 *
 * Estratégia:
 *  - navegação: network-first com fallback ao index.html em cache (offline
 *    funciona; online recebe sempre a versão nova depois de um deploy)
 *  - /assets/*: cache-first — o Vite dá nomes com hash, portanto são imutáveis
 *  - /api/*: NUNCA em cache (os dados vêm do localStorage; respostas em cache
 *    seriam dados desactualizados ou de outra sessão)
 */

const VERSION = 'macros-v1'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {}) // um 404 num ícone não pode impedir a instalação
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

const SHARE = `${VERSION}-share`
const SHARE_KEY = '/__shared-photo'

/* O browser faz POST do conteúdo partilhado para /share-target. Uma SPA estática
 * não sabe responder a POST, por isso o service worker guarda o que veio e
 * redirecciona para a app com uma pista no URL. */
async function handleShare(request) {
  try {
    const form = await request.formData()
    const photo = form.get('photo')
    const text = (form.get('text') || '').toString()
    const shared = (form.get('url') || '').toString()

    if (photo && photo.size) {
      const cache = await caches.open(SHARE)
      await cache.put(
        SHARE_KEY,
        new Response(photo, { headers: { 'content-type': photo.type || 'image/jpeg' } }),
      )
      return Response.redirect('/app?shared=photo', 303)
    }
    // muitas apps mandam o link dentro do texto
    const link = shared || text
    if (link) return Response.redirect(`/app?shared=link&v=${encodeURIComponent(link)}`, 303)
    return Response.redirect('/app', 303)
  } catch {
    return Response.redirect('/app', 303)
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const shareUrl = new URL(request.url)
  if (request.method === 'POST' && shareUrl.pathname === '/share-target') {
    event.respondWith(handleShare(request))
    return
  }
  if (request.method !== 'GET') return

  const url = shareUrl
  if (url.origin !== self.location.origin) return // OFF e afins: passa directo
  if (url.pathname.startsWith('/api/')) return // dados nunca em cache

  // Navegação: rede primeiro, cache como rede de segurança
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone()
          caches.open(SHELL).then((c) => c.put('/index.html', copy)).catch(() => {})
          return resp
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || caches.match('/'))),
    )
    return
  }

  // Estáticos com hash: cache primeiro
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((resp) => {
        if (resp.ok && (resp.type === 'basic' || resp.type === 'default')) {
          const copy = resp.clone()
          caches.open(ASSETS).then((c) => c.put(request, copy)).catch(() => {})
        }
        return resp
      })
    }),
  )
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Macros', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Macros'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/app' },
    tag: data.tag,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/app'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
