/**
 * Smoke test de UI (Playwright) — cobre os fluxos críticos da app.
 *
 *   npm run build && npx vite preview --port 4173 &     # frontend
 *   cd server && rm -f data.db* && node index.js &      # backend limpo
 *   node tests/smoke.mjs
 *
 * Variáveis: APP_URL (default http://localhost:4173), API_URL (default http://127.0.0.1:8787),
 * CHROME (caminho do executável do Chromium, se necessário).
 */
import { chromium } from 'playwright-core'

const APP = process.env.APP_URL ?? 'http://localhost:4173'
const API = process.env.API_URL ?? 'http://127.0.0.1:8787'
const EXE = process.env.CHROME // undefined = deixa o Playwright resolver

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

const browser = await chromium.launch(EXE ? { executablePath: EXE } : {})
const newPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => {
    failed++
    console.error(`  ✗ ERRO DE PÁGINA: ${e.message}`)
  })
  await page.goto(APP)
  await page.evaluate((api) => localStorage.setItem('macros.apiUrl', api), API)
  return { ctx, page }
}

console.log('— onboarding e plano —')
{
  const { ctx, page } = await newPage()
  await page.getByPlaceholder('O teu nome').fill('Teste')
  await page.getByPlaceholder('25').fill('30')
  await page.getByPlaceholder('175').fill('180')
  await page.getByPlaceholder('70').fill('80')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByText('Moderado', { exact: false }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByText('Manter o peso', { exact: false }).click()
  await page.getByRole('button', { name: 'Ver o meu plano' }).click()
  // Mifflin-St Jeor M 80kg/180cm/30a *1.55 ≈ 2728 kcal
  const kcal = await page.locator('text=/2\\s?7\\d\\d/').first().isVisible().catch(() => false)
  ok(kcal, 'plano calcula ~2700 kcal (Mifflin-St Jeor)')
  await page.getByRole('button', { name: /Começar/ }).click()
  await page.waitForTimeout(400)
  ok(await page.getByText('Olá, Teste!').isVisible(), 'entra no resumo após onboarding')

  console.log('— diário: adicionar, totais, remover —')
  await page.getByRole('button', { name: 'Adicionar alimento' }).click() // FAB
  await page.waitForTimeout(300)
  await page.getByPlaceholder(/Pesquisar alimento/).fill('banana')
  await page.waitForTimeout(300)
  await page.getByText('Banana', { exact: true }).first().click()
  await page.getByRole('button', { name: /^Adicionar$/ }).click()
  await page.waitForTimeout(400)
  ok(await page.getByText('89 kcal').first().isVisible().catch(() => false), 'refeição mostra kcal da banana (100 g = 89)')

  // água
  await page.getByRole('button', { name: '+250 ml' }).click()
  await page.getByRole('button', { name: '+500 ml' }).click()
  await page.waitForTimeout(200)
  ok(await page.getByText('750 /').isVisible().catch(() => false), 'água soma 750 ml')

  // exercício entra na fórmula
  await page.getByText('Exercício', { exact: true }).click()
  await page.getByPlaceholder(/corrida/).fill('Corrida')
  await page.getByPlaceholder('Calorias queimadas').fill('200')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await page.waitForTimeout(300)
  ok(await page.getByText('−200 kcal').isVisible().catch(() => false), 'exercício regista −200 kcal')

  console.log('— metas: edição de macros —')
  await page.getByRole('button', { name: 'Metas' }).click()
  await page.getByText('Editar macronutrientes').click()
  const pct = page.locator('input[inputmode="numeric"]')
  await pct.nth(1).fill('40') // hidratos
  await pct.nth(2).fill('30') // proteína
  await pct.nth(3).fill('30') // gordura
  await page.getByRole('button', { name: 'Guardar' }).click()
  await page.waitForTimeout(300)
  ok(await page.getByText('40', { exact: true }).first().isVisible().catch(() => false), 'donut reflete split 40/30/30')

  await ctx.close()
}

console.log('— conta e sincronização entre dispositivos —')
{
  const email = `smoke-${Date.now().toString(36)}@test.pt`
  const { ctx, page } = await newPage()
  await page.evaluate(() => {
    localStorage.setItem(
      'macros.profile',
      JSON.stringify({ name: 'Sync', sex: 'F', age: 28, heightCm: 165, weightKg: 60, activity: 1.375, goal: 'cut', targets: { kcal: 1800, protein: 132, carbs: 180, fat: 50, waterMl: 2000 } }),
    )
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem('macros.diary', JSON.stringify({ [today]: [{ id: 's1', meal: 'lunch', foodName: 'Sopa de legumes', emoji: '🥣', grams: 300, unit: 'g', kcal: 120, protein: 5, carbs: 20, fat: 2 }] }))
  })
  await page.reload()
  await page.getByRole('button', { name: 'Perfil' }).click()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder(/mín\. 8/).fill('supersegura1')
  await page.getByRole('button', { name: 'Criar conta e sincronizar' }).click()
  await page.waitForTimeout(2500)
  await page.getByRole('button', { name: 'Perfil' }).click()
  await page.waitForTimeout(400)
  ok(await page.getByText(email).isVisible().catch(() => false), 'conta criada e sessão iniciada')
  await ctx.close()

  const { ctx: ctx2, page: p2 } = await newPage()
  await p2.reload()
  await p2.getByText('Já tens conta? Entrar e sincronizar').click()
  await p2.getByPlaceholder('Email').fill(email)
  await p2.getByPlaceholder('Password').fill('supersegura1')
  await p2.getByRole('button', { name: 'Entrar', exact: true }).click()
  await p2.waitForTimeout(2800)
  ok(await p2.getByText('Olá, Sync!').isVisible().catch(() => false), '2º dispositivo recebe o perfil')
  ok(await p2.getByText('Sopa de legumes').isVisible().catch(() => false), '2º dispositivo recebe o diário')
  await ctx2.close()
}

await browser.close()
console.log(`\n${passed} passaram, ${failed} falharam`)
process.exit(failed > 0 ? 1 : 0)
