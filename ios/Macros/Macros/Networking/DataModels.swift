//
//  DataModels.swift
//  Macros
//
//  Payloads de sincronização — equivalente nativo (subconjunto usado pelo
//  âmbito "core tracking") de backend/app/data/schemas.py. Profile, Entry,
//  Exercise e Food já usam exatamente os mesmos nomes de campo (JSON) que o
//  backend — por terem sido ambos desenhados a partir de src/types.ts — por
//  isso são reutilizados diretamente aqui.
//

import Foundation

/// Subconjunto de `AllData`: perfil, diário, água, exercício e alimentos
/// pessoais. Campos extra do backend (receitas, plano, despensa…) são
/// ignorados pelo `JSONDecoder` por não estarem fora do âmbito desta app.
struct RemoteAllData: Decodable {
    var profile: Profile?
    var diary: [String: [Entry]]
    var water: [String: Double]
    var exercise: [String: [Exercise]]
    var customFoods: [Food]
}

/// Equivalente a `DayUpsert` — substitui atomicamente as secções fornecidas
/// de um dia. `Codable` porque o backend devolve o mesmo payload de volta.
struct DayUpsertRequest: Codable {
    var entries: [Entry]?
    var waterMl: Int?
    var exercises: [Exercise]?
}

/// Equivalente a `ImportPayload` — migração única dos dados guardados neste
/// dispositivo antes de existir conta (preenche lacunas; o servidor ganha).
struct ImportPayload: Encodable {
    var profile: Profile?
    var diary: [String: [Entry]]
    var water: [String: Int]
    var exercise: [String: [Exercise]]
    var customFoods: [Food]
}
