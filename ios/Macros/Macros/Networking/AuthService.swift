//
//  AuthService.swift
//  Macros
//
//  Estado de sessão — equivalente nativo de src/lib/auth.tsx. A sessão em si
//  vive em cookies HttpOnly geridos pelo URLSession (ver APIClient); esta
//  classe só reflete se há sessão válida e faz register/login/logout.
//

import Foundation

@MainActor
final class AuthService: ObservableObject {
    enum State: Equatable {
        case loading
        case loggedOut
        case loggedIn
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var user: UserAccount?
    @Published var lastError: String?

    private let api = APIClient.shared

    /// Corre uma vez ao arrancar a app: há sessão válida (cookie ainda vivo)?
    func bootstrap() async {
        do {
            user = try await api.get("/auth/me")
            state = .loggedIn
        } catch {
            user = nil
            state = .loggedOut
        }
    }

    @discardableResult
    func register(email: String, password: String, name: String) async -> Bool {
        lastError = nil
        do {
            user = try await api.post("/auth/register", RegisterRequest(email: email, password: password, name: name))
            state = .loggedIn
            return true
        } catch {
            lastError = (error as? APIError)?.message ?? "Não foi possível criar a conta."
            return false
        }
    }

    @discardableResult
    func login(email: String, password: String) async -> Bool {
        lastError = nil
        do {
            user = try await api.post("/auth/login", LoginRequest(email: email, password: password))
            state = .loggedIn
            return true
        } catch {
            lastError = (error as? APIError)?.message ?? "Não foi possível iniciar sessão."
            return false
        }
    }

    func logout() async {
        let _: MessageResponse? = try? await api.post("/auth/logout")
        user = nil
        state = .loggedOut
    }
}
