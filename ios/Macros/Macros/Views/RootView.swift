//
//  RootView.swift
//  Macros
//
//  Porta de entrada: sessão → dados da conta (ou migração dos dados locais)
//  → onboarding/tabs. Equivalente nativo do topo de App.tsx (sem paywall —
//  billing fica fora do âmbito desta conversão; ver ios/README.md).
//

import SwiftUI

struct RootView: View {
    @EnvironmentObject var auth: AuthService

    var body: some View {
        Group {
            switch auth.state {
            case .loading:
                SplashView()
            case .loggedOut:
                AuthFlowView()
            case .loggedIn:
                AuthenticatedRootView()
            }
        }
        .task {
            if auth.state == .loading { await auth.bootstrap() }
        }
    }
}

private struct AuthenticatedRootView: View {
    @EnvironmentObject var store: AppStore
    @State private var didHydrate = false

    var body: some View {
        Group {
            if !didHydrate {
                SplashView()
            } else if store.migrationAvailable {
                MigrationPromptView()
            } else {
                ContentView()
            }
        }
        .task {
            guard !didHydrate else { return }
            await store.hydrateFromServer()
            didHydrate = true
        }
    }
}

struct SplashView: View {
    var body: some View {
        VStack {
            Text("🥗").font(.system(size: 40))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppColor.bg.ignoresSafeArea())
    }
}

/// Há dados guardados neste dispositivo de antes de teres conta — importar
/// ou começar do zero. Equivalente nativo de MigrationPrompt em App.tsx.
struct MigrationPromptView: View {
    @EnvironmentObject var store: AppStore
    @State private var busy = false

    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("📦").font(.system(size: 44))
            Text("Dados neste dispositivo").font(.system(size: 22, weight: .bold))
            Text("Encontrámos dados de macros guardados neste iPhone, de antes de teres conta. Queres importá-los?")
                .font(.system(size: 15))
                .foregroundStyle(AppColor.ink2)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 12)
            Spacer()

            PrimaryButton(title: busy ? "A importar…" : "Importar dados", disabled: busy) {
                Task {
                    busy = true
                    await store.migrateLocalDataToServer()
                    busy = false
                }
            }
            Button("Começar do zero") { store.resetAll() }
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(AppColor.muted)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppColor.bg.ignoresSafeArea())
    }
}
