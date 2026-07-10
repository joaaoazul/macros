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
import { secureHeaders } from 'hono/secure-headers'
import { sign, verify } from 'hono/jwt'
import { serve } from '@hono/node-server'
import bcrypt from 'bcryptjs'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.PORT ?? 8787)
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const RESEND_FROM = process.env.RESEND_FROM ?? 'Macros <onboarding@resend.dev>'
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
  CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER NOT NULL,
    followee_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (follower_id, followee_id)
  );
  CREATE TABLE IF NOT EXISTS friend_requests (
    from_id INTEGER NOT NULL,
    to_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    PRIMARY KEY (from_id, to_id)
  );
  CREATE TABLE IF NOT EXISTS reset_codes (
    user_id INTEGER PRIMARY KEY,
    code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
`)
// migração: follows antigos passam a amizades aceites
try {
  db.exec(`INSERT OR IGNORE INTO friend_requests (from_id, to_id, status, created_at)
           SELECT follower_id, followee_id, 'accepted', created_at FROM follows`)
} catch {}
// migração leve: colunas sociais em bases já existentes
for (const col of ['username TEXT', 'share_stats INTEGER DEFAULT 0']) {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN ${col}`)
  } catch {
    /* já existe */
  }
}
try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_username ON users (username)')
} catch {}

const app = new Hono()
app.use('*', secureHeaders())
// CORS: por omissão qualquer origem (a API não usa cookies — auth por header);
// define ALLOWED_ORIGINS="https://macros.dominio.pt" para restringir.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)
app.use(
  '*',
  cors({
    origin: (o) => (allowedOrigins.length === 0 || allowedOrigins.includes(o) ? o : null),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  }),
)

// rate-limit por IP nos endpoints de autenticação: 30 pedidos / 15 min
const ipHits = new Map()
app.use('/api/auth/*', async (c, next) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  const now = Date.now()
  const list = (ipHits.get(ip) ?? []).filter((t) => now - t < 15 * 60 * 1000)
  if (list.length >= 30) return c.json({ error: 'Demasiados pedidos — tenta mais tarde.' }, 429)
  list.push(now)
  ipHits.set(ip, list)
  return next()
})

// trava simples de força-bruta no login: 10 tentativas / 15 min por email
const attempts = new Map()
function tooManyAttempts(email) {
  const now = Date.now()
  const list = (attempts.get(email) ?? []).filter((t) => now - t < 15 * 60 * 1000)
  attempts.set(email, list)
  return list.length >= 10
}

const makeToken = (userId, email) =>
  sign(
    { sub: userId, email, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60 },
    JWT_SECRET,
  )

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

/**
 * Recuperação de password por email (via Resend). Só funciona com
 * RESEND_API_KEY definida no ambiente; sem ela devolve 503.
 */
app.post('/api/auth/forgot', async (c) => {
  if (!RESEND_API_KEY) return c.json({ error: 'Recuperação de password não configurada neste servidor.' }, 503)
  const { email } = await c.req.json().catch(() => ({}))
  const normalized = String(email ?? '').trim().toLowerCase()
  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(normalized)
  // resposta idêntica com ou sem conta (não revelar que emails existem)
  if (user) {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    db.prepare('INSERT OR REPLACE INTO reset_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)').run(
      user.id,
      bcrypt.hashSync(code, 10),
      Date.now() + 15 * 60 * 1000,
    )
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [user.email],
        subject: 'Macros — código de recuperação',
        text: `O teu código de recuperação é: ${code}\n\nVálido durante 15 minutos. Se não pediste isto, ignora este email.`,
      }),
    }).catch((e) => console.error('resend:', e.message))
  }
  return c.json({ ok: true })
})

