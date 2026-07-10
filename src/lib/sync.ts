/**
 * Sincronização offline-first com o servidor (server/index.js).
 *
 * - Chaves simples (perfil, alimentos) sincronizam por inteiro.
 * - Chaves datadas (diário, água, exercício, peso) sincronizam dia-a-dia
 *   ("diary:2026-07-10"), para poderes usar dois dispositivos sem perder dados.
 * - Resolução de conflitos: last-write-wins por chave, com o updatedAt do cliente.
 * - A app funciona igual sem conta; com conta, empurra alterações (debounce)
 *   e puxa novidades no arranque e quando volta ao primeiro plano.
 */

const SIMPLE_KEYS = ['macros.profile', 'macros.customFoods', 'macros.favFoods', 'macros.recentFoods'] as const
const DATED_KEYS = ['macros.diary', 'macros.water', 'macros.exercise', 'macros.weightLog'] as const

interface Auth {
  token: string
  email: string
}
interface Meta {
  since: number
  dirty: Record<string, number> // chave de sync → updatedAt local
}
interface Change {
  key: string
  value: unknown
  updatedAt: number
}

const readJSON = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export const getAuth = (): Auth | null => readJSON<Auth | null>('macros.auth', null)
const setAuth = (a: Auth | null) => (a ? localStorage.setItem('macros.auth', JSON.stringify(a)) : localStorage.removeItem('macros.auth'))

const getMeta = (): Meta => readJSON<Meta>('macros.syncMeta', { since: 0, dirty: {} })
const setMeta = (m: Meta) => localStorage.setItem('macros.syncMeta', JSON.stringify(m))

/** Base da API: mesmo domínio (/api) por omissão; localStorage 'macros.apiUrl' para dev. */
const apiBase = () => (localStorage.getItem('macros.apiUrl') ?? '').replace(/\/$/, '') + '/api'

async function api(path: string, body?: unknown, token?: string): Promise<Record<string, unknown>> {
  const res = await fetch(apiBase() + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `Erro ${res.status}`)
  return data
}

// sombra das chaves datadas para saber que dias mudaram
const shadow = new Map<string, Record<string, string>>()

const snapshotDated = (storageKey: string): Record<string, string> => {
  const obj = readJSON<Record<string, unknown>>(storageKey, {})
  const out: Record<string, string> = {}
  for (const [date, v] of Object.entries(obj)) out[date] = JSON.stringify(v)
  return out
}

const initShadow = () => {
  for (const k of DATED_KEYS) shadow.set(k, snapshotDated(k))
}

const shortName = (storageKey: string) => storageKey.replace('macros.', '')

/** Marca as alterações da chave como pendentes (dirty). */
function markDirty(storageKey: string) {
  const meta = getMeta()
  const now = Date.now()
  if ((SIMPLE_KEYS as readonly string[]).includes(storageKey)) {
    meta.dirty[shortName(storageKey)] = now
  } else if ((DATED_KEYS as readonly string[]).includes(storageKey)) {
    const before = shadow.get(storageKey) ?? {}
    const after = snapshotDated(storageKey)
    for (const date of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (before[date] !== after[date]) meta.dirty[`${shortName(storageKey)}:${date}`] = now
    }
    shadow.set(storageKey, after)
  } else {
    return
  }
  setMeta(meta)
}

/** Constrói a lista de alterações pendentes a enviar. */
function collectChanges(meta: Meta): Change[] {
  const changes: Change[] = []
  for (const [key, updatedAt] of Object.entries(meta.dirty)) {
    const [name, date] = key.split(':')
    const storageKey = `macros.${name}`
    if (date) {
      const parent = readJSON<Record<string, unknown>>(storageKey, {})
      changes.push({ key, value: parent[date] ?? null, updatedAt })
    } else {
      changes.push({ key, value: readJSON<unknown>(storageKey, null), updatedAt })
    }
  }
  return changes
}

/** Aplica alterações vindas do servidor. Devolve true se algo local mudou. */
function applyRemote(changes: Change[], dirty: Record<string, number>): boolean {
  let touched = false
  for (const ch of changes) {
    // se temos uma alteração local mais recente por enviar, ela ganha
    if ((dirty[ch.key] ?? 0) >= ch.updatedAt) continue
    const [name, date] = ch.key.split(':')
    const storageKey = `macros.${name}`
    if (date) {
      if (!(DATED_KEYS as readonly string[]).includes(storageKey)) continue
      const parent = readJSON<Record<string, unknown>>(storageKey, {})
      const next = JSON.stringify(ch.value)
      if (JSON.stringify(parent[date]) === next) continue
      if (ch.value === null || ch.value === undefined) delete parent[date]
      else parent[date] = ch.value
      localStorage.setItem(storageKey, JSON.stringify(parent))
      touched = true
    } else {
      if (!(SIMPLE_KEYS as readonly string[]).includes(storageKey)) continue
      const next = JSON.stringify(ch.value)
      if (localStorage.getItem(storageKey) === next) continue
      localStorage.setItem(storageKey, next)
      touched = true
    }
  }
  if (touched) initShadow()
  return touched
}

