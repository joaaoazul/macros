/** Biblioteca pública de receitas (português), empacotada na app.
 *
 * Carregada em lazy (import dinâmico) pelo RecipeLibrary, para não pesar no
 * bundle inicial da PWA. Para acrescentar receitas basta juntar uma entrada a
 * RAW abaixo: cada ingrediente é `[idDoFOOD_DB, gramas]` (as macros saem do
 * FOOD_DB, ficam sempre coerentes) ou um objeto inline com per100 = [kcal,
 * proteína, hidratos, gordura] por 100 g/ml quando o alimento não existe no DB.
 *
 * As macros de cada item são snapshots absolutos calculados no arranque, por
 * isso a receita fica auto-contida (ver LibraryRecipe em types.ts).
 */

import type { LibraryRecipe, RecipeItem } from '../types'
import { FOOD_DB } from '../lib/foods'

const BY_ID = new Map(FOOD_DB.map((f) => [f.id, f]))

/** Ingrediente inline p/ alimentos fora do FOOD_DB. */
interface Inline {
  name: string
  emoji: string
  unit?: 'g' | 'ml'
  per100: [kcal: number, protein: number, carbs: number, fat: number]
  grams: number
}
type Spec = [id: string, grams: number] | Inline

interface RawRecipe {
  id: string
  name: string
  emoji: string
  tags: string[]
  servings: number
  minutes?: number
  ings: Spec[]
}

const r1 = (n: number) => Math.round(n * 10) / 10

function buildItem(spec: Spec): RecipeItem {
  if (Array.isArray(spec)) {
    const [id, grams] = spec
    const f = BY_ID.get(id)
    if (!f) throw new Error(`receita: alimento desconhecido '${id}'`)
    const k = grams / 100
    return {
      foodName: f.name,
      emoji: f.emoji,
      grams,
      unit: f.unit,
      kcal: Math.round(f.kcal * k),
      protein: r1(f.protein * k),
      carbs: r1(f.carbs * k),
      fat: r1(f.fat * k),
    }
  }
  const k = spec.grams / 100
  const [kcal, protein, carbs, fat] = spec.per100
  return {
    foodName: spec.name,
    emoji: spec.emoji,
    grams: spec.grams,
    unit: spec.unit ?? 'g',
    kcal: Math.round(kcal * k),
    protein: r1(protein * k),
    carbs: r1(carbs * k),
    fat: r1(fat * k),
  }
}

