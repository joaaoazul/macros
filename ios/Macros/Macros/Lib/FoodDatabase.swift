//
//  FoodDatabase.swift
//  Macros
//
//  Base de dados de alimentos comuns em Portugal — equivalente de src/lib/foods.ts.
//  Valores por 100 g/ml.
//

import Foundation

enum FoodDatabase {
    static let all: [Food] = [
        // Proteínas
        Food(id: "frango-peito", name: "Peito de frango grelhado", emoji: "🍗", kcal: 165, protein: 31, carbs: 0, fat: 3.6, unit: .g),
        Food(id: "peru-peito", name: "Peito de peru", emoji: "🦃", kcal: 135, protein: 29, carbs: 0, fat: 1.7, unit: .g),
        Food(id: "ovo", name: "Ovo cozido", emoji: "🥚", kcal: 155, protein: 13, carbs: 1.1, fat: 11, unit: .g, portions: [Portion(label: "unidade", grams: 55)]),
        Food(id: "clara-ovo", name: "Clara de ovo", emoji: "🥚", kcal: 52, protein: 11, carbs: 0.7, fat: 0.2, unit: .g, portions: [Portion(label: "clara", grams: 33)]),
        Food(id: "atum-agua", name: "Atum em água", emoji: "🐟", kcal: 116, protein: 26, carbs: 0, fat: 1, unit: .g),
        Food(id: "salmao", name: "Salmão grelhado", emoji: "🐟", kcal: 208, protein: 20, carbs: 0, fat: 13, unit: .g),
        Food(id: "bacalhau", name: "Bacalhau cozido", emoji: "🐟", kcal: 105, protein: 23, carbs: 0, fat: 0.9, unit: .g),
        Food(id: "pescada", name: "Pescada cozida", emoji: "🐟", kcal: 90, protein: 19, carbs: 0, fat: 1.3, unit: .g),
        Food(id: "vaca-magra", name: "Bife de vaca magro", emoji: "🥩", kcal: 187, protein: 28, carbs: 0, fat: 8, unit: .g),
        Food(id: "porco-lombo", name: "Lombo de porco", emoji: "🥩", kcal: 172, protein: 27, carbs: 0, fat: 6.6, unit: .g),
        Food(id: "whey", name: "Whey (proteína em pó)", emoji: "🥤", kcal: 380, protein: 78, carbs: 8, fat: 5, unit: .g),
        Food(id: "tofu", name: "Tofu", emoji: "🧊", kcal: 76, protein: 8, carbs: 1.9, fat: 4.8, unit: .g),
        Food(id: "camarao", name: "Camarão cozido", emoji: "🦐", kcal: 99, protein: 24, carbs: 0.2, fat: 0.3, unit: .g),

        // Hidratos
        Food(id: "arroz-cozido", name: "Arroz branco cozido", emoji: "🍚", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, unit: .g),
        Food(id: "arroz-integral", name: "Arroz integral cozido", emoji: "🍚", kcal: 111, protein: 2.6, carbs: 23, fat: 0.9, unit: .g),
        Food(id: "massa-cozida", name: "Massa cozida", emoji: "🍝", kcal: 131, protein: 5, carbs: 25, fat: 1.1, unit: .g),
        Food(id: "batata", name: "Batata cozida", emoji: "🥔", kcal: 87, protein: 1.9, carbs: 20, fat: 0.1, unit: .g),
        Food(id: "batata-doce", name: "Batata-doce assada", emoji: "🍠", kcal: 90, protein: 2, carbs: 21, fat: 0.1, unit: .g),
        Food(id: "pao-trigo", name: "Pão de trigo", emoji: "🍞", kcal: 265, protein: 9, carbs: 49, fat: 3.2, unit: .g, portions: [Portion(label: "fatia", grams: 30), Portion(label: "papo-seco", grams: 50)]),
        Food(id: "pao-integral", name: "Pão integral", emoji: "🍞", kcal: 247, protein: 13, carbs: 41, fat: 3.4, unit: .g, portions: [Portion(label: "fatia", grams: 30)]),
        Food(id: "aveia", name: "Flocos de aveia", emoji: "🥣", kcal: 389, protein: 17, carbs: 66, fat: 7, unit: .g, portions: [Portion(label: "colher de sopa", grams: 15), Portion(label: "chávena", grams: 40)]),
        Food(id: "quinoa", name: "Quinoa cozida", emoji: "🌾", kcal: 120, protein: 4.4, carbs: 21, fat: 1.9, unit: .g),
        Food(id: "cuscuz", name: "Cuscuz cozido", emoji: "🌾", kcal: 112, protein: 3.8, carbs: 23, fat: 0.2, unit: .g),
        Food(id: "tortitas-arroz", name: "Tortitas de arroz", emoji: "🍘", kcal: 387, protein: 8, carbs: 82, fat: 2.8, unit: .g),

        // Leguminosas
        Food(id: "feijao-preto", name: "Feijão preto cozido", emoji: "🫘", kcal: 132, protein: 8.9, carbs: 24, fat: 0.5, unit: .g),
        Food(id: "grao", name: "Grão-de-bico cozido", emoji: "🫘", kcal: 164, protein: 8.9, carbs: 27, fat: 2.6, unit: .g),
        Food(id: "lentilhas", name: "Lentilhas cozidas", emoji: "🫘", kcal: 116, protein: 9, carbs: 20, fat: 0.4, unit: .g),
        Food(id: "ervilhas", name: "Ervilhas cozidas", emoji: "🟢", kcal: 84, protein: 5.4, carbs: 16, fat: 0.2, unit: .g),

        // Laticínios
        Food(id: "leite-mg", name: "Leite meio-gordo", emoji: "🥛", kcal: 47, protein: 3.3, carbs: 4.8, fat: 1.6, unit: .ml, portions: [Portion(label: "copo", grams: 200), Portion(label: "chávena", grams: 120)]),
        Food(id: "leite-magro", name: "Leite magro", emoji: "🥛", kcal: 35, protein: 3.4, carbs: 5, fat: 0.1, unit: .ml, portions: [Portion(label: "copo", grams: 200)]),
        Food(id: "iogurte-grego", name: "Iogurte grego natural", emoji: "🍦", kcal: 97, protein: 9, carbs: 3.9, fat: 5, unit: .g),
        Food(id: "skyr", name: "Skyr natural", emoji: "🍦", kcal: 63, protein: 11, carbs: 4, fat: 0.2, unit: .g),
        Food(id: "queijo-fresco", name: "Queijo fresco", emoji: "🧀", kcal: 98, protein: 11, carbs: 3.4, fat: 4.3, unit: .g),
        Food(id: "queijo-flamengo", name: "Queijo flamengo", emoji: "🧀", kcal: 345, protein: 25, carbs: 2, fat: 27, unit: .g),
        Food(id: "requeijao", name: "Requeijão", emoji: "🧀", kcal: 174, protein: 11, carbs: 3.3, fat: 13, unit: .g),
        Food(id: "queijo-cottage", name: "Queijo cottage", emoji: "🧀", kcal: 98, protein: 11, carbs: 3.4, fat: 4.3, unit: .g),

        // Fruta
        Food(id: "banana", name: "Banana", emoji: "🍌", kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, unit: .g),
        Food(id: "maca", name: "Maçã", emoji: "🍎", kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, unit: .g),
        Food(id: "laranja", name: "Laranja", emoji: "🍊", kcal: 47, protein: 0.9, carbs: 12, fat: 0.1, unit: .g),
        Food(id: "morangos", name: "Morangos", emoji: "🍓", kcal: 32, protein: 0.7, carbs: 7.7, fat: 0.3, unit: .g),
        Food(id: "mirtilos", name: "Mirtilos", emoji: "🫐", kcal: 57, protein: 0.7, carbs: 14, fat: 0.3, unit: .g),
        Food(id: "uvas", name: "Uvas", emoji: "🍇", kcal: 69, protein: 0.7, carbs: 18, fat: 0.2, unit: .g),
        Food(id: "kiwi", name: "Kiwi", emoji: "🥝", kcal: 61, protein: 1.1, carbs: 15, fat: 0.5, unit: .g),
        Food(id: "melancia", name: "Melancia", emoji: "🍉", kcal: 30, protein: 0.6, carbs: 7.6, fat: 0.2, unit: .g),
        Food(id: "abacate", name: "Abacate", emoji: "🥑", kcal: 160, protein: 2, carbs: 8.5, fat: 15, unit: .g),

        // Vegetais
        Food(id: "brocolos", name: "Brócolos cozidos", emoji: "🥦", kcal: 35, protein: 2.4, carbs: 7.2, fat: 0.4, unit: .g),
        Food(id: "espinafres", name: "Espinafres", emoji: "🥬", kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, unit: .g),
        Food(id: "cenoura", name: "Cenoura", emoji: "🥕", kcal: 41, protein: 0.9, carbs: 10, fat: 0.2, unit: .g),
        Food(id: "tomate", name: "Tomate", emoji: "🍅", kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, unit: .g),
        Food(id: "alface", name: "Alface", emoji: "🥬", kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2, unit: .g),
        Food(id: "couve-flor", name: "Couve-flor cozida", emoji: "🥦", kcal: 23, protein: 1.8, carbs: 4.1, fat: 0.5, unit: .g),
        Food(id: "abobrinha", name: "Curgete", emoji: "🥒", kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3, unit: .g),
        Food(id: "pimento", name: "Pimento", emoji: "🫑", kcal: 31, protein: 1, carbs: 6, fat: 0.3, unit: .g),

        // Gorduras e outros
        Food(id: "azeite", name: "Azeite", emoji: "🫒", kcal: 884, protein: 0, carbs: 0, fat: 100, unit: .ml),
        Food(id: "manteiga", name: "Manteiga", emoji: "🧈", kcal: 717, protein: 0.9, carbs: 0.1, fat: 81, unit: .g),
        Food(id: "manteiga-amendoim", name: "Manteiga de amendoim", emoji: "🥜", kcal: 588, protein: 25, carbs: 20, fat: 50, unit: .g),
        Food(id: "amendoas", name: "Amêndoas", emoji: "🌰", kcal: 579, protein: 21, carbs: 22, fat: 50, unit: .g),
        Food(id: "nozes", name: "Nozes", emoji: "🌰", kcal: 654, protein: 15, carbs: 14, fat: 65, unit: .g),
        Food(id: "chocolate-negro", name: "Chocolate negro 85%", emoji: "🍫", kcal: 592, protein: 9.7, carbs: 24, fat: 50, unit: .g),
        Food(id: "mel", name: "Mel", emoji: "🍯", kcal: 304, protein: 0.3, carbs: 82, fat: 0, unit: .g),
        Food(id: "granola", name: "Granola", emoji: "🥣", kcal: 471, protein: 10, carbs: 64, fat: 20, unit: .g),

        // Mais proteínas
        Food(id: "frango-coxa", name: "Coxa de frango (sem pele)", emoji: "🍗", kcal: 177, protein: 24, carbs: 0, fat: 8.7, unit: .g),
        Food(id: "ovo-mexido", name: "Ovos mexidos", emoji: "🍳", kcal: 166, protein: 11, carbs: 1.6, fat: 12, unit: .g),
        Food(id: "sardinha", name: "Sardinha grelhada", emoji: "🐟", kcal: 208, protein: 25, carbs: 0, fat: 12, unit: .g),
        Food(id: "dourada", name: "Dourada grelhada", emoji: "🐟", kcal: 121, protein: 20, carbs: 0, fat: 4.6, unit: .g),
        Food(id: "polvo", name: "Polvo cozido", emoji: "🐙", kcal: 82, protein: 15, carbs: 2.2, fat: 1, unit: .g),
        Food(id: "fiambre-peru", name: "Fiambre de peru", emoji: "🍖", kcal: 104, protein: 17, carbs: 1.5, fat: 3.5, unit: .g),
        Food(id: "fiambre", name: "Fiambre de porco", emoji: "🍖", kcal: 145, protein: 18, carbs: 1.5, fat: 7.5, unit: .g),
        Food(id: "presunto", name: "Presunto", emoji: "🥓", kcal: 241, protein: 31, carbs: 0.3, fat: 13, unit: .g),
        Food(id: "seitan", name: "Seitan", emoji: "🌱", kcal: 143, protein: 25, carbs: 4, fat: 2, unit: .g),
        Food(id: "soja-texturizada", name: "Soja texturizada (seca)", emoji: "🌱", kcal: 333, protein: 52, carbs: 30, fat: 1.5, unit: .g),

        // Mais hidratos / cereais / pão
        Food(id: "pao-centeio", name: "Pão de centeio", emoji: "🍞", kcal: 259, protein: 8.5, carbs: 48, fat: 3.3, unit: .g),
        Food(id: "broa-milho", name: "Broa de milho", emoji: "🍞", kcal: 227, protein: 5.5, carbs: 46, fat: 2.4, unit: .g),
        Food(id: "tostas", name: "Tostas integrais", emoji: "🍞", kcal: 380, protein: 12, carbs: 68, fat: 6, unit: .g),
        Food(id: "wrap", name: "Wrap / tortilha de trigo", emoji: "🌯", kcal: 297, protein: 8, carbs: 49, fat: 7.5, unit: .g),
        Food(id: "flocos-milho", name: "Cereais de milho", emoji: "🥣", kcal: 357, protein: 7, carbs: 84, fat: 0.9, unit: .g),
        Food(id: "muesli", name: "Muesli", emoji: "🥣", kcal: 363, protein: 9.7, carbs: 66, fat: 6, unit: .g),
        Food(id: "milho-cozido", name: "Milho doce (lata)", emoji: "🌽", kcal: 86, protein: 3.2, carbs: 19, fat: 1.2, unit: .g),
        Food(id: "puree-batata", name: "Puré de batata", emoji: "🥔", kcal: 88, protein: 2, carbs: 15, fat: 2.3, unit: .g),

        // Laticínios / alternativas
        Food(id: "iogurte-natural", name: "Iogurte natural", emoji: "🥛", kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3, unit: .g),
        Food(id: "iogurte-proteico", name: "Iogurte proteico", emoji: "🥛", kcal: 59, protein: 10, carbs: 4, fat: 0.2, unit: .g),
        Food(id: "kefir", name: "Kefir", emoji: "🥛", kcal: 55, protein: 3.3, carbs: 4.5, fat: 2.5, unit: .ml),
        Food(id: "leite-aveia", name: "Bebida de aveia", emoji: "🥛", kcal: 46, protein: 1, carbs: 7, fat: 1.5, unit: .ml),
        Food(id: "leite-amendoa", name: "Bebida de amêndoa", emoji: "🥛", kcal: 24, protein: 1, carbs: 3, fat: 1.1, unit: .ml),
        Food(id: "queijo-mozzarella", name: "Mozzarella", emoji: "🧀", kcal: 280, protein: 22, carbs: 2.2, fat: 20, unit: .g),
        Food(id: "queijo-curado", name: "Queijo curado", emoji: "🧀", kcal: 402, protein: 25, carbs: 1.4, fat: 33, unit: .g),

        // Fruta / vegetais extra
        Food(id: "pera", name: "Pera", emoji: "🍐", kcal: 57, protein: 0.4, carbs: 15, fat: 0.1, unit: .g),
        Food(id: "pessego", name: "Pêssego", emoji: "🍑", kcal: 39, protein: 0.9, carbs: 10, fat: 0.3, unit: .g),
        Food(id: "ananas", name: "Ananás", emoji: "🍍", kcal: 50, protein: 0.5, carbs: 13, fat: 0.1, unit: .g),
        Food(id: "manga", name: "Manga", emoji: "🥭", kcal: 60, protein: 0.8, carbs: 15, fat: 0.4, unit: .g),
        Food(id: "framboesas", name: "Framboesas", emoji: "🍓", kcal: 52, protein: 1.2, carbs: 12, fat: 0.7, unit: .g),
        Food(id: "clementina", name: "Tangerina", emoji: "🍊", kcal: 53, protein: 0.8, carbs: 13, fat: 0.3, unit: .g),
        Food(id: "cebola", name: "Cebola", emoji: "🧅", kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, unit: .g),
        Food(id: "alho", name: "Alho", emoji: "🧄", kcal: 149, protein: 6.4, carbs: 33, fat: 0.5, unit: .g),
        Food(id: "cogumelos", name: "Cogumelos", emoji: "🍄", kcal: 22, protein: 3.1, carbs: 3.3, fat: 0.3, unit: .g),
        Food(id: "feijao-verde", name: "Feijão-verde", emoji: "🫛", kcal: 31, protein: 1.8, carbs: 7, fat: 0.2, unit: .g),
        Food(id: "grelos", name: "Grelos cozidos", emoji: "🥬", kcal: 22, protein: 2.6, carbs: 2.5, fat: 0.4, unit: .g),
        Food(id: "milho-pipoca", name: "Pipocas (sem óleo)", emoji: "🍿", kcal: 387, protein: 13, carbs: 78, fat: 4.5, unit: .g),

        // Snacks / doces / bolachas
        Food(id: "bolacha-maria", name: "Bolacha Maria", emoji: "🍪", kcal: 436, protein: 7.5, carbs: 77, fat: 10, unit: .g),
        Food(id: "barra-cereais", name: "Barra de cereais", emoji: "🍫", kcal: 407, protein: 6, carbs: 68, fat: 12, unit: .g),
        Food(id: "barra-proteica", name: "Barra proteica", emoji: "🍫", kcal: 350, protein: 33, carbs: 33, fat: 9, unit: .g),
        Food(id: "chocolate-leite", name: "Chocolate de leite", emoji: "🍫", kcal: 535, protein: 7.6, carbs: 59, fat: 30, unit: .g),
        Food(id: "gelado", name: "Gelado de baunilha", emoji: "🍨", kcal: 207, protein: 3.5, carbs: 24, fat: 11, unit: .g),
        Food(id: "pastel-nata", name: "Pastel de nata", emoji: "🥮", kcal: 298, protein: 6, carbs: 37, fat: 14, unit: .g),
        Food(id: "batatas-fritas", name: "Batatas fritas (pacote)", emoji: "🍟", kcal: 536, protein: 6.6, carbs: 53, fat: 34, unit: .g),

        // Pratos prontos / refeições PT
        Food(id: "arroz-feijao", name: "Arroz de feijão", emoji: "🍲", kcal: 145, protein: 4, carbs: 27, fat: 2.5, unit: .g),
        Food(id: "sopa-legumes", name: "Sopa de legumes", emoji: "🍜", kcal: 42, protein: 1.5, carbs: 6, fat: 1.4, unit: .g),
        Food(id: "caldo-verde", name: "Caldo verde", emoji: "🍲", kcal: 55, protein: 1.8, carbs: 7, fat: 2, unit: .g),
        Food(id: "bacalhau-natas", name: "Bacalhau com natas", emoji: "🥘", kcal: 180, protein: 10, carbs: 12, fat: 10, unit: .g),
        Food(id: "francesinha", name: "Francesinha", emoji: "🥪", kcal: 250, protein: 14, carbs: 15, fat: 15, unit: .g),
        Food(id: "pizza", name: "Pizza (fatia)", emoji: "🍕", kcal: 266, protein: 11, carbs: 33, fat: 10, unit: .g),
        Food(id: "hamburguer", name: "Hambúrguer (carne)", emoji: "🍔", kcal: 250, protein: 15, carbs: 2, fat: 20, unit: .g),
        Food(id: "omelete", name: "Omelete", emoji: "🍳", kcal: 154, protein: 11, carbs: 0.6, fat: 12, unit: .g),

        // Molhos / condimentos / bebidas
        Food(id: "ketchup", name: "Ketchup", emoji: "🍅", kcal: 112, protein: 1.7, carbs: 26, fat: 0.1, unit: .g),
        Food(id: "maionese", name: "Maionese", emoji: "🥚", kcal: 680, protein: 1, carbs: 1.5, fat: 75, unit: .g),
        Food(id: "molho-soja", name: "Molho de soja", emoji: "🍶", kcal: 53, protein: 8, carbs: 4.9, fat: 0.6, unit: .ml),
        Food(id: "sumo-laranja", name: "Sumo de laranja natural", emoji: "🧃", kcal: 45, protein: 0.7, carbs: 10, fat: 0.2, unit: .ml),
        Food(id: "cerveja", name: "Cerveja", emoji: "🍺", kcal: 43, protein: 0.5, carbs: 3.6, fat: 0, unit: .ml),
        Food(id: "vinho-tinto", name: "Vinho tinto", emoji: "🍷", kcal: 85, protein: 0.1, carbs: 2.6, fat: 0, unit: .ml),
        Food(id: "coca-cola", name: "Refrigerante com açúcar", emoji: "🥤", kcal: 42, protein: 0, carbs: 10.6, fat: 0, unit: .ml),
        Food(id: "cafe", name: "Café (expresso)", emoji: "☕", kcal: 2, protein: 0.1, carbs: 0, fat: 0, unit: .ml),
    ]

