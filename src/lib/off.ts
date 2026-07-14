import type { Food } from '../types'

/**
 * Pesquisa no Open Food Facts (instância portuguesa — produtos à venda em
 * Portugal: Continente, Pingo Doce, Auchan, Lidl…). API aberta com CORS.
 * https://openfoodfacts.github.io/openfoodfacts-server/api/
 */
const OFF_BASE = 'https://pt.openfoodfacts.org'
const FIELDS =
  'code,product_name,product_name_pt,generic_name,generic_name_pt,brands,nutriments,serving_quantity,serving_quantity_unit,serving_size,product_quantity,quantity'

interface OffProduct {
  code: string
  product_name?: string
  product_name_pt?: string
  generic_name?: string
  generic_name_pt?: string
  brands?: string
  nutriments?: Record<string, number | string>
  serving_quantity?: number | string
  serving_quantity_unit?: string
  serving_size?: string
  product_quantity?: number | string
  quantity?: string
}

function toFood(p: OffProduct): Food | null {
  const n = p.nutriments ?? {}
  const num = (k: string) => {
    const v = Number(n[k])
    return Number.isFinite(v) ? v : NaN
  }
  let kcal = num('energy-kcal_100g')
  if (!Number.isFinite(kcal)) {
    const kj = num('energy_100g')
    if (Number.isFinite(kj)) kcal = kj / 4.184
  }
  const name = (
    p.product_name_pt ||
    p.product_name ||
    p.generic_name_pt ||
    p.generic_name ||
    ''
  ).trim()
  if (!name || !Number.isFinite(kcal)) return null

  // Líquidos: se a dose vier em ml (ou o nome sugerir bebida) tratamos em ml.
  const servingUnit = String(p.serving_quantity_unit ?? '').toLowerCase()
  const unit: 'g' | 'ml' = servingUnit === 'ml' || servingUnit === 'cl' || servingUnit === 'l' ? 'ml' : 'g'

  // Porção "1 dose" a partir do serving declarado (ex.: 1 dose = 30 g).
  const servingQ = Number(p.serving_quantity)
  const portions =
    Number.isFinite(servingQ) && servingQ > 0 && servingQ !== 100
      ? [{ label: 'dose', grams: Math.round(servingQ) }]
      : undefined

  const micro = (k: string) => {
    const v = num(k)
    return Number.isFinite(v) ? round1(v) : undefined
  }

  const pkg = Number(p.product_quantity)
  const packageGrams = Number.isFinite(pkg) && pkg > 0 ? Math.round(pkg) : undefined

  return {
    id: `off-${p.code}`,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    emoji: unit === 'ml' ? '🥤' : '🛒',
    kcal: Math.round(kcal),
    protein: round1(num('proteins_100g')),
    carbs: round1(num('carbohydrates_100g')),
    fat: round1(num('fat_100g')),
    unit,
    fiber: micro('fiber_100g'),
    sugar: micro('sugars_100g'),
    saturates: micro('saturated-fat_100g'),
    salt: micro('salt_100g'),
    portions,
    packageGrams,
  }
}

const round1 = (v: number) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0)

export async function searchOpenFoodFacts(query: string, signal?: AbortSignal): Promise<Food[]> {
  const q = query.trim()
  if (q.length < 3) return []

  // um código de barras escrito à mão vai direto ao produto
  if (/^\d{8,14}$/.test(q)) {
    const res = await fetch(`${OFF_BASE}/api/v2/product/${q}.json?fields=${FIELDS}`, { signal })
    if (!res.ok) return []
    const data = await res.json()
    const food = data.product ? toFood(data.product) : null
    return food ? [food] : []
  }

  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30&fields=${FIELDS}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`OFF ${res.status}`)
  const data = await res.json()
  const products: OffProduct[] = data.products ?? []
  const foods = products.map(toFood).filter((f): f is Food => f !== null)
  // produtos com macros completos (proteína/hidratos/gordura) aparecem primeiro
  const completeness = (f: Food) => (f.protein > 0 ? 1 : 0) + (f.carbs > 0 ? 1 : 0) + (f.fat > 0 ? 1 : 0)
  return foods.sort((a, b) => completeness(b) - completeness(a))
}