const RAW: RawRecipe[] = [
  // ── Pequeno-almoço ──────────────────────────────────────────────
  { id: 'papas-aveia-banana', name: 'Papas de aveia com banana', emoji: '🥣', tags: ['pequeno-almoço', 'vegetariano', 'rápido'], servings: 1, minutes: 10,
    ings: [['aveia', 60], ['leite-mg', 200], ['banana', 100], ['manteiga-amendoim', 15]] },
  { id: 'iogurte-granola-frutos', name: 'Iogurte grego com granola e frutos vermelhos', emoji: '🍨', tags: ['pequeno-almoço', 'vegetariano', 'rápido', 'proteico'], servings: 1, minutes: 5,
    ings: [['iogurte-grego', 170], ['granola', 40], ['mirtilos', 60], ['morangos', 60]] },
  { id: 'ovos-mexidos-tosta', name: 'Ovos mexidos com tosta integral', emoji: '🍳', tags: ['pequeno-almoço', 'proteico', 'rápido'], servings: 1, minutes: 10,
    ings: [['ovo-mexido', 150], ['pao-integral', 60], ['azeite', 5]] },
  { id: 'panquecas-aveia', name: 'Panquecas de aveia e banana', emoji: '🥞', tags: ['pequeno-almoço', 'vegetariano', 'proteico'], servings: 2, minutes: 15,
    ings: [['aveia', 80], ['banana', 120], ['ovo', 110], ['leite-magro', 60]] },
  { id: 'tosta-abacate-ovo', name: 'Tosta de abacate com ovo', emoji: '🥑', tags: ['pequeno-almoço', 'vegetariano'], servings: 1, minutes: 10,
    ings: [['pao-integral', 60], ['abacate', 70], ['ovo', 55]] },
  { id: 'batido-proteico-aveia', name: 'Batido proteico de aveia', emoji: '🥤', tags: ['pequeno-almoço', 'proteico', 'rápido'], servings: 1, minutes: 5,
    ings: [['whey', 30], ['aveia', 40], ['leite-magro', 250], ['banana', 100]] },
  { id: 'papas-skyr-frutos', name: 'Overnight oats com skyr', emoji: '🥣', tags: ['pequeno-almoço', 'proteico', 'vegetariano'], servings: 1, minutes: 5,
    ings: [['aveia', 50], ['skyr', 150], ['leite-aveia', 100], ['framboesas', 50], ['mel', 10]] },

  // ── Almoço / Jantar ─────────────────────────────────────────────
  { id: 'frango-arroz-brocolos', name: 'Frango grelhado com arroz e brócolos', emoji: '🍗', tags: ['almoço', 'jantar', 'proteico'], servings: 1, minutes: 25,
    ings: [['frango-peito', 150], ['arroz-integral', 150], ['brocolos', 120], ['azeite', 10]] },
  { id: 'salmao-batata-doce', name: 'Salmão com batata-doce e espinafres', emoji: '🐟', tags: ['almoço', 'jantar', 'proteico'], servings: 1, minutes: 30,
    ings: [['salmao', 150], ['batata-doce', 200], ['espinafres', 100], ['azeite', 10]] },
  { id: 'bife-vaca-massa', name: 'Bife de vaca com massa e tomate', emoji: '🥩', tags: ['almoço', 'jantar', 'proteico'], servings: 1, minutes: 25,
    ings: [['vaca-magra', 150], ['massa-cozida', 180], ['tomate', 80], ['azeite', 10]] },
  { id: 'bacalhau-grao', name: 'Bacalhau com grão e couve', emoji: '🐟', tags: ['almoço', 'jantar', 'proteico'], servings: 2, minutes: 35,
    ings: [['bacalhau', 240], ['grao', 240], ['grelos', 150], ['azeite', 20], ['ovo', 110]] },
  { id: 'wrap-frango', name: 'Wrap de frango e legumes', emoji: '🌯', tags: ['almoço', 'rápido', 'proteico'], servings: 1, minutes: 15,
    ings: [['wrap', 60], ['frango-peito', 120], ['alface', 40], ['tomate', 50], ['queijo-fresco', 40]] },
  { id: 'omelete-cogumelos', name: 'Omelete de cogumelos e queijo', emoji: '🍳', tags: ['almoço', 'jantar', 'vegetariano', 'proteico', 'rápido'], servings: 1, minutes: 12,
    ings: [['ovo', 165], ['cogumelos', 80], ['queijo-flamengo', 30], ['azeite', 5]] },
  { id: 'atum-massa-fria', name: 'Massa fria de atum', emoji: '🍝', tags: ['almoço', 'rápido', 'proteico'], servings: 1, minutes: 15,
    ings: [['massa-cozida', 180], ['atum-agua', 120], ['milho-cozido', 60], ['tomate', 60], ['azeite', 10]] },
  { id: 'peru-cuscuz', name: 'Peru com cuscuz e legumes', emoji: '🦃', tags: ['almoço', 'jantar', 'proteico'], servings: 1, minutes: 20,
    ings: [['peru-peito', 150], ['cuscuz', 150], ['pimento', 60], ['abobrinha', 80], ['azeite', 10]] },
  { id: 'dourada-batata', name: 'Dourada grelhada com batata cozida', emoji: '🐟', tags: ['almoço', 'jantar', 'proteico'], servings: 1, minutes: 30,
    ings: [['dourada', 180], ['batata', 200], ['feijao-verde', 100], ['azeite', 10]] },
  { id: 'hamburguer-caseiro', name: 'Hambúrguer caseiro de vaca', emoji: '🍔', tags: ['almoço', 'jantar', 'proteico'], servings: 1, minutes: 20,
    ings: [['hamburguer', 150], ['pao-trigo', 80], ['alface', 30], ['tomate', 40], ['queijo-flamengo', 20]] },
  { id: 'polvo-grelhado', name: 'Polvo grelhado à lagareiro', emoji: '🐙', tags: ['almoço', 'jantar', 'proteico'], servings: 2, minutes: 40,
    ings: [['polvo', 300], ['batata', 300], ['azeite', 30], ['alho', 15]] },
  { id: 'sardinhas-assadas', name: 'Sardinhas assadas com salada', emoji: '🐟', tags: ['almoço', 'jantar', 'proteico'], servings: 2, minutes: 25,
    ings: [['sardinha', 300], ['pao-trigo', 100], ['tomate', 120], ['pimento', 80], ['azeite', 15]] },
  { id: 'camarao-quinoa', name: 'Salteado de camarão com quinoa', emoji: '🦐', tags: ['almoço', 'jantar', 'proteico'], servings: 1, minutes: 20,
    ings: [['camarao', 150], ['quinoa', 150], ['brocolos', 100], ['alho', 10], ['azeite', 10]] },

  // ── Vegetariano / Vegan ─────────────────────────────────────────
  { id: 'tofu-salteado', name: 'Tofu salteado com legumes e arroz', emoji: '🧊', tags: ['almoço', 'jantar', 'vegetariano', 'vegan', 'proteico'], servings: 1, minutes: 20,
    ings: [['tofu', 150], ['arroz-integral', 150], ['pimento', 60], ['cenoura', 60], ['molho-soja', 15], ['azeite', 10]] },
  { id: 'caril-lentilhas', name: 'Caril de lentilhas', emoji: '🍛', tags: ['almoço', 'jantar', 'vegetariano', 'vegan', 'proteico'], servings: 2, minutes: 30,
    ings: [['lentilhas', 300], ['arroz-cozido', 200], ['cenoura', 100], ['cebola', 80], ['azeite', 15]] },
  { id: 'salada-grao', name: 'Salada de grão-de-bico', emoji: '🥗', tags: ['almoço', 'vegetariano', 'vegan', 'rápido'], servings: 1, minutes: 10,
    ings: [['grao', 180], ['tomate', 80], ['pimento', 60], ['cebola', 40], ['azeite', 15]] },
  { id: 'seitan-legumes', name: 'Seitan grelhado com legumes', emoji: '🌱', tags: ['almoço', 'jantar', 'vegetariano', 'vegan', 'proteico'], servings: 1, minutes: 20,
    ings: [['seitan', 150], ['batata-doce', 180], ['brocolos', 120], ['azeite', 10]] },
  { id: 'feijoada-vegetariana', name: 'Feijoada vegetariana', emoji: '🫘', tags: ['almoço', 'jantar', 'vegetariano', 'vegan', 'proteico'], servings: 3, minutes: 40,
    ings: [['feijao-preto', 450], ['arroz-cozido', 300], ['cenoura', 120], ['cebola', 100], ['azeite', 20]] },

  // ── Sopas ───────────────────────────────────────────────────────
  { id: 'sopa-legumes-basica', name: 'Sopa de legumes', emoji: '🍜', tags: ['jantar', 'vegetariano', 'vegan', 'sopa'], servings: 3, minutes: 35,
    ings: [['sopa-legumes', 750], ['azeite', 15]] },
  { id: 'caldo-verde-classico', name: 'Caldo verde', emoji: '🍲', tags: ['jantar', 'sopa'], servings: 4, minutes: 40,
    ings: [['caldo-verde', 1000], ['azeite', 20]] },

  // ── Snacks ──────────────────────────────────────────────────────
  { id: 'snack-requeijao-mel', name: 'Requeijão com mel e nozes', emoji: '🧀', tags: ['snack', 'vegetariano', 'rápido'], servings: 1, minutes: 3,
    ings: [['requeijao', 100], ['mel', 15], ['nozes', 20]] },
  { id: 'tortitas-manteiga-amendoim', name: 'Tortitas de arroz com manteiga de amendoim', emoji: '🍘', tags: ['snack', 'vegetariano', 'rápido'], servings: 1, minutes: 3,
    ings: [['tortitas-arroz', 20], ['manteiga-amendoim', 20], ['banana', 60]] },
  { id: 'snack-iogurte-proteico', name: 'Iogurte proteico com amêndoas', emoji: '🥛', tags: ['snack', 'proteico', 'vegetariano', 'rápido'], servings: 1, minutes: 2,
    ings: [['iogurte-proteico', 200], ['amendoas', 20], ['mirtilos', 40]] },
  { id: 'snack-fruta-queijo', name: 'Maçã com queijo fresco', emoji: '🍎', tags: ['snack', 'vegetariano', 'rápido'], servings: 1, minutes: 2,
    ings: [['maca', 150], ['queijo-fresco', 60]] },

  // ── Sobremesas ──────────────────────────────────────────────────
  { id: 'mousse-skyr-cacau', name: 'Mousse de skyr e cacau', emoji: '🍫', tags: ['sobremesa', 'proteico', 'vegetariano'], servings: 1, minutes: 5,
    ings: [['skyr', 150], ['chocolate-negro', 15], ['mel', 10], ['morangos', 60]] },
  { id: 'salada-fruta', name: 'Salada de fruta', emoji: '🍓', tags: ['sobremesa', 'vegetariano', 'vegan', 'rápido'], servings: 2, minutes: 10,
    ings: [['maca', 120], ['banana', 100], ['laranja', 130], ['kiwi', 75], ['uvas', 80]] },
  { id: 'iogurte-banana-cacau', name: 'Gelado caseiro de banana', emoji: '🍨', tags: ['sobremesa', 'vegetariano', 'rápido'], servings: 1, minutes: 5,
    ings: [['banana', 150], ['iogurte-grego', 100], ['chocolate-negro', 10]] },

  // ── Lote 2 (ingredientes inline: per100 = [kcal, proteína, hidratos, gordura] por 100 g/ml) ──
  // ── Pequeno-almoço ──────────────────────────────────────────────
  { id: 'overnight-oats-chia', name: 'Overnight oats com chia e maçã', emoji: '🥣', tags: ['pequeno-almoço', 'vegetariano'], servings: 1, minutes: 5,
    ings: [
      { name: 'Aveia', emoji: '🌾', per100: [389, 17, 66, 7], grams: 50 },
      { name: 'Leite meio-gordo', emoji: '🥛', unit: 'ml', per100: [47, 3.3, 4.8, 1.6], grams: 180 },
      { name: 'Sementes de chia', emoji: '🌱', per100: [486, 17, 42, 31], grams: 12 },
      { name: 'Maçã', emoji: '🍎', per100: [52, 0.3, 14, 0.2], grams: 100 },
    ] },
  { id: 'tosta-queijo-fresco-tomate', name: 'Tosta integral com queijo fresco e tomate', emoji: '🍅', tags: ['pequeno-almoço', 'vegetariano', 'rápido'], servings: 1, minutes: 8,
    ings: [
      { name: 'Pão integral', emoji: '🍞', per100: [247, 13, 41, 4.2], grams: 70 },
      { name: 'Queijo fresco', emoji: '🧀', per100: [98, 11, 3.4, 4.3], grams: 80 },
      { name: 'Tomate', emoji: '🍅', per100: [18, 0.9, 3.9, 0.2], grams: 80 },
      { name: 'Azeite', emoji: '🫒', unit: 'ml', per100: [884, 0, 0, 100], grams: 5 },
    ] },
  { id: 'batido-verde-proteico', name: 'Batido verde proteico', emoji: '🥤', tags: ['pequeno-almoço', 'proteico', 'rápido', 'vegetariano'], servings: 1, minutes: 5,
    ings: [
      { name: 'Espinafres', emoji: '🥬', per100: [23, 2.9, 3.6, 0.4], grams: 40 },
      { name: 'Banana', emoji: '🍌', per100: [89, 1.1, 23, 0.3], grams: 120 },
      { name: 'Proteína whey', emoji: '🥄', per100: [400, 80, 8, 6], grams: 30 },
      { name: 'Leite magro', emoji: '🥛', unit: 'ml', per100: [35, 3.4, 5, 0.1], grams: 250 },
    ] },
  { id: 'ovos-escalfados-espinafres', name: 'Ovos escalfados com espinafres', emoji: '🍳', tags: ['pequeno-almoço', 'proteico'], servings: 1, minutes: 12,
    ings: [
      { name: 'Ovo', emoji: '🥚', per100: [143, 13, 1.1, 9.5], grams: 110 },
      { name: 'Espinafres salteados', emoji: '🥬', per100: [35, 3, 3.8, 1.2], grams: 120 },
      { name: 'Pão integral', emoji: '🍞', per100: [247, 13, 41, 4.2], grams: 40 },
    ] },

  // ── Almoço ──────────────────────────────────────────────────────
  { id: 'frango-quinoa-legumes', name: 'Frango grelhado com quinoa e legumes', emoji: '🍗', tags: ['almoço', 'proteico'], servings: 1, minutes: 25,
    ings: [
      { name: 'Peito de frango grelhado', emoji: '🍗', per100: [165, 31, 0, 3.6], grams: 150 },
      { name: 'Quinoa cozida', emoji: '🍚', per100: [120, 4.4, 21, 1.9], grams: 150 },
      { name: 'Courgette salteada', emoji: '🥒', per100: [30, 1.2, 3.1, 1.8], grams: 120 },
      { name: 'Azeite', emoji: '🫒', unit: 'ml', per100: [884, 0, 0, 100], grams: 8 },
    ] },
  { id: 'massa-integral-frango-brocolos', name: 'Massa integral com frango e brócolos', emoji: '🍝', tags: ['almoço', 'proteico'], servings: 1, minutes: 20,
    ings: [
      { name: 'Massa integral cozida', emoji: '🍝', per100: [158, 6, 31, 0.9], grams: 180 },
      { name: 'Peito de frango grelhado', emoji: '🍗', per100: [165, 31, 0, 3.6], grams: 120 },
      { name: 'Brócolos cozidos', emoji: '🥦', per100: [35, 2.4, 7, 0.4], grams: 120 },
      { name: 'Azeite', emoji: '🫒', unit: 'ml', per100: [884, 0, 0, 100], grams: 6 },
    ] },
  { id: 'bowl-arroz-tofu-edamame', name: 'Bowl de arroz integral, tofu e edamame', emoji: '🍲', tags: ['almoço', 'vegetariano', 'proteico'], servings: 1, minutes: 20,
    ings: [
      { name: 'Arroz integral cozido', emoji: '🍚', per100: [123, 2.7, 25.6, 1], grams: 150 },
      { name: 'Tofu salteado', emoji: '🧈', per100: [120, 12, 3, 7], grams: 120 },
      { name: 'Edamame', emoji: '🫛', per100: [121, 12, 9, 5], grams: 80 },
      { name: 'Cenoura ralada', emoji: '🥕', per100: [41, 0.9, 10, 0.2], grams: 60 },
    ] },
  { id: 'salada-atum-feijao', name: 'Salada de atum com feijão frade', emoji: '🥗', tags: ['almoço', 'proteico', 'rápido'], servings: 1, minutes: 10,
    ings: [
      { name: 'Atum ao natural', emoji: '🐟', per100: [116, 26, 0, 1], grams: 120 },
      { name: 'Feijão frade cozido', emoji: '🫘', per100: [116, 8, 21, 0.5], grams: 130 },
      { name: 'Tomate', emoji: '🍅', per100: [18, 0.9, 3.9, 0.2], grams: 80 },
      { name: 'Azeite', emoji: '🫒', unit: 'ml', per100: [884, 0, 0, 100], grams: 8 },
    ] },

  // ── Jantar ──────────────────────────────────────────────────────
  { id: 'salmao-forno-courgette', name: 'Salmão no forno com courgette', emoji: '🐟', tags: ['jantar', 'proteico'], servings: 1, minutes: 25,
    ings: [
      { name: 'Salmão assado', emoji: '🐟', per100: [208, 20, 0, 13], grams: 140 },
      { name: 'Courgette assada', emoji: '🥒', per100: [30, 1.2, 3.1, 1.8], grams: 150 },
      { name: 'Batata cozida', emoji: '🥔', per100: [87, 2, 20, 0.1], grams: 150 },
      { name: 'Azeite', emoji: '🫒', unit: 'ml', per100: [884, 0, 0, 100], grams: 6 },
    ] },
  { id: 'omelete-claras-legumes', name: 'Omelete de claras com legumes', emoji: '🍳', tags: ['jantar', 'proteico', 'rápido', 'vegetariano'], servings: 1, minutes: 12,
    ings: [
      { name: 'Claras de ovo', emoji: '🥚', per100: [52, 11, 0.7, 0.2], grams: 200 },
      { name: 'Cogumelos salteados', emoji: '🍄', per100: [30, 3.1, 3.3, 1.2], grams: 100 },
      { name: 'Espinafres', emoji: '🥬', per100: [23, 2.9, 3.6, 0.4], grams: 60 },
      { name: 'Pão integral', emoji: '🍞', per100: [247, 13, 41, 4.2], grams: 40 },
    ] },
  { id: 'camarao-arroz-integral', name: 'Camarão salteado com arroz integral', emoji: '🍤', tags: ['jantar', 'proteico'], servings: 1, minutes: 20,
    ings: [
      { name: 'Camarão salteado', emoji: '🍤', per100: [99, 24, 0.2, 0.9], grams: 130 },
      { name: 'Arroz integral cozido', emoji: '🍚', per100: [123, 2.7, 25.6, 1], grams: 150 },
      { name: 'Pimento e cebola salteados', emoji: '🫑', per100: [45, 1.1, 6, 2], grams: 100 },
    ] },
  { id: 'almondegas-peru-esparguete', name: 'Almôndegas de peru com esparguete', emoji: '🍝', tags: ['jantar', 'proteico'], servings: 1, minutes: 25,
    ings: [
      { name: 'Almôndegas de peru', emoji: '🍖', per100: [150, 20, 3, 6], grams: 140 },
      { name: 'Esparguete cozido', emoji: '🍝', per100: [158, 6, 31, 0.9], grams: 170 },
      { name: 'Molho de tomate', emoji: '🍅', per100: [32, 1.6, 6, 0.3], grams: 100 },
    ] },

  // ── Snacks ──────────────────────────────────────────────────────
  { id: 'requeijao-mel-nozes', name: 'Requeijão com mel e nozes', emoji: '🍯', tags: ['snack', 'vegetariano', 'rápido'], servings: 1, minutes: 3,
    ings: [
      { name: 'Requeijão', emoji: '🧀', per100: [98, 11, 3.4, 4.3], grams: 120 },
      { name: 'Mel', emoji: '🍯', per100: [304, 0.3, 82, 0], grams: 12 },
      { name: 'Nozes', emoji: '🌰', per100: [654, 15, 14, 65], grams: 15 },
    ] },
  { id: 'batido-whey-banana', name: 'Batido de whey com banana', emoji: '🥤', tags: ['snack', 'proteico', 'rápido', 'vegetariano'], servings: 1, minutes: 3,
    ings: [
      { name: 'Proteína whey', emoji: '🥄', per100: [400, 80, 8, 6], grams: 30 },
      { name: 'Banana', emoji: '🍌', per100: [89, 1.1, 23, 0.3], grams: 120 },
      { name: 'Leite magro', emoji: '🥛', unit: 'ml', per100: [35, 3.4, 5, 0.1], grams: 250 },
    ] },
  { id: 'cenoura-hummus', name: 'Palitos de cenoura com hummus', emoji: '🥕', tags: ['snack', 'vegetariano', 'rápido'], servings: 1, minutes: 5,
    ings: [
      { name: 'Cenoura', emoji: '🥕', per100: [41, 0.9, 10, 0.2], grams: 120 },
      { name: 'Hummus', emoji: '🫓', per100: [177, 8, 20, 8], grams: 60 },
    ] },

  // ── Sopas e vegetariano ─────────────────────────────────────────
  { id: 'sopa-abobora-cenoura', name: 'Sopa de abóbora e cenoura', emoji: '🥣', tags: ['sopa', 'vegetariano'], servings: 1, minutes: 30,
    ings: [
      { name: 'Abóbora', emoji: '🎃', per100: [26, 1, 6.5, 0.1], grams: 200 },
      { name: 'Cenoura', emoji: '🥕', per100: [41, 0.9, 10, 0.2], grams: 100 },
      { name: 'Batata', emoji: '🥔', per100: [77, 2, 17, 0.1], grams: 80 },
      { name: 'Azeite', emoji: '🫒', unit: 'ml', per100: [884, 0, 0, 100], grams: 8 },
    ] },
  { id: 'caril-grao-espinafres', name: 'Caril de grão com espinafres', emoji: '🍛', tags: ['jantar', 'vegetariano', 'proteico'], servings: 1, minutes: 25,
    ings: [
      { name: 'Grão cozido', emoji: '🫘', per100: [164, 8.9, 27, 2.6], grams: 180 },
      { name: 'Espinafres', emoji: '🥬', per100: [23, 2.9, 3.6, 0.4], grams: 100 },
      { name: 'Leite de coco light', emoji: '🥥', unit: 'ml', per100: [73, 0.7, 3, 6.6], grams: 80 },
      { name: 'Arroz basmati cozido', emoji: '🍚', per100: [130, 2.7, 28, 0.3], grams: 120 },
    ] },
]

export const RECIPES_PT: LibraryRecipe[] = RAW.map((raw) => ({
  id: `lib-${raw.id}`,
  name: raw.name,
  emoji: raw.emoji,
  tags: raw.tags,
  servings: raw.servings,
  minutes: raw.minutes,
  items: raw.ings.map(buildItem),
}))

/** Todas as etiquetas presentes, para os chips de filtro (ordem estável). */
export const RECIPE_TAGS: string[] = (() => {
  const seen = new Set<string>()
  const order: string[] = []
  for (const r of RECIPES_PT) for (const t of r.tags) if (!seen.has(t)) { seen.add(t); order.push(t) }
  return order
})()
