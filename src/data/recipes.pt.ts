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

  // ── Lote 3 (2026-07-22): pequenos-almoços ───────────────────────
  { id: 'iogurte-mel-amendoas', name: 'Iogurte grego com mel e amêndoas', emoji: '🍯', tags: ['pequeno-almoço', 'vegetariano', 'rápido', 'proteico'], servings: 1, minutes: 3,
    ings: [['iogurte-grego', 170], ['mel', 15], ['amendoas', 15]] },
  { id: 'papas-aveia-cacau', name: 'Papas de aveia com cacau', emoji: '🍫', tags: ['pequeno-almoço', 'vegan', 'rápido'], servings: 1, minutes: 10,
    ings: [['aveia', 60], ['leite-aveia', 200], ['banana', 100], { name: 'Cacau em pó', emoji: '🍫', per100: [355, 20, 58, 14], grams: 8 }] },
  { id: 'tosta-requeijao-morango', name: 'Tosta de requeijão com morangos', emoji: '🍓', tags: ['pequeno-almoço', 'vegetariano', 'rápido'], servings: 1, minutes: 5,
    ings: [['pao-integral', 60], ['requeijao', 60], ['morangos', 80], ['mel', 8]] },
  { id: 'panquecas-whey', name: 'Panquecas de whey', emoji: '🥞', tags: ['pequeno-almoço', 'proteico'], servings: 1, minutes: 12,
    ings: [['whey', 30], ['ovo', 110], ['banana', 100], ['aveia', 40]] },
  { id: 'skyr-manga-granola', name: 'Skyr com manga e granola', emoji: '🥭', tags: ['pequeno-almoço', 'vegetariano', 'rápido', 'proteico'], servings: 1, minutes: 4,
    ings: [['skyr', 170], ['manga', 100], ['granola', 35]] },
  { id: 'ovos-fiambre-tosta', name: 'Ovos com fiambre de peru e tosta', emoji: '🍳', tags: ['pequeno-almoço', 'proteico', 'rápido'], servings: 1, minutes: 8,
    ings: [['ovo-mexido', 120], ['fiambre-peru', 40], ['pao-trigo', 50]] },
  { id: 'wrap-ovo-queijo', name: 'Wrap de ovo mexido e queijo', emoji: '🌯', tags: ['pequeno-almoço', 'proteico', 'rápido'], servings: 1, minutes: 8,
    ings: [['wrap', 60], ['ovo-mexido', 110], ['queijo-flamengo', 30]] },
  { id: 'overnight-oats-maca', name: 'Overnight oats de maçã e nozes', emoji: '🍎', tags: ['pequeno-almoço', 'vegetariano'], servings: 1, minutes: 5,
    ings: [['aveia', 55], ['leite-mg', 180], ['maca', 120], ['nozes', 12]] },
  { id: 'kefir-frutos-muesli', name: 'Kefir com frutos vermelhos e muesli', emoji: '🫐', tags: ['pequeno-almoço', 'vegetariano', 'rápido'], servings: 1, minutes: 3,
    ings: [['kefir', 200], ['mirtilos', 60], ['framboesas', 50], ['muesli', 40]] },
  { id: 'tosta-pb-banana', name: 'Tosta de manteiga de amendoim e banana', emoji: '🥜', tags: ['pequeno-almoço', 'vegetariano', 'rápido'], servings: 1, minutes: 5,
    ings: [['pao-integral', 60], ['manteiga-amendoim', 20], ['banana', 100]] },
  { id: 'omelete-queijo-tomate', name: 'Omelete de queijo e tomate', emoji: '🍳', tags: ['pequeno-almoço', 'proteico', 'rápido'], servings: 1, minutes: 10,
    ings: [['ovo', 165], ['queijo-mozzarella', 40], ['tomate', 80], ['azeite', 5]] },
  { id: 'taca-cereais-morango', name: 'Taça de flocos de milho com morangos', emoji: '🥣', tags: ['pequeno-almoço', 'vegetariano', 'rápido'], servings: 1, minutes: 3,
    ings: [['flocos-milho', 45], ['leite-magro', 200], ['morangos', 80]] },
  { id: 'tortitas-queijo-mel', name: 'Tortitas de arroz com queijo fresco e mel', emoji: '🍚', tags: ['pequeno-almoço', 'vegetariano', 'rápido'], servings: 1, minutes: 4,
    ings: [['tortitas-arroz', 30], ['queijo-fresco', 80], ['mel', 10]] },
  { id: 'broa-ovo-mexido', name: 'Broa de milho com ovo mexido', emoji: '🌽', tags: ['pequeno-almoço', 'proteico'], servings: 1, minutes: 8,
    ings: [['broa-milho', 60], ['ovo-mexido', 120]] },
  { id: 'batido-aveia-pessego', name: 'Batido de aveia e pêssego', emoji: '🍑', tags: ['pequeno-almoço', 'batido', 'proteico', 'rápido'], servings: 1, minutes: 4,
    ings: [['aveia', 35], ['leite-magro', 250], ['pessego', 120], ['whey', 25]] },

  // ── Lote 3: frango e peru ───────────────────────────────────────
  { id: 'frango-batata-doce-salada', name: 'Frango grelhado, batata-doce e salada', emoji: '🍗', tags: ['almoço', 'jantar', 'proteico'], servings: 1, minutes: 25,
    ings: [['frango-peito', 160], ['batata-doce', 200], ['alface', 60], ['tomate', 80], ['azeite', 8]] },
  { id: 'frango-pure-feijao-verde', name: 'Frango com puré e feijão-verde', emoji: '🍗', tags: ['almoço', 'jantar', 'proteico'], servings: 1, minutes: 25,
    ings: [['frango-peito', 150], ['puree-batata', 180], ['feijao-verde', 120]] },
  { id: 'strogonoff-frango-light', name: 'Strogonoff de frango light', emoji: '🍄', tags: ['jantar', 'proteico'], servings: 1, minutes: 25,
    ings: [['frango-peito', 150], ['cogumelos', 100], { name: 'Natas light', emoji: '🥛', unit: 'ml', per100: [160, 2.5, 4, 15], grams: 50 }, ['arroz-cozido', 150]] },
  { id: 'frango-caril-arroz', name: 'Caril de frango com arroz', emoji: '🍛', tags: ['jantar', 'proteico'], servings: 1, minutes: 25,
    ings: [['frango-peito', 150], ['arroz-cozido', 160], { name: 'Leite de coco light', emoji: '🥥', unit: 'ml', per100: [73, 0.7, 3, 6.6], grams: 80 }, ['cebola', 50]] },
  { id: 'espetadas-frango-cuscuz', name: 'Espetadas de frango com cuscuz', emoji: '🍢', tags: ['almoço', 'jantar', 'proteico'], servings: 1, minutes: 20,
    ings: [['frango-peito', 160], ['pimento', 80], ['cebola', 50], ['cuscuz', 150]] },
  { id: 'peru-arroz-integral-brocolos', name: 'Peru com arroz integral e brócolos', emoji: '🦃', tags: ['almoço', 'proteico', 'marmita'], servings: 1, minutes: 25,
    ings: [['peru-peito', 160], ['arroz-integral', 160], ['brocolos', 120], ['azeite', 6]] },
  { id: 'frango-coxa-forno-batata', name: 'Coxas de frango no forno com batata', emoji: '🍗', tags: ['jantar'], servings: 2, minutes: 50,
    ings: [['frango-coxa', 300], ['batata', 350], ['cebola', 80], ['azeite', 15]] },
  { id: 'salada-cesar-light', name: 'Salada César light', emoji: '🥗', tags: ['almoço', 'salada', 'proteico'], servings: 1, minutes: 15,
    ings: [['alface', 80], ['frango-peito', 130], ['queijo-curado', 20], ['pao-trigo', 30], { name: 'Molho César light', emoji: '🥫', per100: [230, 2, 6, 22], grams: 25 }] },
  { id: 'wrap-peru-abacate', name: 'Wrap de peru e abacate', emoji: '🌯', tags: ['almoço', 'rápido', 'proteico'], servings: 1, minutes: 8,
    ings: [['wrap', 60], ['fiambre-peru', 60], ['abacate', 50], ['alface', 30], ['tomate', 50]] },
  { id: 'massa-frango-pesto', name: 'Massa com frango e pesto', emoji: '🍝', tags: ['almoço', 'jantar'], servings: 1, minutes: 20,
    ings: [['massa-cozida', 180], ['frango-peito', 130], { name: 'Pesto', emoji: '🌿', per100: [460, 5, 6, 47], grams: 20 }] },
  { id: 'marmita-arroz-frango-ervilhas', name: 'Marmita de arroz, frango e ervilhas', emoji: '🍱', tags: ['almoço', 'marmita', 'proteico'], servings: 1, minutes: 20,
    ings: [['arroz-cozido', 180], ['frango-peito', 140], ['ervilhas', 80], ['cenoura', 50]] },
  { id: 'hamburguer-peru-batata-doce', name: 'Hambúrguer de peru com batata-doce', emoji: '🍔', tags: ['jantar', 'proteico'], servings: 1, minutes: 25,
    ings: [{ name: 'Hambúrguer de peru', emoji: '🍖', per100: [150, 20, 3, 6], grams: 150 }, ['batata-doce', 180], ['alface', 40], ['tomate', 50]] },

  // ── Lote 3: peixe e marisco ─────────────────────────────────────
  { id: 'salmao-quinoa-espargos', name: 'Salmão com quinoa e espargos', emoji: '🐟', tags: ['jantar', 'peixe', 'proteico'], servings: 1, minutes: 25,
    ings: [['salmao', 140], ['quinoa', 150], { name: 'Espargos', emoji: '🌿', per100: [20, 2.2, 3.9, 0.1], grams: 100 }] },
  { id: 'pescada-batata-feijao-verde', name: 'Pescada cozida com batata e feijão-verde', emoji: '🐟', tags: ['jantar', 'peixe'], servings: 1, minutes: 25,
    ings: [['pescada', 180], ['batata', 200], ['feijao-verde', 100], ['azeite', 10]] },
  { id: 'bacalhau-bras-light', name: 'Bacalhau à Brás light', emoji: '🐟', tags: ['jantar', 'peixe'], servings: 2, minutes: 30,
    ings: [['bacalhau', 250], ['ovo', 220], ['batatas-fritas', 80], ['cebola', 100], ['azeite', 15]] },
  { id: 'atum-arroz-salada', name: 'Atum com arroz e salada', emoji: '🐟', tags: ['almoço', 'peixe', 'rápido', 'marmita'], servings: 1, minutes: 12,
    ings: [['atum-agua', 120], ['arroz-cozido', 170], ['alface', 50], ['tomate', 80], ['azeite', 8]] },
  { id: 'lulas-grelhadas-batata', name: 'Lulas grelhadas com batata cozida', emoji: '🦑', tags: ['jantar', 'peixe'], servings: 1, minutes: 25,
    ings: [{ name: 'Lulas', emoji: '🦑', per100: [92, 15.6, 3, 1.4], grams: 180 }, ['batata', 200], ['azeite', 10], ['alho', 5]] },
  { id: 'camarao-alho-esparguete', name: 'Esparguete com camarão e alho', emoji: '🍤', tags: ['jantar', 'peixe'], servings: 1, minutes: 20,
    ings: [['massa-cozida', 180], ['camarao', 130], ['alho', 8], ['azeite', 10]] },
  { id: 'dourada-forno-legumes', name: 'Dourada no forno com legumes', emoji: '🐟', tags: ['jantar', 'peixe'], servings: 1, minutes: 35,
    ings: [['dourada', 180], ['batata', 150], ['pimento', 60], ['cebola', 60], ['azeite', 10]] },
  { id: 'sardinha-broa-salada', name: 'Sardinhas com broa e salada', emoji: '🐟', tags: ['almoço', 'peixe'], servings: 1, minutes: 20,
    ings: [['sardinha', 120], ['broa-milho', 60], ['tomate', 100], ['pimento', 60]] },
  { id: 'tosta-salmao-fumado', name: 'Tosta de salmão fumado e queijo fresco', emoji: '🥯', tags: ['pequeno-almoço', 'snack', 'peixe', 'rápido'], servings: 1, minutes: 6,
    ings: [['pao-centeio', 60], { name: 'Salmão fumado', emoji: '🐟', per100: [117, 18, 0, 4.5], grams: 50 }, ['queijo-fresco', 50]] },
  { id: 'caldeirada-pescada-light', name: 'Caldeirada de pescada light', emoji: '🍲', tags: ['jantar', 'peixe'], servings: 2, minutes: 40,
    ings: [['pescada', 300], ['batata', 300], ['tomate', 200], ['cebola', 100], ['pimento', 80], ['azeite', 15]] },
  { id: 'bowl-atum-batata-doce', name: 'Bowl de atum e batata-doce', emoji: '🥣', tags: ['almoço', 'peixe', 'marmita', 'proteico'], servings: 1, minutes: 20,
    ings: [['atum-agua', 120], ['batata-doce', 180], ['milho-cozido', 60], ['alface', 40]] },
  { id: 'polvo-lagareiro-light', name: 'Polvo à lagareiro light', emoji: '🐙', tags: ['jantar', 'peixe'], servings: 1, minutes: 40,
    ings: [['polvo', 180], ['batata', 200], ['azeite', 15], ['alho', 8]] },
  { id: 'wrap-atum-milho', name: 'Wrap de atum e milho', emoji: '🌯', tags: ['almoço', 'peixe', 'rápido'], servings: 1, minutes: 6,
    ings: [['wrap', 60], ['atum-agua', 100], ['milho-cozido', 50], ['alface', 30], ['maionese', 10]] },
  { id: 'salada-camarao-abacate', name: 'Salada de camarão e abacate', emoji: '🥗', tags: ['almoço', 'salada', 'peixe', 'proteico'], servings: 1, minutes: 12,
    ings: [['camarao', 130], ['abacate', 70], ['alface', 60], ['tomate', 80], ['azeite', 8]] },

  // ── Lote 3: carne ───────────────────────────────────────────────
  { id: 'lombo-porco-arroz', name: 'Lombo de porco grelhado com arroz', emoji: '🥩', tags: ['almoço', 'jantar', 'proteico'], servings: 1, minutes: 20,
    ings: [['porco-lombo', 150], ['arroz-cozido', 170], ['grelos', 100], ['azeite', 8]] },
  { id: 'vaca-salteada-legumes', name: 'Tiras de vaca salteadas com legumes', emoji: '🥩', tags: ['jantar', 'proteico'], servings: 1, minutes: 18,
    ings: [['vaca-magra', 150], ['pimento', 80], ['cenoura', 60], ['molho-soja', 15], ['arroz-cozido', 150]] },
  { id: 'rolo-carne-pure', name: 'Rolo de carne com puré', emoji: '🍖', tags: ['jantar'], servings: 4, minutes: 60,
    ings: [['vaca-magra', 500], ['ovo', 110], ['pao-trigo', 60], ['cebola', 100], ['puree-batata', 500]] },
  { id: 'bitoque-light', name: 'Bitoque light', emoji: '🍳', tags: ['almoço', 'jantar', 'proteico'], servings: 1, minutes: 20,
    ings: [['vaca-magra', 150], ['ovo', 55], ['arroz-cozido', 150], ['alface', 40], ['tomate', 60]] },
  { id: 'lombo-forno-batata-doce', name: 'Lombo no forno com batata-doce', emoji: '🍖', tags: ['jantar'], servings: 2, minutes: 50,
    ings: [['porco-lombo', 300], ['batata-doce', 350], ['cebola', 80], ['azeite', 15]] },
  { id: 'chili-carne-feijao', name: 'Chili de carne com feijão', emoji: '🌶️', tags: ['jantar', 'proteico', 'marmita'], servings: 2, minutes: 35,
    ings: [['vaca-magra', 250], ['feijao-preto', 200], ['tomate', 200], ['cebola', 80], ['arroz-cozido', 250]] },
  { id: 'esparguete-bolonhesa-light', name: 'Esparguete à bolonhesa light', emoji: '🍝', tags: ['jantar'], servings: 2, minutes: 30,
    ings: [['massa-cozida', 320], ['vaca-magra', 220], { name: 'Molho de tomate', emoji: '🍅', per100: [32, 1.6, 6, 0.3], grams: 180 }, ['cebola', 60]] },
  { id: 'tacos-carne-picada', name: 'Tacos de carne picada', emoji: '🌮', tags: ['jantar'], servings: 1, minutes: 20,
    ings: [['wrap', 60], ['vaca-magra', 120], ['tomate', 60], ['alface', 30], ['queijo-flamengo', 25]] },

  // ── Lote 3: vegetariano e vegan ─────────────────────────────────
  { id: 'tofu-caril-arroz', name: 'Caril de tofu com arroz', emoji: '🍛', tags: ['jantar', 'vegan', 'proteico'], servings: 1, minutes: 22,
    ings: [['tofu', 150], ['arroz-cozido', 160], { name: 'Leite de coco light', emoji: '🥥', unit: 'ml', per100: [73, 0.7, 3, 6.6], grams: 80 }, ['ervilhas', 60]] },
  { id: 'lentilhas-estufadas-arroz', name: 'Lentilhas estufadas com arroz', emoji: '🫘', tags: ['jantar', 'vegan', 'proteico', 'marmita'], servings: 1, minutes: 25,
    ings: [['lentilhas', 180], ['arroz-cozido', 140], ['cenoura', 60], ['cebola', 50], ['azeite', 8]] },
  { id: 'hamburguer-grao-caseiro', name: 'Hambúrguer de grão caseiro', emoji: '🍔', tags: ['jantar', 'vegetariano', 'proteico'], servings: 2, minutes: 30,
    ings: [['grao', 240], ['aveia', 40], ['ovo', 55], ['cebola', 60], ['pao-integral', 120]] },
  { id: 'bolonhesa-soja', name: 'Bolonhesa de soja', emoji: '🍝', tags: ['jantar', 'vegan', 'proteico'], servings: 2, minutes: 25,
    ings: [['soja-texturizada', 80], ['massa-cozida', 320], { name: 'Molho de tomate', emoji: '🍅', per100: [32, 1.6, 6, 0.3], grams: 200 }, ['cebola', 60]] },
  { id: 'tofu-mexido-tosta', name: 'Tofu mexido na tosta', emoji: '🍞', tags: ['pequeno-almoço', 'vegan', 'proteico', 'rápido'], servings: 1, minutes: 10,
    ings: [['tofu', 120], ['pao-integral', 60], ['tomate', 60], ['azeite', 6]] },
  { id: 'bowl-quinoa-abacate', name: 'Bowl de quinoa, legumes e abacate', emoji: '🥣', tags: ['almoço', 'vegan', 'marmita'], servings: 1, minutes: 20,
    ings: [['quinoa', 160], ['abacate', 60], ['tomate', 80], ['milho-cozido', 60], ['espinafres', 40]] },
  { id: 'massa-legumes-mozzarella', name: 'Massa com legumes e mozzarella', emoji: '🍝', tags: ['jantar', 'vegetariano'], servings: 1, minutes: 20,
    ings: [['massa-cozida', 180], ['abobrinha', 100], ['tomate', 100], ['queijo-mozzarella', 50], ['azeite', 8]] },
  { id: 'arroz-feijao-ovo', name: 'Arroz de feijão com ovo estrelado', emoji: '🍳', tags: ['almoço', 'vegetariano'], servings: 1, minutes: 18,
    ings: [['arroz-feijao', 250], ['ovo', 55], ['azeite', 5]] },
  { id: 'seitan-pimento-arroz', name: 'Seitan salteado com pimento e arroz', emoji: '🥘', tags: ['jantar', 'vegan', 'proteico'], servings: 1, minutes: 18,
    ings: [['seitan', 130], ['pimento', 80], ['arroz-integral', 160], ['molho-soja', 12]] },
  { id: 'couve-flor-gratinada', name: 'Couve-flor gratinada', emoji: '🥦', tags: ['jantar', 'vegetariano'], servings: 2, minutes: 35,
    ings: [['couve-flor', 400], ['queijo-flamengo', 60], ['leite-mg', 150], ['manteiga', 10]] },
  { id: 'ervilhas-ovos-escalfados', name: 'Ervilhas com ovos escalfados', emoji: '🍳', tags: ['jantar', 'vegetariano', 'proteico'], servings: 1, minutes: 20,
    ings: [['ervilhas', 180], ['ovo', 110], ['cebola', 50], ['azeite', 8]] },
  { id: 'salada-lentilhas-queijo', name: 'Salada de lentilhas com queijo fresco', emoji: '🥗', tags: ['almoço', 'salada', 'vegetariano', 'proteico'], servings: 1, minutes: 12,
    ings: [['lentilhas', 160], ['queijo-fresco', 80], ['tomate', 80], ['cebola', 30], ['azeite', 8]] },
  { id: 'tofu-agridoce-ananas', name: 'Tofu agridoce com ananás', emoji: '🍍', tags: ['jantar', 'vegan'], servings: 1, minutes: 20,
    ings: [['tofu', 140], ['ananas', 100], ['pimento', 70], ['arroz-cozido', 150], ['molho-soja', 12]] },
  { id: 'wrap-hummus-legumes', name: 'Wrap de hummus e legumes', emoji: '🌯', tags: ['almoço', 'vegan', 'rápido'], servings: 1, minutes: 6,
    ings: [['wrap', 60], { name: 'Hummus', emoji: '🫓', per100: [177, 8, 20, 8], grams: 50 }, ['cenoura', 50], ['alface', 30], ['pimento', 40]] },

  // ── Lote 3: massas, arroz e bowls ───────────────────────────────
  { id: 'massa-atum-tomate', name: 'Massa com atum e tomate', emoji: '🍝', tags: ['almoço', 'peixe', 'rápido', 'marmita'], servings: 1, minutes: 15,
    ings: [['massa-cozida', 180], ['atum-agua', 100], ['tomate', 120], ['cebola', 40], ['azeite', 8]] },
  { id: 'massa-camarao-courgette', name: 'Massa com camarão e courgette', emoji: '🍤', tags: ['jantar', 'peixe'], servings: 1, minutes: 20,
    ings: [['massa-cozida', 170], ['camarao', 120], ['abobrinha', 120], ['alho', 6], ['azeite', 10]] },
  { id: 'poke-salmao-light', name: 'Poke de salmão light', emoji: '🍣', tags: ['almoço', 'peixe', 'proteico'], servings: 1, minutes: 15,
    ings: [['salmao', 120], ['arroz-cozido', 160], ['abacate', 50], ['cenoura', 40], ['molho-soja', 12]] },
  { id: 'massa-cottage-espinafres', name: 'Massa cremosa de cottage e espinafres', emoji: '🍝', tags: ['jantar', 'vegetariano', 'proteico'], servings: 1, minutes: 15,
    ings: [['massa-cozida', 180], ['queijo-cottage', 120], ['espinafres', 80], ['alho', 5]] },
  { id: 'risotto-cogumelos-light', name: 'Risotto de cogumelos light', emoji: '🍄', tags: ['jantar', 'vegetariano'], servings: 1, minutes: 30,
    ings: [['arroz-cozido', 200], ['cogumelos', 150], ['queijo-curado', 20], ['cebola', 50], ['azeite', 10]] },
  { id: 'noodles-ovo-legumes', name: 'Noodles caseiros com ovo e legumes', emoji: '🍜', tags: ['jantar', 'vegetariano', 'rápido'], servings: 1, minutes: 15,
    ings: [['massa-cozida', 180], ['ovo', 55], ['cenoura', 50], ['molho-soja', 15], ['azeite', 6]] },

  // ── Lote 3: saladas ─────────────────────────────────────────────
  { id: 'salada-quinoa-manga-frango', name: 'Salada de quinoa, manga e frango', emoji: '🥗', tags: ['almoço', 'salada', 'proteico'], servings: 1, minutes: 18,
    ings: [['quinoa', 140], ['frango-peito', 110], ['manga', 80], ['espinafres', 40], ['azeite', 8]] },
  { id: 'salada-caprese-light', name: 'Salada caprese light', emoji: '🍅', tags: ['almoço', 'salada', 'vegetariano', 'rápido'], servings: 1, minutes: 8,
    ings: [['tomate', 180], ['queijo-mozzarella', 80], ['azeite', 10]] },
  { id: 'salada-ovo-batata', name: 'Salada de ovo, batata e feijão-verde', emoji: '🥗', tags: ['almoço', 'salada', 'vegetariano'], servings: 1, minutes: 20,
    ings: [['ovo', 110], ['batata', 180], ['feijao-verde', 100], ['azeite', 10]] },
  { id: 'salada-massa-atum', name: 'Salada de massa com atum e milho', emoji: '🥗', tags: ['almoço', 'salada', 'peixe', 'marmita'], servings: 1, minutes: 15,
    ings: [['massa-cozida', 160], ['atum-agua', 100], ['milho-cozido', 60], ['tomate', 70], ['maionese', 12]] },
  { id: 'salada-frango-uvas-nozes', name: 'Salada de frango, uvas e nozes', emoji: '🥗', tags: ['almoço', 'salada', 'proteico'], servings: 1, minutes: 12,
    ings: [['frango-peito', 120], ['uvas', 80], ['nozes', 15], ['alface', 60], ['iogurte-natural', 50]] },
  { id: 'salada-feta-melancia', name: 'Salada de melancia e queijo feta', emoji: '🍉', tags: ['salada', 'vegetariano', 'rápido'], servings: 1, minutes: 6,
    ings: [['melancia', 250], { name: 'Queijo feta', emoji: '🧀', per100: [264, 14, 4, 21], grams: 50 }] },
  { id: 'salada-espinafres-morango', name: 'Salada de espinafres, morango e queijo', emoji: '🥗', tags: ['salada', 'vegetariano', 'rápido'], servings: 1, minutes: 8,
    ings: [['espinafres', 70], ['morangos', 100], ['queijo-fresco', 60], ['nozes', 12], ['azeite', 6]] },
  { id: 'tabule-cuscuz', name: 'Tabule de cuscuz com legumes', emoji: '🥗', tags: ['almoço', 'salada', 'vegan', 'marmita'], servings: 1, minutes: 15,
    ings: [['cuscuz', 160], ['tomate', 100], ['pimento', 60], ['cebola', 30], ['azeite', 10]] },

  // ── Lote 3: sopas ───────────────────────────────────────────────
  { id: 'sopa-lentilhas', name: 'Sopa de lentilhas', emoji: '🥣', tags: ['sopa', 'vegan', 'proteico'], servings: 4, minutes: 35,
    ings: [['lentilhas', 300], ['cenoura', 150], ['cebola', 100], ['batata', 150], ['azeite', 20]] },
  { id: 'sopa-grao-espinafres', name: 'Sopa de grão com espinafres', emoji: '🥣', tags: ['sopa', 'vegan'], servings: 4, minutes: 35,
    ings: [['grao', 300], ['espinafres', 150], ['batata', 200], ['cebola', 80], ['azeite', 20]] },
  { id: 'creme-cenoura', name: 'Creme de cenoura', emoji: '🥕', tags: ['sopa', 'vegan'], servings: 4, minutes: 30,
    ings: [['cenoura', 500], ['batata', 200], ['cebola', 80], ['azeite', 20]] },
  { id: 'sopa-peixe', name: 'Sopa de peixe', emoji: '🐟', tags: ['sopa', 'peixe'], servings: 4, minutes: 40,
    ings: [['pescada', 300], ['batata', 250], ['tomate', 150], ['arroz-cozido', 150], ['azeite', 20]] },
  { id: 'canja-galinha', name: 'Canja de galinha', emoji: '🍲', tags: ['sopa', 'proteico'], servings: 4, minutes: 40,
    ings: [['frango-peito', 250], ['arroz-cozido', 200], ['cenoura', 100], ['cebola', 60]] },
  { id: 'sopa-feijao-verde', name: 'Sopa de feijão-verde', emoji: '🥣', tags: ['sopa', 'vegan'], servings: 4, minutes: 30,
    ings: [['feijao-verde', 250], ['batata', 300], ['cenoura', 100], ['cebola', 60], ['azeite', 20]] },
  { id: 'creme-couve-flor', name: 'Creme de couve-flor', emoji: '🥦', tags: ['sopa', 'vegetariano'], servings: 4, minutes: 30,
    ings: [['couve-flor', 500], ['batata', 200], ['leite-mg', 150], ['azeite', 15]] },

  // ── Lote 3: snacks e batidos ────────────────────────────────────
  { id: 'batido-morango-skyr', name: 'Batido de morango e skyr', emoji: '🍓', tags: ['snack', 'batido', 'proteico', 'rápido'], servings: 1, minutes: 3,
    ings: [['skyr', 150], ['morangos', 120], ['leite-magro', 150]] },
  { id: 'batido-manga-iogurte', name: 'Batido de manga e iogurte', emoji: '🥭', tags: ['snack', 'batido', 'vegetariano', 'rápido'], servings: 1, minutes: 3,
    ings: [['iogurte-natural', 150], ['manga', 120], ['leite-magro', 100]] },
  { id: 'batido-cacau-amendoim', name: 'Batido de cacau e manteiga de amendoim', emoji: '🍫', tags: ['snack', 'batido', 'proteico'], servings: 1, minutes: 4,
    ings: [['leite-mg', 250], ['whey', 25], { name: 'Cacau em pó', emoji: '🍫', per100: [355, 20, 58, 14], grams: 8 }, ['manteiga-amendoim', 15]] },
  { id: 'tosta-cottage-tomate', name: 'Tosta de cottage e tomate', emoji: '🍞', tags: ['snack', 'vegetariano', 'proteico', 'rápido'], servings: 1, minutes: 5,
    ings: [['pao-centeio', 50], ['queijo-cottage', 100], ['tomate', 60]] },
  { id: 'ovo-cozido-tostas', name: 'Ovo cozido com tostas', emoji: '🥚', tags: ['snack', 'proteico', 'rápido'], servings: 1, minutes: 10,
    ings: [['ovo', 110], ['tostas', 25]] },
  { id: 'mix-frutos-secos-chocolate', name: 'Mix de frutos secos e chocolate negro', emoji: '🌰', tags: ['snack', 'vegetariano', 'rápido'], servings: 1, minutes: 2,
    ings: [['amendoas', 15], ['nozes', 15], ['chocolate-negro', 15]] },
  { id: 'maca-manteiga-amendoim', name: 'Maçã com manteiga de amendoim', emoji: '🍎', tags: ['snack', 'vegetariano', 'rápido'], servings: 1, minutes: 3,
    ings: [['maca', 150], ['manteiga-amendoim', 20]] },
  { id: 'iogurte-granola-kiwi', name: 'Iogurte natural com granola e kiwi', emoji: '🥝', tags: ['snack', 'vegetariano', 'rápido'], servings: 1, minutes: 4,
    ings: [['iogurte-natural', 150], ['granola', 30], ['kiwi', 75]] },
  { id: 'queijo-presunto-tostas', name: 'Queijo fresco com presunto e tostas', emoji: '🧀', tags: ['snack', 'proteico', 'rápido'], servings: 1, minutes: 4,
    ings: [['queijo-fresco', 80], ['presunto', 30], ['tostas', 25]] },
  { id: 'pipocas-caseiras', name: 'Pipocas caseiras', emoji: '🍿', tags: ['snack', 'vegan', 'rápido'], servings: 1, minutes: 8,
    ings: [['milho-pipoca', 30], ['azeite', 5]] },
  { id: 'batata-doce-assada-snack', name: 'Batata-doce assada com canela', emoji: '🍠', tags: ['snack', 'vegan'], servings: 1, minutes: 35,
    ings: [['batata-doce', 200]] },
  { id: 'panquecas-banana-2ing', name: 'Panquecas de banana e ovo (2 ingredientes)', emoji: '🥞', tags: ['snack', 'pequeno-almoço', 'vegetariano', 'rápido'], servings: 1, minutes: 10,
    ings: [['banana', 120], ['ovo', 110]] },

  // ── Lote 3: sobremesas fit ──────────────────────────────────────
  { id: 'mousse-chocolate-abacate', name: 'Mousse de chocolate e abacate', emoji: '🍫', tags: ['sobremesa', 'vegan'], servings: 2, minutes: 10,
    ings: [['abacate', 150], { name: 'Cacau em pó', emoji: '🍫', per100: [355, 20, 58, 14], grams: 20 }, ['mel', 25]] },
  { id: 'nice-cream-banana-morango', name: 'Gelado de banana e morango (nice cream)', emoji: '🍨', tags: ['sobremesa', 'vegan', 'rápido'], servings: 1, minutes: 5,
    ings: [['banana', 120], ['morangos', 100]] },
  { id: 'iogurte-gelado-frutos', name: 'Iogurte gelado com frutos vermelhos', emoji: '🍧', tags: ['sobremesa', 'vegetariano'], servings: 1, minutes: 5,
    ings: [['iogurte-grego', 150], ['mirtilos', 60], ['mel', 10]] },
  { id: 'bolo-caneca-aveia', name: 'Bolo de caneca de aveia e cacau', emoji: '☕', tags: ['sobremesa', 'vegetariano', 'rápido'], servings: 1, minutes: 5,
    ings: [['aveia', 40], ['ovo', 55], { name: 'Cacau em pó', emoji: '🍫', per100: [355, 20, 58, 14], grams: 8 }, ['mel', 15]] },
  { id: 'arroz-doce-light', name: 'Arroz doce light', emoji: '🍚', tags: ['sobremesa', 'vegetariano'], servings: 2, minutes: 30,
    ings: [['arroz-cozido', 250], ['leite-mg', 300], ['mel', 25]] },
  { id: 'pudim-chia-manga', name: 'Pudim de chia com manga', emoji: '🥭', tags: ['sobremesa', 'vegan'], servings: 1, minutes: 5,
    ings: [{ name: 'Sementes de chia', emoji: '🌱', per100: [486, 17, 42, 31], grams: 25 }, ['leite-amendoa', 200], ['manga', 100]] },
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
