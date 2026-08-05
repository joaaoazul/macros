//
//  AuthModels.swift
//  Macros
//
//  Pedidos/respostas de autenticação — equivalente nativo de
//  backend/app/auth/schemas.py (só os campos usados pela app iOS).
//

import Foundation

struct RegisterRequest: Encodable {
    var email: String
    var password: String
    var name: String
}

struct LoginRequest: Encodable {
    var email: String
    var password: String
}

struct UserAccount: Codable, Equatable {
    var id: Int
    var email: String
    var name: String
    var emailVerified: Bool
    var isAdmin: Bool

    enum CodingKeys: String, CodingKey {
        case id, email, name
        case emailVerified = "email_verified"
        case isAdmin = "is_admin"
    }
}

struct MessageResponse: Decodable {
    let message: String
}

struct ForgotPasswordRequest: Encodable {
    var email: String
}

/// Equivalente a DeleteAccountRequest (backend/app/data/schemas.py) — usado
/// por DELETE /gdpr/account.
struct DeleteAccountRequest: Encodable {
    var password: String
}
