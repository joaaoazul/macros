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
    @Published var profile: Profile? {
        didSet {
            save(profile, key: Keys.profile)
            pushProfile()
        }
    }
    @Published var diary: Diary { didSet { save(diary, key: Keys.diary) } }
    @Published var water: WaterLog { didSet { save(water, key: Keys.water) } }
    @Published var exercise: ExerciseLog { didSet { save(exercise, key: Keys.exercise) } }
    @Published var customFoods: [Food] { didSet { save(customFoods, key: Keys.customFoods) } }

    /// Há dados guardados neste dispositivo de antes de existir conta — a
    /// app oferece importá-los (ver hydrateFromServer/migrateLocalDataToServer).
    @Published var migrationAvailable = false
    @Published var isSyncing = false

    private let api = APIClient.shared

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
        pushDay(date)
    }

    func removeEntry(id: String, on date: String) {
        diary[date]?.removeAll { $0.id == id }
        pushDay(date)
    }

    func updateEntry(_ updated: Entry, on date: String) {
        guard var list = diary[date], let idx = list.firstIndex(where: { $0.id == updated.id }) else { return }
        list[idx] = updated
        diary[date] = list
        pushDay(date)
    }

    // MARK: - Água

    func waterAmount(on date: String) -> Double { water[date] ?? 0 }

    func addWater(_ ml: Double, on date: String) {
        water[date] = max(0, (water[date] ?? 0) + ml)
        pushDay(date)
    }

    // MARK: - Exercício

    func exercises(on date: String) -> [Exercise] { exercise[date] ?? [] }

    func addExercise(_ ex: Exercise, on date: String) {
        exercise[date, default: []].append(ex)
        pushDay(date)
    }

    func removeExercise(id: String, on date: String) {
        exercise[date]?.removeAll { $0.id == id }
        pushDay(date)
    }

    // MARK: - Alimentos

    var allFoods: [Food] { FoodDatabase.all + customFoods }

    func addCustomFood(_ food: Food) {
        customFoods.append(food)
        pushCustomFoods()
    }

    // MARK: - Reposição

    /// Limpa a cópia local (perfil, diário, água, exercício e alimentos
    /// personalizados) neste dispositivo — usado ao terminar sessão. Não
    /// apaga nada no servidor (a conta mantém os dados).
    func resetAll() {
        profile = nil
        diary = [:]
        water = [:]
        exercise = [:]
        customFoods = []
        migrationAvailable = false
    }

    // MARK: - Sincronização com o backend

    /// Chamado depois de autenticar: traz os dados da conta (o servidor
    /// ganha), ou — se a conta ainda estiver vazia mas já houver dados neste
    /// dispositivo (uso antes de teres conta) — oferece importá-los.
    /// Equivalente nativo do fluxo migrationAvailable/importLocalData em App.tsx.
    func hydrateFromServer() async {
        isSyncing = true
        defer { isSyncing = false }
        do {
            let remote: RemoteAllData = try await api.get("/data/all")
            if remote.profile != nil {
                applyRemote(remote)
                migrationAvailable = false
            } else if profile != nil {
                migrationAvailable = true
            }
        } catch {
            // Sem ligação — continua com a cópia local guardada no dispositivo.
        }
    }

    private func applyRemote(_ remote: RemoteAllData) {
        profile = remote.profile
        diary = remote.diary
        water = remote.water
        exercise = remote.exercise
        customFoods = remote.customFoods
    }

    /// Envia os dados guardados neste dispositivo para a conta (preenche
    /// lacunas; o que já está na conta não é substituído — ver backend
    /// POST /data/import).
    func migrateLocalDataToServer() async {
        isSyncing = true
        defer { isSyncing = false }
        let payload = ImportPayload(
            profile: profile, diary: diary,
            water: water.mapValues { Int($0.rounded()) },
            exercise: exercise, customFoods: customFoods
        )
        if let remote: RemoteAllData = try? await api.post("/data/import", payload) {
            applyRemote(remote)
        }
        migrationAvailable = false
    }

    func dismissMigration() {
        migrationAvailable = false
    }

    /// Envios em segundo plano, best-effort: a cópia local (guardada acima)
    /// já é a fonte de verdade no dispositivo, por isso um erro de rede aqui
    /// fica só registado — a próxima escrita tenta outra vez.
    func pushProfile() {
        guard let profile else { return }
        Task { let _: Profile? = try? await api.put("/profile", profile) }
    }

    func pushDay(_ iso: String) {
        let request = DayUpsertRequest(
            entries: diary[iso] ?? [],
            waterMl: Int((water[iso] ?? 0).rounded()),
            exercises: exercise[iso] ?? []
        )
        Task { let _: DayUpsertRequest? = try? await api.put("/days/\(iso)", request) }
    }

    func pushCustomFoods() {
        let foods = customFoods
        Task { let _: [Food]? = try? await api.put("/custom-foods", foods) }
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