    private static func normalize(_ s: String) -> String {
        s.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pt_PT"))
    }

    /// Conta quantas vezes cada alimento já foi registado, a partir do próprio diário.
    static func buildUsageIndex(_ diary: Diary) -> [String: Int] {
        var counts: [String: Int] = [:]
        for entries in diary.values {
            for e in entries {
                let name = stripBrandSuffix(normalize(e.foodName))
                counts[name, default: 0] += 1
            }
        }
        return counts
    }

    /// Como o índice geral, mas separado por refeição e só com o passado recente (janela de 60 dias).
    static func buildMealUsageIndex(_ diary: Diary, today: String, days: Int = 60) -> [MealId: [String: Int]] {
        let cutoff = DateUtils.shiftDate(today, days: -days)
        var byMeal: [MealId: [String: Int]] = [:]
        for (date, entries) in diary where date >= cutoff {
            for e in entries {
                let name = stripBrandSuffix(normalize(e.foodName))
                byMeal[e.meal, default: [:]][name, default: 0] += 1
            }
        }
        return byMeal
    }

    /// Os alimentos que mais são registados nesta refeição.
    static func topFoodsForMeal(_ foods: [Food], index: [MealId: [String: Int]], meal: MealId, limit: Int = 5) -> [Food] {
        guard let counts = index[meal], !counts.isEmpty else { return [] }
        var seen = Set<String>()
        var scored: [(food: Food, n: Int)] = []
        for f in foods {
            let key = normalize(f.name)
            if seen.contains(key) { continue }
            let n = counts[key] ?? 0
            if n > 0 {
                scored.append((f, n))
                seen.insert(key)
            }
        }
        return scored.sorted { $0.n > $1.n }.prefix(limit).map { $0.food }
    }

    private static func stripBrandSuffix(_ s: String) -> String {
        guard let range = s.range(of: #"\s*\([^)]*\)\s*$"#, options: .regularExpression) else { return s }
        return String(s[s.startIndex..<range.lowerBound])
    }

    /// Pesquisa sem acentos e sem distinção de maiúsculas; ordena por relevância e uso.
    static func search(_ foods: [Food], query: String, usage: [String: Int] = [:]) -> [Food] {
        let q = normalize(query.trimmingCharacters(in: .whitespacesAndNewlines))
        let matches = q.isEmpty ? foods : foods.filter { normalize($0.name).contains(q) }
        guard !usage.isEmpty else { return matches }

        func score(_ f: Food) -> Int { usage[normalize(f.name)] ?? 0 }
        return matches.sorted { a, b in
            if !q.isEmpty {
                let pa = normalize(a.name).hasPrefix(q) ? 1 : 0
                let pb = normalize(b.name).hasPrefix(q) ? 1 : 0
                if pa != pb { return pa > pb }
            }
            return score(a) > score(b)
        }
    }
}
