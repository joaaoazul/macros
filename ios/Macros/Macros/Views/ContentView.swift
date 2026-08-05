//
//  ContentView.swift
//  Macros
//
//  Tab bar principal — equivalente nativo do App.tsx (sem Social/Receitas/
//  billing, fora do âmbito da conversão "core tracking").
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        if store.profile != nil {
            TabView {
                DiarioView(profile: Calc.withWaterTarget(store.profile!))
                    .tabItem { Label("Diário", systemImage: "book.fill") }

                MetasView(profile: profileBinding)
                    .tabItem { Label("Metas", systemImage: "scope") }

                ProgressoView(profile: Calc.withWaterTarget(store.profile!))
                    .tabItem { Label("Progresso", systemImage: "chart.bar.fill") }

                PerfilView(profile: profileBinding)
                    .tabItem { Label("Perfil", systemImage: "person.fill") }
            }
            .tint(AppColor.accent)
        } else {
            OnboardingView { newProfile in
                store.profile = newProfile
            }
        }
    }

    /// Perfil como Binding: ecrãs que editam (Metas, Perfil) escrevem direto na
    /// store, que persiste automaticamente.
    private var profileBinding: Binding<Profile> {
        Binding(
            get: { Calc.withWaterTarget(store.profile ?? Self.placeholder) },
            set: { store.profile = $0 }
        )
    }

    private static let placeholder = Profile(
        name: "", sex: .male, age: 30, heightCm: 170, weightKg: 70,
        activity: 1.55, goal: .maintain,
        targets: Calc.computeTargets(sex: .male, weightKg: 70, heightCm: 170, age: 30, activity: 1.55, goal: .maintain)
    )
}

#Preview {
    ContentView().environmentObject(AppStore())
}
