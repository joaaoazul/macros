/** Interpretação de uma linha de ingrediente ("100 g de aveia", "2 ovos").
 *
 * O scraper devolve linhas de texto livre (schema.org recipeIngredient). Aqui
 * separamos a quantidade em gramas/ml (quando existe) do nome do alimento a
 * pesquisar. Nunca inventamos gramas: se a linha não trouxer peso, `grams` fica
 * a null e quem chama trata a linha como um placeholder editável.
 */

/** Quantidade + unidade de peso/volume no início ou meio da linha. */
const QTY_RE =
  /(\d+(?:[.,]\d+)?)\s*(kg|g|gramas?|grams?|ml|mls?|l|lt|litros?|litres?)\b/i

/** Conectores e ruído a remover do nome depois de tirar a quantidade. */
const NOISE_RE =
  /\b(de|da|do|das|dos|d['’]|a|à|ao|em|com|c\/|colher(?:es)?|sopa|chá|café|cheia?s?|q\.?b\.?|a\s+gosto|picad[oa]s?|ralad[oa]s?|cozid[oa]s?|fatiad[oa]s?)\b/gi

export interface ParsedIngredient {
  /** gramas/ml quando a linha os declara, senão null (nunca adivinhamos). */
  grams: number | null
  unit: 'g' | 'ml'
  /** nome limpo do alimento para pesquisar; '' se a linha for só quantidade. */
  query: string
}

/** Normaliza kg→g e l→ml; devolve [gramas, unidade] ou null se não fizer sentido. */
function normalize(value: number, rawUnit: string): [number, 'g' | 'ml'] | null {
  if (!Number.isFinite(value) || value <= 0) return null
  const u = rawUnit.toLowerCase()
  if (u === 'kg') return [value * 1000, 'g']
  if (u === 'l' || u === 'lt' || u.startsWith('litro') || u.startsWith('litre')) return [value * 1000, 'ml']
  if (u.startsWith('ml') || u === 'mls') return [value, 'ml']
  return [value, 'g'] // g, grama(s), gram(s)
}

/** Extrai {grams, unit, query} de uma linha de ingrediente. */
export function parseIngredientLine(line: string): ParsedIngredient {
  const text = line.trim()
  const m = QTY_RE.exec(text)
  let grams: number | null = null
  let unit: 'g' | 'ml' = 'g'
  if (m) {
    const norm = normalize(Number(m[1].replace(',', '.')), m[2])
    if (norm) {
      grams = norm[0]
      unit = norm[1]
    }
  }

  // nome = linha sem a quantidade casada e sem números/conectores soltos
  let query = (m ? text.replace(m[0], ' ') : text)
    .replace(/\(.*?\)/g, ' ') // remove "(opcional)", "(a gosto)"…
    .replace(/[\d.,/]+/g, ' ') // números soltos ("2" em "2 ovos")
    .replace(NOISE_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // se sobrar pontuação/traços iniciais, limpa
  query = query.replace(/^[\s\-–—:]+/, '').trim()

  return { grams, unit, query }
}
