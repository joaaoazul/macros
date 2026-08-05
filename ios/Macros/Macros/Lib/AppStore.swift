//
//  AppStore.swift
//  Macros
//
//  Estado da app + persistência local (UserDefaults/JSON) — equivalente nativo
//  de usePersistedState (src/lib/store.ts) e useSyncedData, mas sem backend:
//  tudo fica só neste dispositivo.
//

import Foundation
import Combine

@MainActor
final class AppStore: ObservableObject {
    @Published var profile: Profile? { didSet { save(profile, key: Keys.profile) } }
    @Published var diary: Diary { didSet { save(diary, key: Keys.diary) } }
    @Published var water: WaterLog { didSet { save(water, key: Keys.water) } }
    @Published var exercise: ExerciseLog { didSet { save(exercise, key: Keys.exercise) } }
    @Published var customFoods: [Food] { didSet { save(customFoods, key: Keys.customFoods) } }

    private enum Keys {
        static let profile = "macros.profile"
        static let diary = "macros.diary"
        static let water = "macros.water"
        static let exercise = "macros.exercise"
        static let customFoods = "macros.customFoods"
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.profile = Self.load(Profile.self, key: Keys.profile, defaults: defaults)
        self.diary = Self.load(Diary.self, key: Keys.diary, defaults: defaults) ?? [:]
        self.water = Self.load(WaterLog.self, key: Keys.water, defaults: defaults) ?? [:]
        self.exercise = Self.load(ExerciseLog.self, key: Keys.exercise, defaults: defaults) ?? [:]
        self.customFoods = Self.load([Food].self, key: Keys.customFoods, defaults: defaults) ?? []
    }

    private static func load<T: Decodable>(_ type: T.Type, key: String, defaults: UserDefaults) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    private func save<T: Encodable>(_ value: T, key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        defaults.set(data, forKey: key)
    }

    // MARK: - Diário

    func entries(on date: String) -> [Entry] { diary[date] ?? [] }

    func addEntry(_ entry: Entry, on date: String) {
        diary[date, default: []].append(entry)
    }

    func removeEntry(id: String, on date: String) {
        diary[date]?.removeAll { $0.id == id }
    }

    func updateEntry(_ updated: Entry, on date: String) {
        guard var list = diary[date], let idx = list.firstIndex(where: { $0.id == updated.id }) else { return }
        list[idx] = updated
        diary[date] = list
    }

    // MARK: - Água

    func waterAmount(on date: String) -> Double { water[date] ?? 0 }

    func addWater(_ ml: Double, on date: String) {
        water[date] = max(0, (water[date] ?? 0) + ml)
    }

    // MARK: - Exercício

    func exercises(on date: String) -> [Exercise] { exercise[date] ?? [] }

    func addExercise(_ ex: Exercise, on date: String) {
        exercise[date, default: []].append(ex)
    }

    func removeExercise(id: String, on date: String) {
        exercise[date]?.removeAll { $0.id == id }
    }

    // MARK: - Alimentos

    var allFoods: [Food] { FoodDatabase.all + customFoods }

    func addCustomFood(_ food: Food) {
        customFoods.append(food)
    }

    // MARK: - Reposição

    /// Apaga todos os dados locais (perfil, diário, água, exercício e alimentos
    /// personalizados) e volta ao onboarding.
    func resetAll() {
        profile = nil
        diary = [:]
        water = [:]
        exercise = [:]
        customFoods = []
    }

    // MARK: - Exportação

    struct ExportPayload: Codable {
        var profile: Profile?
        var diary: Diary
        var water: WaterLog
        var exercise: ExerciseLog
        var customFoods: [Food]
    }

    /// JSON com todos os dados, para o utilizador guardar uma cópia de segurança.
    func exportJSON() -> Data? {
        let payload = ExportPayload(profile: profile, diary: diary, water: water, exercise: exercise, customFoods: customFoods)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try? encoder.encode(payload)
    }
}