let syncing = false

/** Um ciclo completo: envia pendentes + recebe novidades. Devolve true se dados locais mudaram. */
export async function syncNow(): Promise<boolean> {
  const auth = getAuth()
  if (!auth || syncing) return false
  syncing = true
  try {
    const meta = getMeta()
    const changes = collectChanges(meta)
    const res = (await api('/sync', { since: meta.since, changes }, auth.token)) as unknown as {
      now: number
      changes: Change[]
    }
    // enviados com sucesso — limpa o dirty do que foi enviado
    const dirty = { ...meta.dirty }
    for (const ch of changes) delete dirty[ch.key]
    const touched = applyRemote(res.changes, dirty)
    setMeta({ since: res.now, dirty })
    return touched
  } finally {
    syncing = false
  }
}

/** Entrar ou criar conta; junta os dados locais aos do servidor (o mais recente ganha). */
export async function login(email: string, password: string, register: boolean): Promise<void> {
  const data = (await api(register ? '/auth/register' : '/auth/login', { email, password })) as unknown as Auth
  setAuth({ token: data.token, email: data.email })
  // marca tudo o que existe localmente como pendente, para o merge inicial
  const meta: Meta = { since: 0, dirty: {} }
  const now = Date.now()
  for (const k of SIMPLE_KEYS) {
    if (localStorage.getItem(k) !== null) meta.dirty[shortName(k)] = now
  }
  for (const k of DATED_KEYS) {
    for (const date of Object.keys(readJSON<Record<string, unknown>>(k, {}))) {
      meta.dirty[`${shortName(k)}:${date}`] = now
    }
  }
  setMeta(meta)
  initShadow()
  await syncNow()
}

/** Sair — mantém os dados locais, só corta a ligação. */
export function logout() {
  setAuth(null)
  setMeta({ since: 0, dirty: {} })
}

/**
 * Liga o motor: ouve alterações de estado, empurra com debounce e puxa no
 * arranque/regresso ao primeiro plano. `onRemoteData` é chamado quando dados
 * do servidor alteraram o estado local (a app deve recarregar o estado).
 */
export function startSync(onRemoteData: () => void) {
  initShadow()
  let timer: ReturnType<typeof setTimeout> | undefined

  const push = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      syncNow().then((touched) => touched && onRemoteData()).catch(() => {})
    }, 1500)
  }

  const onChange = (e: Event) => {
    const key = (e as CustomEvent<string>).detail
    markDirty(key)
    if (getAuth()) push()
  }

  const pull = () => {
    syncNow().then((touched) => touched && onRemoteData()).catch(() => {})
  }

  window.addEventListener('macros-state', onChange)
  const onVisible = () => document.visibilityState === 'visible' && getAuth() && pull()
  document.addEventListener('visibilitychange', onVisible)
  if (getAuth()) pull()

  return () => {
    window.removeEventListener('macros-state', onChange)
    document.removeEventListener('visibilitychange', onVisible)
    clearTimeout(timer)
  }
}

/** Há alterações por enviar? (para mostrar estado na UI) */
export function pendingCount(): number {
  return Object.keys(getMeta().dirty).length
}

/* ---------- social e conta ---------- */

export interface FriendStats {
  streak: number
  loggedToday: boolean
  last7: number
}
export interface Friend {
  username: string
  stats: FriendStats | null
}

const authed = () => {
  const a = getAuth()
  if (!a) throw new Error('Sem sessão iniciada.')
  return a.token
}

export const socialMe = () =>
  api('/social/me', undefined, authed()) as Promise<{ username: string | null; shareStats: boolean; followers: number }>
export const setUsername = (username: string) => api('/social/username', { username }, authed())
export const setShareStats = (enabled: boolean) => api('/social/share', { enabled }, authed())
export const searchUsers = (q: string) =>
  api(`/social/search?q=${encodeURIComponent(q)}`, undefined, authed()) as Promise<{ users: string[] }>
export const followUser = (username: string) => api('/social/follow', { username }, authed())
export const unfollowUser = (username: string) => api('/social/unfollow', { username }, authed())
export const listFriends = () => api('/social/friends', undefined, authed()) as Promise<{ friends: Friend[] }>

export async function deleteAccount(): Promise<void> {
  const res = await fetch(apiBase() + '/account', { method: 'DELETE', headers: { Authorization: `Bearer ${authed()}` } })
  if (!res.ok) throw new Error('Não foi possível eliminar a conta.')
  logout()
}
