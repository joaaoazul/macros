/**
 * Testes de integração da API (contas, sync, social, RGPD).
 * Requer o servidor a correr com uma base LIMPA:
 *   rm -f data.db* && node index.js &   # noutra shell
 *   node test.mjs
 */
const BASE = process.env.API_URL ?? 'http://127.0.0.1:8787'

let passed = 0
let failed = 0
const ok = (cond, name) => {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ FALHOU: ${name}`)
  }
}

const req = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(BASE + path, {
    method: body !== undefined ? (method === 'GET' ? 'POST' : method) : method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

const suffix = Date.now().toString(36)
const emailA = `a-${suffix}@test.pt`
const emailB = `b-${suffix}@test.pt`
const today = new Date().toISOString().slice(0, 10)

console.log('— autenticação —')
{
  const r = await req('/api/auth/register', { body: { email: 'inválido', password: 'password123' } })
  ok(r.status === 400, 'email inválido rejeitado')
}
{
  const r = await req('/api/auth/register', { body: { email: emailA, password: 'curta' } })
  ok(r.status === 400, 'password curta rejeitada')
}
const A = (await req('/api/auth/register', { body: { email: emailA, password: 'password123' } })).data
ok(!!A.token, 'registo devolve token')
{
  const r = await req('/api/auth/register', { body: { email: emailA, password: 'password123' } })
  ok(r.status === 409, 'email duplicado rejeitado')
}
{
  const r = await req('/api/auth/login', { body: { email: emailA, password: 'errada!!!' } })
  ok(r.status === 401, 'password errada rejeitada')
}
const B = (await req('/api/auth/register', { body: { email: emailB, password: 'password123' } })).data
{
  const r = await req('/api/sync', { body: { since: 0, changes: [] } })
  ok(r.status === 401, 'sync sem token rejeitado')
}
{
  const r = await req('/api/sync', { token: 'abc.def.ghi', body: { since: 0, changes: [] } })
  ok(r.status === 401, 'token inválido rejeitado')
}

console.log('— sincronização —')
{
  const r = await req('/api/sync', { token: A.token, body: { since: 0, changes: [{ key: `diary:${today}`, value: [{ id: 'x' }], updatedAt: 100 }] } })
  ok(r.status === 200, 'push aceite')
}
{
  // LWW: mais antigo não vence
  await req('/api/sync', { token: A.token, body: { since: 0, changes: [{ key: 'profile', value: { name: 'Novo' }, updatedAt: 200 }] } })
  await req('/api/sync', { token: A.token, body: { since: 0, changes: [{ key: 'profile', value: { name: 'Velho' }, updatedAt: 50 }] } })
  const r = await req('/api/sync', { token: A.token, body: { since: 0, changes: [] } })
  const profile = r.data.changes.find((c) => c.key === 'profile')
  ok(profile?.value?.name === 'Novo', 'LWW: escrita mais antiga não vence')
}
{
  // cursor: since alto não devolve nada
  const now = (await req('/api/sync', { token: A.token, body: { since: 0, changes: [] } })).data.now
  const r = await req('/api/sync', { token: A.token, body: { since: now, changes: [] } })
  ok(r.data.changes.length === 0, 'cursor since filtra alterações antigas')
}
{
  // isolamento entre utilizadores
  const r = await req('/api/sync', { token: B.token, body: { since: 0, changes: [] } })
  ok(r.data.changes.length === 0, 'utilizador B não vê dados de A')
}
{
  // chave gigante ignorada
  const r = await req('/api/sync', { token: A.token, body: { since: 0, changes: [{ key: 'k'.repeat(200), value: 1, updatedAt: 1 }] } })
  ok(r.status === 200, 'chave >128 chars ignorada sem erro')
}
{
  // só chaves conhecidas são aceites
  await req('/api/sync', { token: A.token, body: { since: 0, changes: [{ key: 'malicious', value: 1, updatedAt: 9e15 }, { key: 'diary:31-12-2026', value: 1, updatedAt: 9e15 }] } })
  const r = await req('/api/sync', { token: A.token, body: { since: 0, changes: [] } })
  ok(!r.data.changes.some((c) => c.key === 'malicious' || c.key === 'diary:31-12-2026'), 'chaves fora do formato esperado rejeitadas')
}

console.log('— social —')
await req('/api/social/username', { token: A.token, body: { username: `ana_${suffix}` } })
await req('/api/social/username', { token: B.token, body: { username: `bruno_${suffix}` } })
{
  const r = await req('/api/social/username', { token: B.token, body: { username: `ana_${suffix}` } })
  ok(r.status === 409, 'username duplicado rejeitado')
}
{
  const r = await req('/api/social/username', { token: B.token, body: { username: 'A!' } })
  ok(r.status === 400, 'username inválido rejeitado')
}
{
  // wildcards de LIKE não funcionam como curinga na pesquisa
  const r = await req(`/api/social/search?q=${encodeURIComponent('%%')}`, { token: A.token })
  ok(r.data.users.length === 0, 'pesquisa com % não devolve todos os utilizadores')
  const r2 = await req(`/api/social/search?q=bru`, { token: A.token })
  ok(r2.data.users.includes(`bruno_${suffix}`), 'pesquisa por prefixo encontra o utilizador')
}
{
  const r = await req('/api/social/request', { token: A.token, body: { username: `bruno_${suffix}` } })
  ok(r.data.status === 'pending', 'pedido de amizade fica pendente')
}
{
  const r = await req('/api/social/requests', { token: B.token })
  ok(r.data.requests.includes(`ana_${suffix}`), 'pedido aparece ao destinatário')
}
{
  // pedido cruzado = match automático
  const r = await req('/api/social/request', { token: B.token, body: { username: `ana_${suffix}` } })
  ok(r.data.status === 'accepted', 'pedido cruzado aceita automaticamente')
}
{
  const r = await req('/api/social/feed', { token: A.token })
  ok(r.data.feed.length === 2, 'feed inclui o próprio + amigo')
  const me = r.data.feed.find((f) => f.isMe)
  ok(me && me.stats !== null, 'as próprias stats aparecem sempre')
  const friend = r.data.feed.find((f) => !f.isMe)
  ok(friend.stats === null, 'stats de amigo sem partilha ficam privadas')
}
{
  await req('/api/social/share', { token: A.token, body: { enabled: true } })
  const r = await req('/api/social/feed', { token: B.token })
  const friend = r.data.feed.find((f) => !f.isMe)
  ok(friend.stats && friend.stats.loggedToday === true, 'com partilha ativa, amigo vê loggedToday')
  ok(!('kcal' in (friend.stats ?? {})), 'stats públicas nunca incluem calorias')
}
{
  // o parâmetro ?today= (data local do cliente) manda no cálculo do streak
  const r = await req(`/api/social/feed?today=${today}`, { token: A.token })
  const me = r.data.feed.find((f) => f.isMe)
  ok(me.stats.loggedToday === true && me.stats.streak >= 1, 'feed respeita a data local enviada pelo cliente')
}
{
  await req('/api/social/unfriend', { token: B.token, body: { username: `ana_${suffix}` } })
  const r = await req('/api/social/feed', { token: B.token })
  ok(r.data.feed.length === 1, 'unfriend remove do feed')
}

console.log('— RGPD —')
{
  const r = await req('/api/account/export', { token: A.token })
  ok(r.data.user?.email === emailA && r.data.data[`diary:${today}`], 'export devolve dados completos')
}
{
  const r = await req('/api/account', { method: 'DELETE', token: A.token })
  ok(r.data.deleted === true, 'conta eliminada')
  const r2 = await req('/api/auth/login', { body: { email: emailA, password: 'password123' } })
  ok(r2.status === 401, 'login após eliminação falha')
}

console.log('— recuperação de password —')
{
  const r = await req('/api/auth/forgot', { body: { email: emailB } })
  // sem RESEND_API_KEY: 503; com: 200 — ambos válidos consoante o ambiente
  ok(r.status === 503 || r.status === 200, `forgot responde corretamente (${r.status})`)
}
{
  const r = await req('/api/auth/reset', { body: { email: emailB, code: '000000', password: 'novapassword1' } })
  ok(r.status === 400, 'reset com código errado rejeitado')
}

console.log(`\n${passed} passaram, ${failed} falharam`)
process.exit(failed > 0 ? 1 : 0)
