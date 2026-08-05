//
//  PerfilView.swift
//  Macros
//
//  Peso, TMB, IMC, meta de água, objetivo e atividade — equivalente nativo
//  (simplificado para uma app 100% local, sem conta/backend) de
//  src/components/Perfil.tsx.
//

import SwiftUI
import UIKit

struct PerfilView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var auth: AuthService
    @Binding var profile: Profile

    @State private var weightText: String
    @State private var waterMlText: String
    @State private var heightText: String
    @State private var bodyFatText: String
    @State private var showLogoutConfirm = false
    @State private var showExporter = false
    @State private var loggingOut = false

    init(profile: Binding<Profile>) {
        _profile = profile
        _weightText = State(initialValue: String(format: "%g", profile.wrappedValue.weightKg))
        _waterMlText = State(initialValue: String(profile.wrappedValue.targets.waterMl))
        _heightText = State(initialValue: String(format: "%g", profile.wrappedValue.heightCm))
        _bodyFatText = State(initialValue: profile.wrappedValue.bodyFatPct.map { String(format: "%g", $0) } ?? "")
    }

    private var effectiveAge: Int { Calc.ageFromBirthdate(profile.birthdate, fallback: profile.age) }
    private var tmb: Int { Int(Calc.bmr(sex: profile.sex, weightKg: profile.weightKg, heightCm: profile.heightCm, age: effectiveAge, bodyFatPct: profile.bodyFatPct).rounded()) }
    private var imc: Double { Calc.bmi(weightKg: profile.weightKg, heightCm: profile.heightCm) }
    private var usingKatch: Bool { (profile.bodyFatPct ?? 0) > 0 }

    private func recompute(_ mutate: (inout Profile) -> Void) {
        var next = profile
        mutate(&next)
        let age = Calc.ageFromBirthdate(next.birthdate, fallback: next.age)
        next.targets = Calc.computeTargets(sex: next.sex, weightKg: next.weightKg, heightCm: next.heightCm, age: age, activity: next.activity, goal: next.goal, bodyFatPct: next.bodyFatPct)
        profile = next
        waterMlText = String(next.targets.waterMl)
    }

    var body: some View {
        ScrollView {
            LargeTitleHeader(title: profile.name, subtitle: "Perfil")

            VStack(spacing: 14) {
                bodyMetricsCard
                activityGoalSummaryCard
                weightCard
                metricsCard
                goalCard
                activityCard
                accountCard
                dataCard
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .background(AppColor.bg.ignoresSafeArea())
        .confirmationDialog("Terminar sessão?", isPresented: $showLogoutConfirm, titleVisibility: .visible) {
            Button("Terminar sessão", role: .destructive) {
                Task {
                    loggingOut = true
                    await auth.logout()
                    store.resetAll()
                    loggingOut = false
                }
            }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Os teus dados continuam guardados na tua conta — só saem deste dispositivo.")
        }
        .sheet(isPresented: $showExporter) {
            if let data = store.exportJSON(), let text = String(data: data, encoding: .utf8) {
                ShareSheet(items: [text])
            }
        }
    }

    // MARK: - Métricas do corpo

    private var bodyMetricsCard: some View {
        Card {
            HStack(spacing: 16) {
                labeledField("Altura (cm)") {
                    TextField("175", text: $heightText)
                        .keyboardType(.numberPad)
                        .onSubmit(applyHeight)
                        .font(.system(size: 17, weight: .bold))
                        .textFieldStyle(MacrosFieldStyle())
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("GÉNERO").font(.system(size: 11, weight: .semibold)).foregroundStyle(AppColor.muted)
                    Picker("Género", selection: Binding(get: { profile.sex }, set: { s in recompute { $0.sex = s } })) {
                        Text("Homem").tag(Sex.male)
                        Text("Mulher").tag(Sex.female)
                    }
                    .pickerStyle(.segmented)
                }
            }

            HStack(spacing: 16) {
                labeledField("Nascimento") {
                    DatePicker("", selection: birthdateBinding, in: ...Date(), displayedComponents: .date)
                        .labelsHidden()
                        .datePickerStyle(.compact)
                }
                labeledField("Gordura (%)") {
                    TextField("opcional", text: $bodyFatText)
                        .keyboardType(.decimalPad)
                        .onSubmit(applyBodyFat)
                        .font(.system(size: 17, weight: .bold))
                        .textFieldStyle(MacrosFieldStyle())
                }
            }
            .padding(.top, 14)

            Text("Idade: \(effectiveAge) anos")
                .font(.system(size: 11)).foregroundStyle(AppColor.muted)
                .padding(.top, 6)
        }
        .onChange(of: heightText) { _, _ in applyHeight() }
        .onChange(of: bodyFatText) { _, _ in applyBodyFat() }
    }

    private var birthdateBinding: Binding<Date> {
        Binding(
            get: { profile.birthdate.flatMap { isoDateFormatter.date(from: $0) } ?? Calendar.current.date(byAdding: .year, value: -effectiveAge, to: Date()) ?? Date() },
            set: { date in recompute { $0.birthdate = DateUtils.toISO(date) } }
        )
    }

    private func applyHeight() {
        guard let h = Double(heightText.replacingOccurrences(of: ",", with: ".")), Limits.heightCm.contains(h), h != profile.heightCm else { return }
        recompute { $0.heightCm = h }
    }

    private func applyBodyFat() {
        let t = bodyFatText.trimmingCharacters(in: .whitespaces)
        if t.isEmpty {
            if profile.bodyFatPct != nil { recompute { $0.bodyFatPct = nil } }
            return
        }
        guard let bf = Double(t.replacingOccurrences(of: ",", with: ".")), Limits.bodyFatPct.contains(bf), bf != profile.bodyFatPct else { return }
        recompute { $0.bodyFatPct = bf }
    }

    private var activityGoalSummaryCard: some View {
        Card {
            VStack(spacing: 4) {
                Text(activityInfo(profile.activity)?.label ?? "").font(.system(size: 16, weight: .bold))
                Text("NÍVEL DE ATIVIDADE").font(.system(size: 11, weight: .semibold)).foregroundStyle(AppColor.muted)
            }
            .frame(maxWidth: .infinity)
            Divider().overlay(AppColor.line).padding(.vertical, 10)
            VStack(spacing: 4) {
                Text(goalInfo(profile.goal).label).font(.system(size: 16, weight: .bold))
                Text("OBJETIVO").font(.system(size: 11, weight: .semibold)).foregroundStyle(AppColor.muted)
            }
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Peso

    private var weightCard: some View {
        Card {
            HStack(spacing: 16) {
                iconBadge("⚖️")
                VStack(alignment: .leading, spacing: 4) {
                    Text("PESO").font(.system(size: 11, weight: .semibold)).foregroundStyle(AppColor.muted)
                    HStack(spacing: 8) {
                        TextField("70", text: $weightText)
                            .keyboardType(.decimalPad)
                            .font(.system(size: 19, weight: .bold))
                            .frame(width: 80)
                        Text("kg").font(.system(size: 16, weight: .bold))
                        Spacer()
                        Button("Atualizar") {
                            guard let w = Double(weightText.replacingOccurrences(of: ",", with: ".")), Limits.weightKg.contains(w), w != profile.weightKg else { return }
                            recompute { $0.weightKg = w }
                        }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(AppColor.accent)
                        .clipShape(Capsule())
                    }
                }
            }
        }
    }

    // MARK: - Métricas

    private var metricsCard: some View {
        BareCard {
            VStack(spacing: 0) {
                metricRow("🔥", "TMB (metabolismo basal)", "\(tmb) kcal", hint: usingKatch ? "Katch-McArdle" : nil)
                Divider().overlay(AppColor.line).padding(.leading, 20)
                metricRow("📐", "IMC", String(format: "%.2f", imc), hint: imcClass(imc))
                Divider().overlay(AppColor.line).padding(.leading, 20)
                HStack(spacing: 16) {
                    iconBadge("💧")
                    VStack(alignment: .leading, spacing: 4) {
                        Text("META DE ÁGUA").font(.system(size: 11, weight: .semibold)).foregroundStyle(AppColor.muted)
                        HStack(spacing: 8) {
                            TextField("2000", text: $waterMlText)
                                .keyboardType(.numberPad)
                                .font(.system(size: 19, weight: .bold))
                                .frame(width: 90)
                            Text("ml").font(.system(size: 16, weight: .bold))
                            Spacer()
                            Button("Atualizar") {
                                guard let ml = Int(waterMlText), ml >= 500, ml <= 8000, ml != profile.targets.waterMl else { return }
                                profile.targets.waterMl = ml
                            }
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(AppColor.accent)
                            .clipShape(Capsule())
                        }
                    }
                }
                .padding(20)
            }
        }
    }

    // MARK: - Objetivo e atividade

    private var goalCard: some View {
        Card {
            Text("Objetivo").font(.system(size: 17, weight: .semibold)).frame(maxWidth: .infinity, alignment: .leading)
            VStack(spacing: 8) {
                ForEach(GOALS) { g in
                    optionRow(active: profile.goal == g.value, title: "\(g.emoji) \(g.label)", hint: g.hint) {
                        recompute { $0.goal = g.value }
                    }
                }
            }
            .padding(.top, 10)
        }
    }

    private var activityCard: some View {
        Card {
            Text("Nível de atividade").font(.system(size: 17, weight: .semibold)).frame(maxWidth: .infinity, alignment: .leading)
            VStack(spacing: 8) {
                ForEach(ACTIVITY_LEVELS) { a in
                    optionRow(active: profile.activity == a.value, title: a.label, hint: a.hint) {
                        recompute { $0.activity = a.value }
                    }
                }
            }
            .padding(.top, 10)
        }
    }

    // MARK: - Conta

    private var accountCard: some View {
        BareCard {
            VStack(spacing: 0) {
                Text("Conta")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AppColor.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20).padding(.top, 16).padding(.bottom, 4)

                if let email = auth.user?.email {
                    Text(email)
                        .font(.system(size: 15, weight: .medium))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 20).padding(.bottom, 14)
                }
                Divider().overlay(AppColor.line).padding(.leading, 20)
                Button(role: .destructive) { showLogoutConfirm = true } label: {
                    Text(loggingOut ? "A terminar sessão…" : "Terminar sessão")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(AppColor.critical)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 20).padding(.vertical, 14)
                }
                .disabled(loggingOut)
            }
        }
    }

    // MARK: - Dados locais

    private var dataCard: some View {
        BareCard {
            VStack(spacing: 0) {
                Text("Dados")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AppColor.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20).padding(.top, 16).padding(.bottom, 8)

                Button { showExporter = true } label: {
                    Text("Exportar os meus dados (JSON)")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(AppColor.accent)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 20).padding(.vertical, 14)
                }
            }
        }
    }

    // MARK: - Peças auxiliares

    private func iconBadge(_ emoji: String) -> some View {
        Text(emoji).font(.system(size: 20))
            .frame(width: 48, height: 48)
            .background(AppColor.accentSoft)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func metricRow(_ emoji: String, _ label: String, _ value: String, hint: String?) -> some View {
        HStack(spacing: 16) {
            iconBadge(emoji)
            VStack(alignment: .leading, spacing: 4) {
                Text(label.uppercased()).font(.system(size: 11, weight: .semibold)).foregroundStyle(AppColor.muted)
                HStack(spacing: 8) {
                    Text(value).font(.system(size: 19, weight: .bold)).monospacedDigit()
                    if let hint {
                        Text(hint).font(.system(size: 13)).foregroundStyle(AppColor.muted)
                    }
                }
            }
            Spacer()
        }
        .padding(20)
    }

    private func labeledField<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased()).font(.system(size: 11, weight: .semibold)).foregroundStyle(AppColor.muted)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func optionRow(active: Bool, title: String, hint: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            (Text(title).font(.system(size: 14, weight: active ? .semibold : .regular))
                + Text("  ·  \(hint)").font(.system(size: 13)).foregroundStyle(AppColor.muted))
                .foregroundStyle(AppColor.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(active ? AppColor.accentSoft : AppColor.bg)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func imcClass(_ v: Double) -> String {
        if v < 18.5 { return "abaixo do peso" }
        if v < 25 { return "peso normal" }
        if v < 30 { return "excesso de peso" }
        return "obesidade"
    }
}

/// Partilha nativa (UIActivityViewController) para exportar o JSON de dados.
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
