//
//  OnboardingView.swift
//  Macros
//
//  Fluxo inicial em 4 passos — equivalente nativo de src/components/Onboarding.tsx.
//

import SwiftUI

struct OnboardingView: View {
    var onDone: (Profile) -> Void

    @State private var step = 0
    @State private var name = ""
    @State private var sex: Sex = .male
    @State private var age = ""
    @State private var heightCm = ""
    @State private var weightKg = ""
    @State private var activity = 1.55
    @State private var goal: Goal = .maintain
    @State private var bodyFat = ""

    private var ageN: Int? { Int(age) }
    private var heightN: Double? { Double(heightCm.replacingOccurrences(of: ",", with: ".")) }
    private var weightN: Double? { Double(weightKg.replacingOccurrences(of: ",", with: ".")) }
    private var bodyFatN: Double? {
        let t = bodyFat.trimmingCharacters(in: .whitespaces)
        return t.isEmpty ? nil : Double(t.replacingOccurrences(of: ",", with: "."))
    }
    private var bodyFatOk: Bool {
        guard let bf = bodyFatN else { return true }
        return Limits.bodyFatPct.contains(bf)
    }
    private var dataOk: Bool {
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty,
              let a = ageN, Limits.onboardingAge.contains(Double(a)),
              let h = heightN, Limits.onboardingHeight.contains(h),
              let w = weightN, Limits.onboardingWeight.contains(w)
        else { return false }
        return bodyFatOk
    }

