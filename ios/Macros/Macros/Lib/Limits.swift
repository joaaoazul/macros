//
//  Limits.swift
//  Macros
//
//  Limites partilhados das métricas corporais — equivalente de src/lib/limits.ts.
//

import Foundation

struct ValueRange {
    let min: Double
    let max: Double
    func contains(_ value: Double) -> Bool {
        value.isFinite && value >= min && value <= max
    }
}

enum Limits {
    static let weightKg = ValueRange(min: 25, max: 400)
    static let heightCm = ValueRange(min: 80, max: 250)
    static let age = ValueRange(min: 10, max: 120)
    /// % de gordura corporal plausível (Katch-McArdle).
    static let bodyFatPct = ValueRange(min: 3, max: 70)

    // Limites usados no onboarding (ligeiramente mais apertados que os limites
    // absolutos acima, tal como no formulário original em Onboarding.tsx).
    static let onboardingAge = ValueRange(min: 14, max: 100)
    static let onboardingHeight = ValueRange(min: 120, max: 230)
    static let onboardingWeight = ValueRange(min: 35, max: 250)
}
