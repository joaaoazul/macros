//
//  APIClient.swift
//  Macros
//
//  Cliente HTTP para o backend FastAPI (../backend). Sessão por cookies
//  HttpOnly (como um browser) — sem tokens manuais. Ver backend/app/main.py.
//

import Foundation

struct APIError: Error, LocalizedError {
    let status: Int
    let message: String
    var errorDescription: String? { message }
}

final class APIClient {
    static let shared = APIClient()

    /// Servidor por omissão — o mesmo backend usado pela app web.
    static let defaultBaseURL = "https://macros.joaoazul.dev"
    private static let baseURLKey = "macros.serverURL"

    /// Editável (ecrã de login, secção "Servidor") — útil para apontar a um
    /// backend local em desenvolvimento. Ligações a `localhost`/`127.0.0.1`
    /// não passam por HTTPS (App Transport Security isenta o loopback).
    var baseURLString: String {
        get { UserDefaults.standard.string(forKey: Self.baseURLKey) ?? Self.defaultBaseURL }
        set { UserDefaults.standard.set(newValue, forKey: Self.baseURLKey) }
    }

    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = .shared
        config.httpShouldSetCookies = true
        config.httpCookieAcceptPolicy = .always
        return URLSession(configuration: config)
    }()

    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    private struct EmptyBody: Encodable {}
    private struct ServerDetail: Decodable { let detail: String? }

    private func url(for path: String) -> URL {
        var base = baseURLString
        if base.hasSuffix("/") { base.removeLast() }
        // Um "Servidor" mal escrito (ecrã de login) não deve rebentar a app —
        // cai para o servidor por omissão em vez de crashar.
        if let url = URL(string: base + "/api/v1" + path) { return url }
        return URL(string: Self.defaultBaseURL + "/api/v1" + path)!
    }

    @discardableResult
    private func send<Body: Encodable, Response: Decodable>(_ path: String, method: String, body: Body?) async throws -> Response {
        var request = URLRequest(url: url(for: path))
        request.httpMethod = method
        // CSRF belt-and-braces do backend: pedidos que mudam estado precisam
        // deste header (ver csrf_header_guard em backend/app/main.py).
        if method != "GET" {
            request.setValue("fetch", forHTTPHeaderField: "X-Requested-With")
        }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError(status: -1, message: "Sem ligação ao servidor.")
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError(status: -1, message: "Resposta inválida do servidor.")
        }
        guard (200..<300).contains(http.statusCode) else {
            let detail = (try? decoder.decode(ServerDetail.self, from: data))?.detail
            throw APIError(status: http.statusCode, message: detail ?? "Erro do servidor (\(http.statusCode)).")
        }
        return try decoder.decode(Response.self, from: data)
    }

    func get<Response: Decodable>(_ path: String) async throws -> Response {
        try await send(path, method: "GET", body: Optional<EmptyBody>.none)
    }

    func post<Body: Encodable, Response: Decodable>(_ path: String, _ body: Body) async throws -> Response {
        try await send(path, method: "POST", body: body)
    }

    func post<Response: Decodable>(_ path: String) async throws -> Response {
        try await send(path, method: "POST", body: Optional<EmptyBody>.none)
    }

    func put<Body: Encodable, Response: Decodable>(_ path: String, _ body: Body) async throws -> Response {
        try await send(path, method: "PUT", body: body)
    }
}
