//
//  Calc.swift
//  Macros
//
//  BMR/TDEE, alvos de macros — equivalente nativo de src/lib/calc.ts.
//

import Foundation

struct ActivityLevel: Identifiable {
    let value: Double
    let label: String
    let hint: String
    var id: Double { value }
}

struct GoalInfo: Identifiable {
    let value: Goal
    let label: String
    let hint: String
    let emoji: String
    var id: Goal { value }
}

let ACTIVITY_LEVELS: [ActivityLevel] = [
    .init(value: 1.2, label: "Sedentário", hint: "Pouco ou nenhum exercício"),
    .init(value: 1.375, label: "Leve", hint: "Exercício 1–3× por semana"),
    .init(value: 1.55, label: "Moderado", hint: "Exercício 3–5× por semana"),
    .init(value: 1.725, label: "Alto", hint: "Exercício 6–7× por semana"),
    .init(value: 1.9, label: "Muito alto", hint: "Treino intenso diário / trabalho físico"),
]

let GOALS: [GoalInfo] = [
    .init(value: .cut, label: "Perder gordura", hint: "Défice de ~20%", emoji: "🔥"),
    .init(value: .maintain, label: "Manter o peso", hint: "Calorias de manutenção", emoji: "⚖️"),
    .init(value: .bulk, label: "Ganhar músculo", hint: "Excedente de ~10%", emoji: "💪"),
]

func goalInfo(_ g: Goal) -> GoalInfo { GOALS.first { $0.value == g }! }
func activityInfo(_ v: Double) -> ActivityLevel? { ACTIVITY_LEVELS.first { $0.value == v } }

enum Calc {
    /// TMB por Katch-McArdle, a partir da massa magra (precisa de % de gordura).
    static func bmrKatch(weightKg: Double, bodyFatPct: Double) -> Double {
        let leanMassKg = weightKg * (1 - bodyFatPct / 100)
        return 370 + 21.6 * leanMassKg
    }

    /// BMR (TMB): Katch-McArdle quando há % de gordura, senão Mifflin-St Jeor.
    static func bmr(sex: Sex, weightKg: Double, heightCm: Double, age: Int, bodyFatPct: Double? = nil) -> Double {
        if let bf = bodyFatPct, bf > 0 { return bmrKatch(weightKg: weightKg, bodyFatPct: bf) }
        let base = 10 * weightKg + 6.25 * heightCm - 5 * Double(age)
        return sex == .male ? base + 5 : base - 161
    }

    static func tdee(sex: Sex, weightKg: Double, heightCm: Double, age: Int, activity: Double, bodyFatPct: Double? = nil) -> Double {
        bmr(sex: sex, weightKg: weightKg, heightCm: heightCm, age: age, bodyFatPct: bodyFatPct) * activity
    }

    /// Idade a partir da data de nascimento (ISO), com fallback se ausente/inválida.
    static func ageFromBirthdate(_ birthdate: String?, fallback: Int) -> Int {
        guard let birthdate, let b = isoDateFormatter.date(from: birthdate) else { return fallback }
        let now = Date()
        let cal = Calendar(identifier: .gregorian)
        var age = cal.component(.year, from: now) - cal.component(.year, from: b)
        let monthDiff = cal.component(.month, from: now) - cal.component(.month, from: b)
        if monthDiff < 0 || (monthDiff == 0 && cal.component(.day, from: now) < cal.component(.day, from: b)) {
            age -= 1
        }
        return (Double(age) >= Limits.age.min && Double(age) <= Limits.age.max) ? age : fallback
    }

    static func bmi(weightKg: Double, heightCm: Double) -> Double {
        let h = heightCm / 100
        return weightKg / (h * h)
    }

    /// Meta de água: ~35 ml/kg, arredondada aos 250 ml.
    static func waterTarget(weightKg: Double) -> Int {
        Int((weightKg * 35 / 250).rounded()) * 250
    }

    private static let goalFactor: [Goal: Double] = [.cut: 0.8, .maintain: 1, .bulk: 1.1]
    private static let proteinPerKg: [Goal: Double] = [.cut: 2.2, .maintain: 1.8, .bulk: 2.0]

    /// Alvos diários: calorias a partir do TDEE ajustado ao objetivo, proteína por
    /// kg de peso, gordura a 25% das kcal, resto em hidratos.
    static func computeTargets(sex: Sex, weightKg: Double, heightCm: Double, age: Int, activity: Double, goal: Goal, bodyFatPct: Double? = nil) -> Targets {
        let kcal = Int((tdee(sex: sex, weightKg: weightKg, heightCm: heightCm, age: age, activity: activity, bodyFatPct: bodyFatPct) * goalFactor[goal]!).rounded())
        let protein = Int((proteinPerKg[goal]! * weightKg).rounded())
        let fat = Int((Double(kcal) * 0.25 / 9).rounded())
        let carbs = max(0, Int((Double(kcal - protein * 4 - fat * 9) / 4).rounded()))
        return Targets(kcal: kcal, protein: protein, carbs: carbs, fat: fat, waterMl: waterTarget(weightKg: weightKg))
    }

    /// Gramas a partir de kcal + repartição percentual.
    static func targetsFromSplit(kcal: Int, carbsPct: Int, proteinPct: Int, fatPct: Int, waterMl: Int) -> Targets {
        Targets(
            kcal: kcal,
            protein: Int((Double(kcal * proteinPct) / 100 / 4).rounded()),
            carbs: Int((Double(kcal * carbsPct) / 100 / 4).rounded()),
            fat: Int((Double(kcal * fatPct) / 100 / 9).rounded()),
            waterMl: waterMl
        )
    }

    /// Repartição percentual atual dos alvos (soma forçada a 100).
    static func splitFromTargets(_ t: Targets) -> (carbsPct: Int, proteinPct: Int, fatPct: Int) {
        let total = Double(t.carbs * 4 + t.protein * 4 + t.fat * 9)
        guard total > 0 else { return (50, 20, 30) }
        let carbsPct = Int((Double(t.carbs * 4) / total * 100).rounded())
        let proteinPct = Int((Double(t.protein * 4) / total * 100).rounded())
        return (carbsPct, proteinPct, 100 - carbsPct - proteinPct)
    }

    /// Migra perfis guardados antes da meta de água existir.
    static func withWaterTarget(_ p: Profile) -> Profile {
        if p.targets.waterMl > 0 { return p }
        var next = p
        next.targets.waterMl = waterTarget(weightKg: p.weightKg)
        return next
    }
}

let isoDateFormatter: DateFormatter = {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone.current
    f.dateFormat = "yyyy-MM-dd"
    return f
}()
