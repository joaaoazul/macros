/** Lógica da lista de compras: agregação do plano + despensa, corredores,
 *  formatação de quantidades e as regras da barra de equilíbrio. */

import type { MealPlanEntry, PantryItem, RecipeItem } from '../types'

export const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
export const WEEKDAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export const PLAN_MEALS = [
  { id: 'lunch' as const, label: 'Almoço', emoji: '🍽️' },
  { id: 'dinner' as const, label: 'Jantar', emoji: '🌙' },
]

/** Índice do dia da semana (0=segunda) para hoje, em fuso local. */
export function todayWeekday(): number {
  return (new Date().getDay() + 6) % 7
}

/** Normaliza um nome para agregar/comparar: minúsculas, sem marca, sem acentos. */
export function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // remove "(marca)"
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// --- corredores do supermercado (heurística por palavra-chave) ---

interface Aisle {
  id: string
  label: string
  emoji: string
}

const AISLES: (Aisle & { keywords: string[] })[] = [
  { id: 'produce', label: 'Hortofrutícolas', emoji: '🥦', keywords: ['alface', 'tomate', 'cebola', 'alho', 'cenoura', 'brocolo', 'brócolo', 'couve', 'espinafre', 'curgete', 'courgette', 'pimento', 'batata', 'banana', 'maca', 'maçã', 'laranja', 'fruta', 'legume', 'salada', 'cogumelo', 'abobora', 'abóbora', 'beringela', 'pepino', 'espargos', 'grelos', 'feijao verde', 'limao', 'limão', 'morango', 'pera', 'kiwi', 'uva', 'aboborinha', 'rucula', 'rúcula', 'agriao', 'agrião'] },
  { id: 'meat', label: 'Talho', emoji: '🥩', keywords: ['frango', 'peru', 'vaca', 'bife', 'porco', 'carne', 'peito', 'coxa', 'lombo', 'perna', 'entrecosto', 'hamburguer', 'hambúrguer', 'almondega', 'almôndega', 'salsicha'] },
  { id: 'fish', label: 'Peixaria', emoji: '🐟', keywords: ['peixe', 'atum', 'salmao', 'salmão', 'bacalhau', 'pescada', 'dourada', 'robalo', 'camarao', 'camarão', 'polvo', 'sardinha', 'cavala', 'marisco'] },
  { id: 'dairy', label: 'Laticínios & ovos', emoji: '🧀', keywords: ['leite', 'iogurte', 'queijo', 'ovo', 'manteiga', 'natas', 'requeijao', 'requeijão', 'kefir', 'skyr', 'creme'] },
  { id: 'bakery', label: 'Padaria', emoji: '🥖', keywords: ['pao', 'pão', 'broa', 'tosta', 'baguete', 'bolo', 'croissant', 'wrap', 'tortilha'] },
  { id: 'pantry', label: 'Mercearia', emoji: '🥫', keywords: ['arroz', 'massa', 'esparguete', 'feijao', 'feijão', 'grao', 'grão', 'lentilha', 'aveia', 'farinha', 'acucar', 'açúcar', 'sal', 'azeite', 'oleo', 'óleo', 'vinagre', 'atum em', 'conserva', 'molho', 'tomate pelado', 'cereais', 'granola', 'mel', 'frutos secos', 'amendoa', 'amêndoa', 'noz', 'caju', 'manteiga de amendoim', 'quinoa', 'cuscuz', 'polenta', 'tofu', 'especiaria', 'caldo'] },
  { id: 'frozen', label: 'Congelados', emoji: '🧊', keywords: ['congelado', 'gelado', 'ervilha', 'espinafres congelados'] },
  { id: 'drinks', label: 'Bebidas', emoji: '🧃', keywords: ['agua', 'água', 'sumo', 'refrigerante', 'cha', 'chá', 'cafe', 'café', 'bebida'] },
]

const OTHER: Aisle = { id: 'other', label: 'Outros', emoji: '🛒' }

export function aisleFor(name: string): Aisle {
  const n = normalize(name)
  for (const a of AISLES) {
    if (a.keywords.some((k) => n.includes(k))) return { id: a.id, label: a.label, emoji: a.emoji }
  }
  return OTHER
}

const AISLE_ORDER = [...AISLES.map((a) => a.id), OTHER.id]

// --- agregação ---

export interface ShoppingItem {
  key: string
  name: string
  emoji: string
  grams: number
  unit: 'g' | 'ml'
  aisle: Aisle
}

export interface ShoppingGroup {
  aisle: Aisle
  items: ShoppingItem[]
}

/** Um item "have" da despensa oculta ingredientes cujo nome o contenha (ou vice-versa). */
function isExcluded(name: string, haveNames: string[]): boolean {
  const n = normalize(name)
  return haveNames.some((h) => h.length >= 3 && (n.includes(h) || h.includes(n)))
}

/**
 * Junta os ingredientes do plano (× doses) com os recorrentes da despensa,
 * remove os "tenho sempre", e agrupa por corredor.
 */