    private var targets: Targets? {
        guard dataOk, let a = ageN, let h = heightN, let w = weightN else { return nil }
        return Calc.computeTargets(sex: sex, weightKg: w, heightCm: h, age: a, activity: activity, goal: goal, bodyFatPct: bodyFatN)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                ForEach(0..<4, id: \.self) { i in
                    Capsule()
                        .fill(i <= step ? AppColor.accent : AppColor.line)
                        .frame(height: 4)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)
            .padding(.bottom, 24)

            Group {
                switch step {
                case 0: stepBasics
                case 1: stepActivity
                case 2: stepGoal
                default: stepSummary
                }
            }
            .frame(maxHeight: .infinity, alignment: .top)
        }
        .background(AppColor.bg.ignoresSafeArea())
    }

    // MARK: - Passo 0: dados base

    private var stepBasics: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Olá! 👋")
                .font(.system(size: 30, weight: .bold))
            Text("Vamos calcular as tuas necessidades diárias. Primeiro, fala-nos de ti.")
                .font(.system(size: 16))
                .foregroundStyle(AppColor.ink2)
                .padding(.top, 4)

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    field("Nome") {
                        TextField("O teu nome", text: $name)
                            .textFieldStyle(MacrosFieldStyle())
                    }

                    field("Sexo") {
                        HStack(spacing: 8) {
                            ForEach(Sex.allCases) { s in
                                ChoiceButton(active: sex == s, action: { sex = s }) {
                                    Text(s == .male ? "Masculino" : "Feminino")
                                        .font(.system(size: 15, weight: .medium))
                                        .frame(maxWidth: .infinity)
                                }
                            }
                        }
                    }

                    HStack(spacing: 12) {
                        field("Idade") {
                            TextField("25", text: $age)
                                .keyboardType(.numberPad)
                                .textFieldStyle(MacrosFieldStyle())
                        }
                        field("Altura (cm)") {
                            TextField("175", text: $heightCm)
                                .keyboardType(.numberPad)
                                .textFieldStyle(MacrosFieldStyle())
                        }
                        field("Peso (kg)") {
                            TextField("70", text: $weightKg)
                                .keyboardType(.decimalPad)
                                .textFieldStyle(MacrosFieldStyle())
                        }
                    }

                    field("Gordura corporal (%) — opcional") {
                        TextField("deixa vazio se não souberes", text: $bodyFat)
                            .keyboardType(.decimalPad)
                            .textFieldStyle(MacrosFieldStyle())
                    }
                    Text("Se souberes, a TMB usa Katch-McArdle em vez de Mifflin.")
                        .font(.system(size: 12))
                        .foregroundStyle(AppColor.muted)
                }
                .padding(.top, 24)
            }

            PrimaryButton(title: "Continuar", disabled: !dataOk) { step = 1 }
                .padding(.top, 16)
        }
        .padding(.horizontal, 24)
    }

    // MARK: - Passo 1: atividade

    private var stepActivity: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Nível de atividade").font(.system(size: 30, weight: .bold))
            Text("Quão ativo és no dia a dia?")
                .font(.system(size: 16)).foregroundStyle(AppColor.ink2).padding(.top, 4)

            ScrollView {
                VStack(spacing: 8) {
                    ForEach(ACTIVITY_LEVELS) { a in
                        ChoiceButton(active: activity == a.value, action: { activity = a.value }) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(a.label).font(.system(size: 15, weight: .semibold))
                                Text(a.hint).font(.system(size: 13)).foregroundStyle(AppColor.ink2)
                            }
                        }
                    }
                }
                .padding(.top, 24)
            }

            HStack(spacing: 12) {
                SecondaryButton(title: "Voltar") { step = 0 }
                PrimaryButton(title: "Continuar") { step = 2 }
            }
            .padding(.top, 16)
        }
        .padding(.horizontal, 24)
    }

    // MARK: - Passo 2: objetivo

    private var stepGoal: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Objetivo").font(.system(size: 30, weight: .bold))
            Text("O que queres alcançar?")
                .font(.system(size: 16)).foregroundStyle(AppColor.ink2).padding(.top, 4)

            ScrollView {
                VStack(spacing: 8) {
                    ForEach(GOALS) { g in
                        ChoiceButton(active: goal == g.value, action: { goal = g.value }) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(g.emoji) \(g.label)").font(.system(size: 15, weight: .semibold))
                                Text(g.hint).font(.system(size: 13)).foregroundStyle(AppColor.ink2)
                            }
                        }
                    }
                }
                .padding(.top, 24)
            }

            HStack(spacing: 12) {
                SecondaryButton(title: "Voltar") { step = 1 }
                PrimaryButton(title: "Ver o meu plano") { step = 3 }
            }
            .padding(.top, 16)
        }
        .padding(.horizontal, 24)
    }

    // MARK: - Passo 3: resumo

    private var stepSummary: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("O teu plano, \(name.trimmingCharacters(in: .whitespaces))")
                .font(.system(size: 26, weight: .bold))
            Text("Calculado com a equação de Mifflin-St Jeor. Podes ajustar tudo depois no Perfil.")
                .font(.system(size: 15)).foregroundStyle(AppColor.ink2).padding(.top, 4)

            if let t = targets {
                ScrollView {
                    VStack(spacing: 12) {
                        Card {
                            VStack(spacing: 4) {
                                Text("CALORIAS DIÁRIAS")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(AppColor.muted)
                                Text("\(t.kcal)")
                                    .font(.system(size: 44, weight: .bold))
                                    .monospacedDigit()
                                Text("kcal").font(.system(size: 13)).foregroundStyle(AppColor.muted)
                            }
                            .frame(maxWidth: .infinity)
                        }

                        HStack(spacing: 12) {
                            macroSummary(color: AppColor.protein, label: "Proteína", grams: t.protein)
                            macroSummary(color: AppColor.carbs, label: "Hidratos", grams: t.carbs)
                            macroSummary(color: AppColor.fat, label: "Gordura", grams: t.fat)
                        }
                    }
                    .padding(.top, 24)
                }

                HStack(spacing: 12) {
                    SecondaryButton(title: "Voltar") { step = 2 }
                    PrimaryButton(title: "Começar 🚀") {
                        guard let a = ageN, let h = heightN, let w = weightN else { return }
                        onDone(Profile(
                            name: name.trimmingCharacters(in: .whitespaces),
                            sex: sex, age: a, heightCm: h, weightKg: w,
                            activity: activity, goal: goal, targets: t,
                            birthdate: nil, bodyFatPct: bodyFatN
                        ))
                    }
                }
                .padding(.top, 16)
            }
        }
        .padding(.horizontal, 24)
    }

    private func macroSummary(color: Color, label: String, grams: Int) -> some View {
        Card {
            VStack(spacing: 6) {
                Circle().fill(color).frame(width: 8, height: 8)
                Text("\(grams) g").font(.system(size: 18, weight: .bold)).monospacedDigit()
                Text(label).font(.system(size: 11)).foregroundStyle(AppColor.muted)
            }
            .frame(maxWidth: .infinity)
        }
    }

    private func field<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.system(size: 13, weight: .medium)).foregroundStyle(AppColor.ink2)
            content()
        }
    }
}

struct MacrosFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(AppColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

#Preview {
    OnboardingView(onDone: { _ in })
}