app.post('/api/auth/reset', async (c) => {
  const { email, code, password } = await c.req.json().catch(() => ({}))
  if (typeof password !== 'string' || password.length < 8) return c.json({ error: 'A password precisa de pelo menos 8 caracteres.' }, 400)
  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(String(email ?? '').trim().toLowerCase())
  const row = user ? db.prepare('SELECT * FROM reset_codes WHERE user_id = ?').get(user.id) : null
  if (!row || row.expires_at < Date.now() || !bcrypt.compareSync(String(code ?? ''), row.code_hash)) {
    return c.json({ error: 'Código inválido ou expirado.' }, 400)
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), user.id)
  db.prepare('DELETE FROM reset_codes WHERE user_id = ?').run(user.id)
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

/* ---------- social ---------- */

const USERNAME_RE = /^[a-z0-9_]{3,20}$/

/** Estatísticas públicas (não sensíveis) calculadas do diário: streak e adesão. */
function publicStats(userId) {
  const rows = db
    .prepare(`SELECT key, value FROM kv WHERE user_id = ? AND key LIKE 'diary:%'`)
    .all(userId)
  const logged = new Set()
  for (const r of rows) {
    try {
      const v = JSON.parse(r.value)
      if (Array.isArray(v) && v.length > 0) logged.add(r.key.slice(6))
    } catch {}
  }
  const iso = (d) => d.toISOString().slice(0, 10)
  const day = new Date()
  const today = iso(day)
  let streak = 0
  if (!logged.has(today)) day.setDate(day.getDate() - 1)
  while (logged.has(iso(day))) {
    streak++
    day.setDate(day.getDate() - 1)
  }
  let last7 = 0
  const d7 = new Date()
  for (let i = 0; i < 7; i++) {
    if (logged.has(iso(d7))) last7++
    d7.setDate(d7.getDate() - 1)
  }
  return { streak, loggedToday: logged.has(today), last7 }
}

app.get('/api/social/me', (c) => {
  const u = db.prepare('SELECT username, share_stats FROM users WHERE id = ?').get(c.get('userId'))
  const followers = db.prepare('SELECT COUNT(*) AS n FROM follows WHERE followee_id = ?').get(c.get('userId'))
  return c.json({ username: u?.username ?? null, shareStats: !!u?.share_stats, followers: followers?.n ?? 0 })
})

app.post('/api/social/username', async (c) => {
  const { username } = await c.req.json().catch(() => ({}))
  const name = String(username ?? '').trim().toLowerCase()
  if (!USERNAME_RE.test(name)) return c.json({ error: 'Username inválido: 3–20 caracteres, a–z, 0–9 e _.' }, 400)
  const taken = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(name, c.get('userId'))
  if (taken) return c.json({ error: 'Esse username já está ocupado.' }, 409)
  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(name, c.get('userId'))
  return c.json({ username: name })
})

app.post('/api/social/share', async (c) => {
  const { enabled } = await c.req.json().catch(() => ({}))
  db.prepare('UPDATE users SET share_stats = ? WHERE id = ?').run(enabled ? 1 : 0, c.get('userId'))
  return c.json({ shareStats: !!enabled })
})

app.get('/api/social/search', (c) => {
  const q = String(c.req.query('q') ?? '').trim().toLowerCase()
  if (q.length < 2) return c.json({ users: [] })
  const rows = db
    .prepare(`SELECT username FROM users WHERE username LIKE ? AND username IS NOT NULL AND id != ? LIMIT 10`)
    .all(q + '%', c.get('userId'))
  return c.json({ users: rows.map((r) => r.username) })
})

const findUser = (username) => db.prepare('SELECT id, username, share_stats FROM users WHERE username = ?').get(String(username ?? '').toLowerCase())

/** Pedir amizade; se a outra pessoa já tinha pedido, aceita logo (match). */
app.post('/api/social/request', async (c) => {
  const { username } = await c.req.json().catch(() => ({}))
  const me = c.get('userId')
  const target = findUser(username)
  if (!target) return c.json({ error: 'Utilizador não encontrado.' }, 404)
  if (target.id === me) return c.json({ error: 'Não podes pedir amizade a ti próprio 🙂' }, 400)
  const reverse = db.prepare('SELECT status FROM friend_requests WHERE from_id = ? AND to_id = ?').get(target.id, me)
  if (reverse) {
    db.prepare(`UPDATE friend_requests SET status = 'accepted' WHERE from_id = ? AND to_id = ?`).run(target.id, me)
    return c.json({ status: 'accepted' })
  }
  db.prepare(`INSERT OR IGNORE INTO friend_requests (from_id, to_id, status, created_at) VALUES (?, ?, 'pending', ?)`).run(me, target.id, Date.now())
  return c.json({ status: 'pending' })
})

app.get('/api/social/requests', (c) => {
  const rows = db
    .prepare(`SELECT u.username FROM friend_requests r JOIN users u ON u.id = r.from_id WHERE r.to_id = ? AND r.status = 'pending' ORDER BY r.created_at DESC`)
    .all(c.get('userId'))
  return c.json({ requests: rows.map((r) => r.username) })
})

app.post('/api/social/respond', async (c) => {
  const { username, accept } = await c.req.json().catch(() => ({}))
  const target = findUser(username)
  if (!target) return c.json({ error: 'Utilizador não encontrado.' }, 404)
  if (accept) db.prepare(`UPDATE friend_requests SET status = 'accepted' WHERE from_id = ? AND to_id = ? AND status = 'pending'`).run(target.id, c.get('userId'))
  else db.prepare('DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?').run(target.id, c.get('userId'))
  return c.json({ ok: true })
})

app.post('/api/social/unfriend', async (c) => {
  const { username } = await c.req.json().catch(() => ({}))
  const target = findUser(username)
  if (target) {
    db.prepare('DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)').run(
      c.get('userId'), target.id, target.id, c.get('userId'),
    )
  }
  return c.json({ ok: true })
})

const acceptedFriends = (me) =>
  db
    .prepare(
      `SELECT u.id, u.username, u.share_stats FROM friend_requests r
       JOIN users u ON u.id = CASE WHEN r.from_id = ? THEN r.to_id ELSE r.from_id END
       WHERE (r.from_id = ? OR r.to_id = ?) AND r.status = 'accepted' LIMIT 100`,
    )
    .all(me, me, me)

app.get('/api/social/friends', (c) => {
  const rows = acceptedFriends(c.get('userId'))
  return c.json({
    friends: rows.map((r) => ({
      username: r.username,
      // só partilha estatísticas quem ativou a partilha (privacy by default)
      stats: r.share_stats ? publicStats(r.id) : null,
    })),
  })
})

/**
 * Feed/ranking semanal: tu + amigos, ordenados por dias registados na semana
 * e depois por streak. Pontuação simples e transparente.
 */
app.get('/api/social/feed', (c) => {
  const me = c.get('userId')
  const meRow = db.prepare('SELECT username FROM users WHERE id = ?').get(me)
  const entries = [{ username: meRow?.username ?? 'tu', isMe: true, stats: publicStats(me) }]
  for (const f of acceptedFriends(me)) {
    entries.push({ username: f.username, isMe: false, stats: f.share_stats ? publicStats(f.id) : null })
  }
  const score = (s) => (s ? s.last7 * 10 + Math.min(s.streak, 30) : -1)
  entries.sort((a, b) => score(b.stats) - score(a.stats))
  return c.json({ feed: entries })
})

/* ---------- conta (RGPD: portabilidade e apagamento) ---------- */

app.get('/api/account/export', (c) => {
  const userId = c.get('userId')
  const user = db.prepare('SELECT email, username, created_at FROM users WHERE id = ?').get(userId)
  const rows = db.prepare('SELECT key, value, updated_at FROM kv WHERE user_id = ?').all(userId)
  const data = {}
  for (const r of rows) data[r.key] = JSON.parse(r.value)
  return c.json({ user, data, exportedAt: new Date().toISOString() })
})

app.delete('/api/account', (c) => {
  const userId = c.get('userId')
  db.prepare('DELETE FROM kv WHERE user_id = ?').run(userId)
  db.prepare('DELETE FROM follows WHERE follower_id = ? OR followee_id = ?').run(userId, userId)
  db.prepare('DELETE FROM users WHERE id = ?').run(userId)
  return c.json({ deleted: true })
})

app.get('/api/health', (c) => c.json({ ok: true }))

serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' }, () => {
  console.log(`macros-server a escutar em http://127.0.0.1:${PORT} (db: ${DB_PATH})`)
})
