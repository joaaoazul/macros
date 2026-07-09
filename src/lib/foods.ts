import type { Food } from '../types'

/** Base de dados de alimentos comuns em Portugal — valores por 100 g/ml. */
export const FOOD_DB: Food[] = [
  // Proteínas
  { id: 'frango-peito', name: 'Peito de frango grelhado', emoji: '🍗', kcal: 165, protein: 31, carbs: 0, fat: 3.6, unit: 'g' },
  { id: 'peru-peito', name: 'Peito de peru', emoji: '🦃', kcal: 135, protein: 29, carbs: 0, fat: 1.7, unit: 'g' },
  { id: 'ovo', name: 'Ovo cozido', emoji: '🥚', kcal: 155, protein: 13, carbs: 1.1, fat: 11, unit: 'g' },
  { id: 'clara-ovo', name: 'Clara de ovo', emoji: '🥚', kcal: 52, protein: 11, carbs: 0.7, fat: 0.2, unit: 'g' },
  { id: 'atum-agua', name: 'Atum em água', emoji: '🐟', kcal: 116, protein: 26, carbs: 0, fat: 1, unit: 'g' },
  { id: 'salmao', name: 'Salmão grelhado', emoji: '🐟', kcal: 208, protein: 20, carbs: 0, fat: 13, unit: 'g' },
  { id: 'bacalhau', name: 'Bacalhau cozido', emoji: '🐟', kcal: 105, protein: 23, carbs: 0, fat: 0.9, unit: 'g' },
  { id: 'pescada', name: 'Pescada cozida', emoji: '🐟', kcal: 90, protein: 19, carbs: 0, fat: 1.3, unit: 'g' },
  { id: 'vaca-magra', name: 'Bife de vaca magro', emoji: '🥩', kcal: 187, protein: 28, carbs: 0, fat: 8, unit: 'g' },
  { id: 'porco-lombo', name: 'Lombo de porco', emoji: '🥩', kcal: 172, protein: 27, carbs: 0, fat: 6.6, unit: 'g' },
  { id: 'whey', name: 'Whey (proteína em pó)', emoji: '🥤', kcal: 380, protein: 78, carbs: 8, fat: 5, unit: 'g' },
  { id: 'tofu', name: 'Tofu', emoji: '🧊', kcal: 76, protein: 8, carbs: 1.9, fat: 4.8, unit: 'g' },
  { id: 'camarao', name: 'Camarão cozido', emoji: '🦐', kcal: 99, protein: 24, carbs: 0.2, fat: 0.3, unit: 'g' },

  // Hidratos
  { id: 'arroz-cozido', name: 'Arroz branco cozido', emoji: '🍚', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, unit: 'g' },
  { id: 'arroz-integral', name: 'Arroz integral cozido', emoji: '🍚', kcal: 111, protein: 2.6, carbs: 23, fat: 0.9, unit: 'g' },
  { id: 'massa-cozida', name: 'Massa cozida', emoji: '🍝', kcal: 131, protein: 5, carbs: 25, fat: 1.1, unit: 'g' },
  { id: 'batata', name: 'Batata cozida', emoji: '🥔', kcal: 87, protein: 1.9, carbs: 20, fat: 0.1, unit: 'g' },
  { id: 'batata-doce', name: 'Batata-doce assada', emoji: '🍠', kcal: 90, protein: 2, carbs: 21, fat: 0.1, unit: 'g' },
  { id: 'pao-trigo', name: 'Pão de trigo', emoji: '🍞', kcal: 265, protein: 9, carbs: 49, fat: 3.2, unit: 'g' },
  { id: 'pao-integral', name: 'Pão integral', emoji: '🍞', kcal: 247, protein: 13, carbs: 41, fat: 3.4, unit: 'g' },
  { id: 'aveia', name: 'Flocos de aveia', emoji: '🥣', kcal: 389, protein: 17, carbs: 66, fat: 7, unit: 'g' },
  { id: 'quinoa', name: 'Quinoa cozida', emoji: '🌾', kcal: 120, protein: 4.4, carbs: 21, fat: 1.9, unit: 'g' },
  { id: 'cuscuz', name: 'Cuscuz cozido', emoji: '🌾', kcal: 112, protein: 3.8, carbs: 23, fat: 0.2, unit: 'g' },
  { id: 'tortitas-arroz', name: 'Tortitas de arroz', emoji: '🍘', kcal: 387, protein: 8, carbs: 82, fat: 2.8, unit: 'g' },

  // Leguminosas
  { id: 'feijao-preto', name: 'Feijão preto cozido', emoji: '🫘', kcal: 132, protein: 8.9, carbs: 24, fat: 0.5, unit: 'g' },
  { id: 'grao', name: 'Grão-de-bico cozido', emoji: '🫘', kcal: 164, protein: 8.9, carbs: 27, fat: 2.6, unit: 'g' },
  { id: 'lentilhas', name: 'Lentilhas cozidas', emoji: '🫘', kcal: 116, protein: 9, carbs: 20, fat: 0.4, unit: 'g' },
  { id: 'ervilhas', name: 'Ervilhas cozidas', emoji: '🟢', kcal: 84, protein: 5.4, carbs: 16, fat: 0.2, unit: 'g' },

  // Laticínios
  { id: 'leite-mg', name: 'Leite meio-gordo', emoji: '🥛', kcal: 47, protein: 3.3, carbs: 4.8, fat: 1.6, unit: 'ml' },
  { id: 'leite-magro', name: 'Leite magro', emoji: '🥛', kcal: 35, protein: 3.4, carbs: 5, fat: 0.1, unit: 'ml' },
  { id: 'iogurte-grego', name: 'Iogurte grego natural', emoji: '🍦', kcal: 97, protein: 9, carbs: 3.9, fat: 5, unit: 'g' },
  { id: 'skyr', name: 'Skyr natural', emoji: '🍦', kcal: 63, protein: 11, carbs: 4, fat: 0.2, unit: 'g' },
  { id: 'queijo-fresco', name: 'Queijo fresco', emoji: '🧀', kcal: 98, protein: 11, carbs: 3.4, fat: 4.3, unit: 'g' },
  { id: 'queijo-flamengo', name: 'Queijo flamengo', emoji: '🧀', kcal: 345, protein: 25, carbs: 2, fat: 27, unit: 'g' },
  { id: 'requeijao', name: 'Requeijão', emoji: '🧀', kcal: 174, protein: 11, carbs: 3.3, fat: 13, unit: 'g' },
  { id: 'queijo-cottage', name: 'Queijo cottage', emoji: '🧀', kcal: 98, protein: 11, carbs: 3.4, fat: 4.3, unit: 'g' },

  // Fruta
  { id: 'banana', name: 'Banana', emoji: '🍌', kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, unit: 'g' },
  { id: 'maca', name: 'Maçã', emoji: '🍎', kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, unit: 'g' },
  { id: 'laranja', name: 'Laranja', emoji: '🍊', kcal: 47, protein: 0.9, carbs: 12, fat: 0.1, unit: 'g' },
  { id: 'morangos', name: 'Morangos', emoji: '🍓', kcal: 32, protein: 0.7, carbs: 7.7, fat: 0.3, unit: 'g' },
  { id: 'mirtilos', name: 'Mirtilos', emoji: '🫐', kcal: 57, protein: 0.7, carbs: 14, fat: 0.3, unit: 'g' },
  { id: 'uvas', name: 'Uvas', emoji: '🍇', kcal: 69, protein: 0.7, carbs: 18, fat: 0.2, unit: 'g' },
  { id: 'kiwi', name: 'Kiwi', emoji: '🥝', kcal: 61, protein: 1.1, carbs: 15, fat: 0.5, unit: 'g' },
  { id: 'melancia', name: 'Melancia', emoji: '🍉', kcal: 30, protein: 0.6, carbs: 7.6, fat: 0.2, unit: 'g' },
  { id: 'abacate', name: 'Abacate', emoji: '🥑', kcal: 160, protein: 2, carbs: 8.5, fat: 15, unit: 'g' },

  // Vegetais
  { id: 'brocolos', name: 'Brócolos cozidos', emoji: '🥦', kcal: 35, protein: 2.4, carbs: 7.2, fat: 0.4, unit: 'g' },
  { id: 'espinafres', name: 'Espinafres', emoji: '🥬', kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, unit: 'g' },
  { id: 'cenoura', name: 'Cenoura', emoji: '🥕', kcal: 41, protein: 0.9, carbs: 10, fat: 0.2, unit: 'g' },
  { id: 'tomate', name: 'Tomate', emoji: '🍅', kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, unit: 'g' },
  { id: 'alface', name: 'Alface', emoji: '🥬', kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2, unit: 'g' },
  { id: 'couve-flor', name: 'Couve-flor cozida', emoji: '🥦', kcal: 23, protein: 1.8, carbs: 4.1, fat: 0.5, unit: 'g' },
  { id: 'abobrinha', name: 'Curgete', emoji: '🥒', kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3, unit: 'g' },
  { id: 'pimento', name: 'Pimento', emoji: '🫑', kcal: 31, protein: 1, carbs: 6, fat: 0.3, unit: 'g' },

  // Gorduras e outros
  { id: 'azeite', name: 'Azeite', emoji: '🫒', kcal: 884, protein: 0, carbs: 0, fat: 100, unit: 'ml' },
  { id: 'manteiga', name: 'Manteiga', emoji: '🧈', kcal: 717, protein: 0.9, carbs: 0.1, fat: 81, unit: 'g' },
  { id: 'manteiga-amendoim', name: 'Manteiga de amendoim', emoji: '🥜', kcal: 588, protein: 25, carbs: 20, fat: 50, unit: 'g' },
  { id: 'amendoas', name: 'Amêndoas', emoji: '🌰', kcal: 579, protein: 21, carbs: 22, fat: 50, unit: 'g' },
  { id: 'nozes', name: 'Nozes', emoji: '🌰', kcal: 654, protein: 15, carbs: 14, fat: 65, unit: 'g' },
  { id: 'chocolate-negro', name: 'Chocolate negro 85%', emoji: '🍫', kcal: 592, protein: 9.7, carbs: 24, fat: 50, unit: 'g' },
  { id: 'mel', name: 'Mel', emoji: '🍯', kcal: 304, protein: 0.3, carbs: 82, fat: 0, unit: 'g' },
  { id: 'granola', name: 'Granola', emoji: '🥣', kcal: 471, protein: 10, carbs: 64, fat: 20, unit: 'g' },
]

/** Pesquisa simples, sem acentos e sem distinção de maiúsculas. */
export function searchFoods(foods: Food[], query: string): Food[] {
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const q = normalize(query.trim())
  if (!q) return foods
  return foods.filter((f) => normalize(f.name).includes(q))
}
