//
//  Models.swift
//  Macros
//
//  Modelos de dados — equivalente nativo de src/types.ts.
//

import Foundation

enum Sex: String, Codable, CaseIterable, Identifiable {
    case male = "M"
    case female = "F"
    var id: String { rawValue }
}

enum Goal: String, Codable, CaseIterable, Identifiable {
    case cut, maintain, bulk
    var id: String { rawValue }
}

enum MealId: String, Codable, CaseIterable, Identifiable {
    case madrugada, breakfast, lunch, snack, dinner, supper
    var id: String { rawValue }
}

enum FoodUnit: String, Codable {
    case g, ml
}

struct MealInfo: Identifiable {
    let id: MealId
    let label: String
    let emoji: String
}

/// Refeições do dia, pela ordem em que aparecem no diário.
let MEALS: [MealInfo] = [
    MealInfo(id: .madrugada, label: "Madrugada", emoji: "🌌"),
    MealInfo(id: .breakfast, label: "Pequeno-almoço", emoji: "🌅"),
    MealInfo(id: .lunch, label: "Almoço", emoji: "🍽️"),
    MealInfo(id: .snack, label: "Lanche", emoji: "🥪"),
    MealInfo(id: .dinner, label: "Jantar", emoji: "🌙"),
    MealInfo(id: .supper, label: "Ceia", emoji: "🌃"),
]

func mealInfo(_ id: MealId) -> MealInfo {
    MEALS.first { $0.id == id } ?? MEALS[0]
}

struct Targets: Codable, Equatable {
    var kcal: Int
    var protein: Int
    var carbs: Int
    var fat: Int
    var waterMl: Int

    init(kcal: Int, protein: Int, carbs: Int, fat: Int, waterMl: Int) {
        self.kcal = kcal
        self.protein = protein
        self.carbs = carbs
        self.fat = fat
        self.waterMl = waterMl
    }

    /// O backend guarda estes campos como `float` (ver backend/app/data/schemas.py);
    /// decodifica com tolerância em vez de exigir um Int exato no JSON.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func readInt(_ key: CodingKeys) throws -> Int {
            Int((try c.decode(Double.self, forKey: key)).rounded())
        }
        kcal = try readInt(.kcal)
        protein = try readInt(.protein)
        carbs = try readInt(.carbs)
        fat = try readInt(.fat)
        waterMl = try readInt(.waterMl)
    }
}

struct Profile: Codable, Equatable {
    var name: String
    var sex: Sex
    var age: Int
    var heightCm: Double
    var weightKg: Double
    var activity: Double
    var goal: Goal
    var targets: Targets
    /// Data de nascimento ISO (yyyy-MM-dd). Quando presente, a idade é derivada dela.
    var birthdate: String?
    /// % de gordura corporal. Quando presente, a TMB usa Katch-McArdle.
    var bodyFatPct: Double?
}

/// Uma medida caseira do alimento: 1 `label` equivale a `grams` g/ml.
struct Portion: Codable, Hashable, Identifiable {
    var label: String
    var grams: Double
    var id: String { label }
}

/// Valores nutricionais por 100 g / 100 ml.
struct Food: Codable, Hashable, Identifiable {
    var id: String
    var name: String
    var emoji: String
    var kcal: Double
    var protein: Double
    var carbs: Double
    var fat: Double
    var unit: FoodUnit
    var custom: Bool? = nil
    var brand: String? = nil
    var portions: [Portion]? = nil

    var displayName: String {
        if let brand, !brand.isEmpty { return "\(name) (\(brand))" }
        return name
    }
}

struct Entry: Codable, Hashable, Identifiable {
    var id: String
    var meal: MealId
    var foodName: String
    var emoji: String
    var grams: Double
    var unit: FoodUnit
    var kcal: Double
    var protein: Double
    var carbs: Double
    var fat: Double
}

struct Exercise: Codable, Hashable, Identifiable {
    var id: String
    var name: String
    var kcal: Double
}

/// Diário: chave é a data em ISO (yyyy-MM-dd).
typealias Diary = [String: [Entry]]
typealias WaterLog = [String: Double]
typealias ExerciseLog = [String: [Exercise]]

struct DayTotals {
    var kcal: Double = 0
    var protein: Double = 0
    var carbs: Double = 0
    var fat: Double = 0
}

func sumEntries(_ entries: [Entry]) -> DayTotals {
    entries.reduce(into: DayTotals()) { t, e in
        t.kcal += e.kcal
        t.protein += e.protein
        t.carbs += e.carbs
        t.fat += e.fat
    }
}
