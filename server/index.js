/**
 * API de contas + sincronização da app Macros.
 * Node 22+ (usa o SQLite embutido do Node — sem dependências nativas).
 *
 *   cd server && npm ci && npm start          # escuta em 127.0.0.1:8787
 *
 * Variáveis de ambiente:
 *   PORT        — porta (por omissão 8787)
 *   DB_PATH     — ficheiro SQLite (por omissão ./data.db)
 *   JWT_SECRET  — segredo dos tokens; se faltar é gerado e guardado em ./jwt-secret
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'
import { serve } from '@hono/node-server'
import bcrypt from 'bcryptjs'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.PORT ?? 8787)
const DB_PATH = process.env.DB_PATH ?? new URL('./data.db', import.meta.url).pathname

const secretFile = new URL('./jwt-secret', import.meta.url).pathname
const JWT_SECRET =
  process.env.JWT_SECRET ??
  (existsSync(secretFile)
    ? readFileSync(secretFile, 'utf8').trim()
    : (() => {
        const s = randomBytes(32).toString('hex')
        writeFileSync(secretFile, s, { mode: 0o600 })
        return s
      })())

const db = new DatabaseSync(DB_PATH)
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kv (
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    server_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
  );
  CREATE INDEX IF NOT EXISTS kv_user_server ON kv (user_id, server_at);
`)

const app = new Hono()
app.use('*', cors({ origin: (o) => o, allowHeaders: ['Content-Type', 'Authorization'], allowMethods: ['GET', 'POST', 'OPTIONS'] }))

// trava simples de força-bruta no login: 10 tentativas / 15 min por email
const attempts = new Map()
function tooManyAttempts(email) {
  const now = Date.now()
  const list = (attempts.get(email) ?? []).filter((t) => now - t < 15 * 60 * 1000)
  attempts.set(email, list)
  return list.length >= 10
}

const makeToken = (userId, email) => sign({ sub: userId, email, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET)

const validEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254

app.post('/api/auth/register', async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}))
  if (!validEmail(email)) return c.json({ error: 'Email inválido.' }, 400)
  if (typeof password !== 'string' || password.length < 8) return c.json({ error: 'A password precisa de pelo menos 8 caracteres.' }, 400)
  const normalized = email.trim().toLowerCase()
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(normalized)
  if (exists) return c.json({ error: 'Já existe uma conta com este email.' }, 409)
  const hash = bcrypt.hashSync(password, 10)
  const info = db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)').run(normalized, hash, Date.now())
  const token = await makeToken(Number(info.lastInsertRowid), normalized)
  return c.json({ token, email: normalized })
})

app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}))
  const normalized = String(email ?? '').trim().toLowerCase()
  if (tooManyAttempts(normalized)) return c.json({ error: 'Demasiadas tentativas — espera 15 minutos.' }, 429)
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalized)
  if (!user || !bcrypt.compareSync(String(password ?? ''), user.password_hash)) {
    attempts.get(normalized)?.push(Date.now()) ?? attempts.set(normalized, [Date.now()])
    return c.json({ error: 'Email ou password incorretos.' }, 401)
  }
  const token = await makeToken(user.id, user.email)
  return c.json({ token, email: user.email })
})

// autenticação para tudo o resto
app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith('/api/auth/') || c.req.path === '/api/health') return next()
  const auth = c.req.header('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  try {
    const payload = await verify(token, JWT_SECRET, 'HS256')
    c.set('userId', Number(payload.sub))
    return next()
  } catch {
    return c.json({ error: 'Sessão inválida — volta a entrar.' }, 401)
  }
})

app.get('/api/me', (c) => {
  const user = db.prepare('SELECT email, created_at FROM users WHERE id = ?').get(c.get('userId'))
  return c.json(user ?? {})
})

/**
 * Sincronização: o cliente envia as chaves alteradas e o cursor da última
 * sincronização; o servidor aplica last-write-wins por chave (updated_at do
 * cliente) e devolve tudo o que mudou no servidor desde o cursor.
 */
app.post('/api/sync', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))
  const since = Number(body.since ?? 0)
  const changes = Array.isArray(body.changes) ? body.changes : []
  const now = Date.now()

  const get = db.prepare('SELECT updated_at FROM kv WHERE user_id = ? AND key = ?')
  const put = db.prepare(
    `INSERT INTO kv (user_id, key, value, updated_at, server_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, server_at = excluded.server_at`,
  )
  for (const ch of changes.slice(0, 2000)) {
    if (typeof ch?.key !== 'string' || ch.key.length > 128) continue
    const value = JSON.stringify(ch.value ?? null)
    if (value.length > 512 * 1024) continue
    const updatedAt = Number(ch.updatedAt ?? now)
    const existing = get.get(userId, ch.key)
    if (existing && existing.updated_at >= updatedAt) continue // o servidor tem mais recente
    put.run(userId, ch.key, value, updatedAt, now)
  }

  const rows = db.prepare('SELECT key, value, updated_at FROM kv WHERE user_id = ? AND server_at > ?').all(userId, since)
  return c.json({
    now,
    changes: rows.map((r) => ({ key: r.key, value: JSON.parse(r.value), updatedAt: r.updated_at })),
  })
})

app.get('/api/health', (c) => c.json({ ok: true }))

serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' }, () => {
  console.log(`macros-server a escutar em http://127.0.0.1:${PORT} (db: ${DB_PATH})`)
})
