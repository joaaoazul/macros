/** Interpretação de uma linha de ingrediente ("100 g de aveia", "2 ovos").
 *
 * O scraper devolve linhas de texto livre (schema.org recipeIngredient). Aqui
 * separamos a quantidade em gramas/ml (quando existe) do nome do alimento a
 * pesquisar. Peso explícito (g/kg/ml/l) é exato; medidas caseiras (colheres,
 * chávenas, latas) e contagens de alimentos comuns ("2 ovos") são convertidas
 * com pesos culinários típicos — uma estimativa honesta bate um campo vazio,
 * e o utilizador pode sempre ajustar as gramas antes de guardar. Sem nenhuma
 * pista, `grams` fica a null e a linha vira placeholder editável.
 */

/** Quantidade + unidade de peso/volume no início ou meio da linha. */
const QTY_RE =
  /(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+|[½⅓⅔¼¾])\s*(kg|g|gramas?|grams?|ml|mls?|l|lt|litros?|litres?)\b/i

/** Medidas caseiras: "2 colheres de sopa", "meia chávena", "1 lata". */
const MEASURE_RE =
  /(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+|[½⅓⅔¼¾]|meia|meio|uma?)\s*(colher(?:es)?\s+(?:de\s+)?sopa|c\.?\s*sopa|colher(?:es)?\s+(?:de\s+)?ch[aá]|c\.?\s*ch[aá]|ch[aá]vena?s?|x[ií]cara?s?|copos?|latas?)/i

/** Peso típico por unidade de alimentos comuns ("2 ovos" → 110 g). */
const UNIT_WEIGHTS: [match: RegExp, grams: number][] = [
  [/\bclaras?\b/i, 33],
  [/\bovos?\b/i, 55],
  [/\bbananas?\b/i, 120],
  [/\bma[çc][ãa]s?\b/i, 150],
  [/\bperas?\b/i, 160],
  [/\blaranjas?\b/i, 150],
  [/\bkiwis?\b/i, 75],
  [/\blim([õo]es|[ãa]o)\b/i, 60],
  [/\bdentes?\s+de\s+alho\b/i, 5],
  [/\bcebolas?\b/i, 110],
  [/\bcenouras?\b/i, 60],
  [/\btomates?\b/i, 120],
  [/\bbatatas?[-\s]doces?\b/i, 200],
  [/\bbatatas?\b/i, 170],
  [/\bcourgettes?\b|\babobrinhas?\b/i, 200],
  [/\bpimentos?\b/i, 120],
  [/\blatas?\s+de\s+atum\b/i, 120],
  [/\biogurtes?\b/i, 125],
  [/\bfatias?\s+de\s+p[ãa]o\b/i, 30],
  [/\btortilhas?\b|\bwraps?\b/i, 60],
]

/** Conectores e ruído a remover do nome depois de tirar a quantidade. */
const NOISE_RE =
  /\b(de|da|do|das|dos|d['’]|a|à|ao|em|com|c\/|colher(?:es)?|sopa|chá|café|chávenas?|xícaras?|copos?|latas?|meia|meio|cheia?s?|q\.?b\.?|a\s+gosto|picad[oa]s?|ralad[oa]s?|cozid[oa]s?|fatiad[oa]s?)\b/gi

export interface ParsedIngredient {
  /** gramas/ml quando a linha os declara ou permite estimar, senão null. */
  grams: number | null
  unit: 'g' | 'ml'
  /** nome limpo do alimento para pesquisar; '' se a linha for só quantidade. */
  query: string
}

/** "1/2", "½", "meia", "1,5" → número; null se não reconhecido. */
function parseNumber(raw: string): number | null {
  const s = raw.trim().toLowerCase()
  const unicode: Record<string, number> = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75 }
  if (s in unicode) return unicode[s]
  if (s === 'meia' || s === 'meio') return 0.5
  if (s === 'um' || s === 'uma') return 1
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(s)
  if (frac) {
    const den = Number(frac[2])
    return den > 0 ? Number(frac[1]) / den : null
  }
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Normaliza kg→g e l→ml; devolve [gramas, unidade] ou null se não fizer sentido. */
function normalize(value: number | null, rawUnit: string): [number, 'g' | 'ml'] | null {
  if (value === null || !Number.isFinite(value) || value <= 0) return null
  const u = rawUnit.toLowerCase()
  if (u === 'kg') return [value * 1000, 'g']
  if (u === 'l' || u === 'lt' || u.startsWith('litro') || u.startsWith('litre')) return [value * 1000, 'ml']
  if (u.startsWith('ml') || u === 'mls') return [value, 'ml']
  return [value, 'g'] // g, grama(s), gram(s)
}

/** Extrai {grams, unit, query} de uma linha de ingrediente. */
export function parseIngredientLine(line: string): ParsedIngredient {
  const text = line.trim()
  let grams: number | null = null
  let unit: 'g' | 'ml' = 'g'
  let consumed = ''

  // 1) peso/volume explícito — exato
  const m = QTY_RE.exec(text)
  if (m) {
    const norm = normalize(parseNumber(m[1]), m[2])
    if (norm) {
      grams = Math.round(norm[0])
      unit = norm[1]
      consumed = m[0]
    }
  }

  // 2) medida caseira ("2 colheres de sopa de azeite") — estimativa
  if (grams === null) {
    const mm = MEASURE_RE.exec(text)
    if (mm) {
      const count = parseNumber(mm[1])
      const measure = mm[2]
      const per =
        /sopa/i.test(measure) ? 15
        : /colher|^c\.?\s*ch/i.test(measure) ? 5
        : /lata/i.test(measure) ? (/atum|sardinha/i.test(text) ? 120 : 400)
        : 200 // chávena, xícara, copo
      if (count !== null && count > 0) {
        grams = Math.round(count * per)
        consumed = mm[0]
      }
    }
  }

  // nome = linha sem a quantidade casada e sem números/conectores soltos
  let query = (consumed ? text.replace(consumed, ' ') : text)
    .replace(/\(.*?\)/g, ' ') // remove "(opcional)", "(a gosto)"…
    .replace(/[\d.,/½⅓⅔¼¾]+/g, ' ') // números soltos ("2" em "2 ovos")
    .replace(NOISE_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  query = query.replace(/^[\s\-–—:]+/, '').trim()

  // 3) contagem de alimentos comuns ("2 ovos", "1 cebola") — estimativa
  if (grams === null) {
    const count =
      parseNumber(/^(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+|[½⅓⅔¼¾]|meia|meio|uma?)\b/i.exec(text)?.[1] ?? '') ?? 1
    const hit = UNIT_WEIGHTS.find(([re]) => re.test(text))
    if (hit && count > 0) grams = Math.round(count * hit[1])
  }

  return { grams, unit, query }
}