export function buildShoppingList(plan: MealPlanEntry[], pantry: PantryItem[]): ShoppingGroup[] {
  const haveNames = pantry.filter((p) => p.kind === 'have').map((p) => normalize(p.name))
  const acc = new Map<string, ShoppingItem>()

  const add = (name: string, emoji: string, grams: number, unit: 'g' | 'ml') => {
    if (grams <= 0 || isExcluded(name, haveNames)) return
    const key = `${normalize(name)}|${unit}`
    const cur = acc.get(key)
    if (cur) cur.grams += grams
    else acc.set(key, { key, name: name.replace(/\s*\(.*?\)\s*/g, '').trim() || name, emoji, grams, unit, aisle: aisleFor(name) })
  }

  for (const entry of plan) {
    const servings = entry.servings > 0 ? entry.servings : 1
    for (const i of entry.items) add(i.foodName, i.emoji, i.grams * servings, i.unit)
  }
  for (const p of pantry) {
    if (p.kind === 'recurring' && p.grams && p.grams > 0) add(p.name, p.emoji || '🛒', p.grams, p.unit || 'g')
  }

  const groups = new Map<string, ShoppingGroup>()
  for (const item of acc.values()) {
    const g = groups.get(item.aisle.id) ?? { aisle: item.aisle, items: [] }
    g.items.push(item)
    groups.set(item.aisle.id, g)
  }
  for (const g of groups.values()) g.items.sort((a, b) => a.name.localeCompare(b.name, 'pt'))
  return [...groups.values()].sort(
    (a, b) => AISLE_ORDER.indexOf(a.aisle.id) - AISLE_ORDER.indexOf(b.aisle.id),
  )
}

/** Quantidade legível para comprar: g→kg, ml→L quando faz sentido. */
export function formatQuantity(grams: number, unit: 'g' | 'ml'): string {
  const g = Math.round(grams)
  if (unit === 'ml') {
    return g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1)} L` : `${g} ml`
  }
  return g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1)} kg` : `${g} g`
}

// --- barra de equilíbrio (regras simples, não é aconselhamento clínico) ---

const VEG = ['alface', 'tomate', 'cebola', 'cenoura', 'brocolo', 'brócolo', 'couve', 'espinafre', 'curgete', 'courgette', 'pimento', 'legume', 'salada', 'cogumelo', 'abobora', 'abóbora', 'beringela', 'pepino', 'espargos', 'grelos', 'feijao verde', 'ervilha', 'grelhado de legumes', 'vegetais', 'rucula', 'rúcula', 'agriao', 'agrião']
const PROTEIN_SOURCES = ['frango', 'peru', 'vaca', 'bife', 'porco', 'carne', 'atum', 'salmao', 'salmão', 'peixe', 'bacalhau', 'ovo', 'feijao', 'feijão', 'grao', 'grão', 'lentilha', 'tofu', 'queijo', 'iogurte', 'camarao', 'camarão']

function itemsText(items: RecipeItem[]): string {
  return normalize(items.map((i) => i.foodName).join(' '))
}

export interface BalanceNote {
  tone: 'good' | 'warn'
  text: string
}

/** Analisa o menu planeado e devolve avisos suaves. */
export function analyzePlan(plan: MealPlanEntry[]): BalanceNote[] {
  if (plan.length === 0) return []
  const notes: BalanceNote[] = []

  // proteína média por refeição
  const proteinPerMeal =
    plan.reduce((s, e) => s + e.items.reduce((a, i) => a + i.protein, 0) * (e.servings || 1), 0) /
    plan.reduce((s, e) => s + (e.servings || 1), 0)
  notes.push(
    proteinPerMeal >= 25
      ? { tone: 'good', text: `Boa proteína — ~${Math.round(proteinPerMeal)} g por refeição` }
      : { tone: 'warn', text: `Proteína baixa (~${Math.round(proteinPerMeal)} g/refeição) — junta uma fonte magra` },
  )

  // vegetais
  const withVeg = plan.filter((e) => VEG.some((v) => itemsText(e.items).includes(v))).length
  const vegRatio = withVeg / plan.length
  notes.push(
    vegRatio >= 0.5
      ? { tone: 'good', text: `Vegetais em ${withVeg}/${plan.length} refeições` }
      : { tone: 'warn', text: `Só ${withVeg}/${plan.length} refeições têm vegetais — tenta metade do prato` },
  )

  // variedade de proteínas
  const sources = new Set<string>()
  for (const e of plan) for (const s of PROTEIN_SOURCES) if (itemsText(e.items).includes(s)) sources.add(s)
  if (plan.length >= 3) {
    notes.push(
      sources.size >= 3
        ? { tone: 'good', text: `Variedade de proteínas (${sources.size} fontes)` }
        : { tone: 'warn', text: `Pouca variedade — repete a mesma proteína. Alterna carne/peixe/vegetal` },
    )
  }

  return notes
}
