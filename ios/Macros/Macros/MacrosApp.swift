//
//  MacrosApp.swift
//  Macros
//
//  Ponto de entrada da app nativa. Tracker de macros e nutrição, 100% local
//  — porte para iOS/Swift de github.com/joaaoazul/macros (React + Vite).
//

import SwiftUI

@main
struct MacrosApp: App {
    @StateObject private var store = AppStore()
    @StateObject private var auth = AuthService()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(auth)
        }
    }
}
