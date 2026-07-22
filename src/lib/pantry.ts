/** Despensa em stock: estado de validade, prazos típicos e sugestão de receitas.
 *
 * As datas são comparadas por DIA (sem horas) para evitar erros de fuso a dizer
 * que algo "expira hoje". Os prazos típicos vêm das normas de segurança alimentar
 * (FSIS/FoodKeeper) — são um palpite razoável ao adicionar, sempre editável. */

import type { PantryItem, Recipe } from '../types'

/** A partir de quantos dias (ou menos) um item conta como "a expirar". */
export const EXPIRY_SOON_DAYS = 3

export type ExpiryStatus = 'ok' | 'soon' | 'expired'

/** Data local de hoje em ISO (YYYY-MM-DD), sem horas. */
export function todayISODate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Dias inteiros de hoje até `iso` (negativo se já passou; null se sem data). */
export function daysUntil(iso: string | null | undefined, today = todayISODate()): number | null {
  if (!iso) return null
  const a = Date.parse(`${today}T00:00:00`)
  const b = Date.parse(`${iso}T00:00:00`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86_400_000)
}

export function expiryStatus(item: PantryItem, today = todayISODate()): ExpiryStatus {
  const d = daysUntil(item.expiresOn, today)
  if (d === null) return 'ok'
  if (d < 0) return 'expired'
  return d <= EXPIRY_SOON_DAYS ? 'soon' : 'ok'
}

/** Ordena stock pelo que expira primeiro (sem data vai para o fim). */
export function sortByExpiry(items: PantryItem[]): PantryItem[] {
  return [...items].sort((a, b) => {
    const da = a.expiresOn ?? '9999-12-31'
    const db = b.expiresOn ?? '9999-12-31'
    return da.localeCompare(db)
  })
}

/** Prazos típicos de conservação (dias), por palavra-chave no nome do alimento.
 * Normas de segurança alimentar (frigorífico, produto fresco não aberto). */
const SHELF_LIFE_DAYS: [match: string, days: number][] = [
  // peixe e marisco — muito perecível
  ['peixe', 2], ['salmao', 2], ['salmão', 2], ['atum fresco', 2], ['bacalhau fresco', 2],
  ['dourada', 2], ['robalo', 2], ['camarao', 2], ['camarão', 2], ['marisco', 2], ['polvo', 2],
  // aves e carne picada
  ['frango', 2], ['peru', 2], ['aves', 2], ['carne picada', 2], ['picad', 2],
  // carnes vermelhas
  ['vaca', 4], ['bife', 4], ['porco', 4], ['borrego', 4], ['carne', 4], ['fiambre', 5], ['salsicha', 4],
  // laticínios
  ['leite', 7], ['iogurte', 14], ['skyr', 14], ['requeijao', 7], ['requeijão', 7],
  ['queijo fresco', 7], ['queijo', 21], ['manteiga', 30], ['natas', 7], ['ovo', 28], ['ovos', 28],
  // fruta e legumes
  ['alface', 5], ['espinafre', 4], ['rucula', 4], ['rúcula', 4], ['brocolo', 5], ['bróculo', 5],
  ['brócolo', 5], ['couve', 6], ['cenoura', 21], ['tomate', 6], ['pepino', 6], ['courgette', 6],
  ['pimento', 7], ['cogumelo', 5], ['banana', 5], ['maca', 30], ['maçã', 30], ['morango', 3],
  ['mirtilo', 7], ['fruta', 7], ['legume', 6], ['salada', 4],
  // despensa / padaria
  ['pao', 5], ['pão', 5], ['tosta', 30], ['arroz', 720], ['massa', 720], ['aveia', 365],
  ['grao', 720], ['grão', 720], ['feijao', 720], ['feijão', 720], ['lentilha', 720],
  ['conserva', 720], ['enlatado', 720],
]

/** Sugere um prazo (dias) para um alimento pelo nome; default 5 se desconhecido. */
export function shelfLifeDays(name: string): number {
  const n = name.toLowerCase().trim()
  for (const [match, days] of SHELF_LIFE_DAYS) {
    if (n.includes(match)) return days
  }
  return 5
}

/** Data de validade sugerida (ISO) para um alimento acabado de adicionar. */
export function defaultExpiryFor(name: string, today = todayISODate()): string {
  // setDate em vez de somar ms: um prazo que atravessa a mudança de hora
  // (DST) aterrava às 23:00 do dia anterior e sugeria a data errada
  const d = new Date(`${today}T00:00:00`)
  d.setDate(d.getDate() + shelfLifeDays(name))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function norm(s: string): string {
  // NFD + remover marcas diacríticas combinadas (U+0300–U+036F) → "brócolo" == "brocolo"
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/** Receitas "cozinháveis" com o que está em stock: ordenadas pela fração de
 * ingredientes cobertos; só entra quem tem ≥2 ingredientes presentes ou ≥60%
 * da receita coberta (senão qualquer receita com sal aparecia). */
export function recipesCookableFrom<R extends { items: { foodName: string }[] }>(
  stockNames: string[],
  recipes: R[],
  limit = 5,
): { recipe: R; have: number; total: number }[] {
  const needles = stockNames.map(norm).filter((s) => s.length >= 3)
  if (needles.length === 0) return []
  return recipes
    .map((recipe) => {
      const hay = recipe.items.map((i) => norm(i.foodName))
      const have = hay.filter((h) => needles.some((n) => h.includes(n) || n.includes(h))).length
      return { recipe, have, total: hay.length }
    })
    .filter((x) => x.total > 0 && (x.have >= 2 || x.have / x.total >= 0.6))
    .sort((a, b) => b.have / b.total - a.have / a.total || b.have - a.have)
    .slice(0, limit)
}

/** Receitas do utilizador que usam os alimentos a expirar, do que usa mais para
 * menos. Correspondência por nome normalizado (substring nos dois sentidos). */
export function recipesToUseUp(expiringNames: string[], recipes: Recipe[], limit = 5): Recipe[] {
  const needles = expiringNames.map(norm).filter((s) => s.length >= 3)
  if (needles.length === 0) return []
  const scored = recipes
    .map((r) => {
      const hay = r.items.map((i) => norm(i.foodName))
      const hits = needles.filter((n) => hay.some((h) => h.includes(n) || n.includes(h))).length
      return { r, hits }
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
  return scored.slice(0, limit).map((x) => x.r)
}
