/** Cliente da API: fetch same-origin com cookies httpOnly, CSRF header e refresh automático. */

export class ApiError extends Error {
  status: number
  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
  }
}

/** Chamado quando a sessão expira de vez (refresh falhou) — definido pelo AuthProvider. */
export let onSessionExpired: () => void = () => {}
export function setOnSessionExpired(fn: () => void) {
  onSessionExpired = fn
}

const BASE = '/api/v1'

async function rawRequest(path: string, method: string, body?: unknown): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'fetch',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

let refreshing: Promise<boolean> | null = null

/** Renova a sessão explicitamente (ex.: reconexão do WebSocket após 4401). */
export async function refreshSession(): Promise<boolean> {
  return tryRefresh()
}

/** Tenta renovar a sessão (deduplicado entre chamadas concorrentes). */
async function tryRefresh(): Promise<boolean> {
  refreshing ??= rawRequest('/auth/refresh', 'POST')
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0)
    })
  return refreshing
}

interface Options {
  method?: string
  body?: unknown
  /** true para endpoints de auth onde um 401 é resposta esperada (login errado, etc.) */
  skipRefresh?: boolean
}

export async function api<T>(path: string, { method = 'GET', body, skipRefresh }: Options = {}): Promise<T> {
  let resp = await rawRequest(path, method, body)

  if (resp.status === 401 && !skipRefresh) {
    if (await tryRefresh()) {
      resp = await rawRequest(path, method, body)
    }
    if (resp.status === 401) {
      onSessionExpired()
    }
  }

  if (!resp.ok) {
    let detail = `Erro ${resp.status}`
    try {
      const data = await resp.json()
      if (typeof data.detail === 'string') detail = data.detail
    } catch {
      // resposta sem JSON
    }
    throw new ApiError(resp.status, detail)
  }

  return (await resp.json()) as T
}
