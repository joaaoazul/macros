//
//  MetasView.swift
//  Macros
//
//  Metas de calorias e repartição de macros — equivalente nativo de
//  src/components/Metas.tsx.
//

import SwiftUI

struct MetasView: View {
    @Binding var profile: Profile
    @State private var editing = false

    private var split: (carbsPct: Int, proteinPct: Int, fatPct: Int) { Calc.splitFromTargets(profile.targets) }

    var body: some View {
        ScrollView {
            LargeTitleHeader(title: "Metas", subtitle: "Os teus alvos diários")

            VStack(spacing: 14) {
                Card {
                    HStack(spacing: 16) {
                        Text("🔥")
                            .font(.system(size: 26))
                            .frame(width: 56, height: 56)
                            .background(AppColor.accentSoft)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("META DE CALORIAS")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(AppColor.muted)
                            Text("\(profile.targets.kcal) kcal")
                                .font(.system(size: 26, weight: .bold))
                                .monospacedDigit()
                        }
                        Spacer()
                    }
                }

                Card {
                    Text("Macronutrientes").font(.system(size: 17, weight: .semibold))
                        .frame(maxWidth: .infinity, alignment: .leading)

                    HStack(spacing: 8) {
                        macroCol("Hidratos", grams: profile.targets.carbs, kcal: profile.targets.carbs * 4, color: AppColor.carbs)
                        macroCol("Proteína", grams: profile.targets.protein, kcal: profile.targets.protein * 4, color: AppColor.protein)
                        macroCol("Gordura", grams: profile.targets.fat, kcal: profile.targets.fat * 9, color: AppColor.fat)
                    }
                    .padding(.top, 14)

                    DonutChart(carbsPct: split.carbsPct, proteinPct: split.proteinPct, fatPct: split.fatPct)
                        .frame(width: 190, height: 190)
                        .padding(.top, 16)
                        .frame(maxWidth: .infinity)

                    HStack(spacing: 20) {
                        legendItem("Hidratos", AppColor.carbs)
                        legendItem("Proteína", AppColor.protein)
                        legendItem("Gordura", AppColor.fat)
                    }
                    .padding(.top, 12)
                    .frame(maxWidth: .infinity)

                    Divider().overlay(AppColor.line).padding(.top, 16)
                    Button {
                        editing = true
                    } label: {
                        HStack {
                            Text("Editar macronutrientes").font(.system(size: 15, weight: .semibold))
                            Spacer()
                            Image(systemName: "chevron.right").font(.system(size: 12))
                        }
                        .foregroundStyle(AppColor.accent)
                    }
                    .padding(.top, 12)
                }

                Card {
                    HStack {
                        Text("Meta de água").font(.system(size: 17, weight: .semibold))
                        Spacer()
                        Text("💧 \(profile.targets.waterMl) ml").foregroundStyle(AppColor.ink2).monospacedDigit()
                    }
                    Text("Ajustável no Perfil — por omissão ~35 ml por kg de peso.")
                        .font(.system(size: 12)).foregroundStyle(AppColor.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 4)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .background(AppColor.bg.ignoresSafeArea())
        .sheet(isPresented: $editing) {
            EditMacrosSheet(kcal: profile.targets.kcal, split: split) { kcal, c, p, f in
                profile.targets = Calc.targetsFromSplit(kcal: kcal, carbsPct: c, proteinPct: p, fatPct: f, waterMl: profile.targets.waterMl)
                editing = false
            }
        }
    }

    private func macroCol(_ label: String, grams: Int, kcal: Int, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(label).font(.system(size: 13, weight: .bold)).foregroundStyle(color)
            Text("\(grams) g").font(.system(size: 18, weight: .bold)).monospacedDigit()
            Text("\(kcal) kcal").font(.system(size: 11)).foregroundStyle(AppColor.muted)
        }
        .frame(maxWidth: .infinity)
    }

    private func legendItem(_ label: String, _ color: Color) -> some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 10, height: 10)
            Text(label).font(.system(size: 13)).foregroundStyle(AppColor.ink2)
        }
    }
}

/// Donut da repartição de macros, desenhado com Canvas (arcos + espaçadores).
struct DonutChart: View {
    let carbsPct: Int
    let proteinPct: Int
    let fatPct: Int

    var body: some View {
        Canvas { context, size in
            let slices: [(pct: Double, color: Color)] = [
                (Double(carbsPct), AppColor.carbs),
                (Double(proteinPct), AppColor.protein),
                (Double(fatPct), AppColor.fat),
            ].filter { $0.pct > 0 }

            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let radius = min(size.width, size.height) / 2 - 22
            var start = -90.0
            let gapDegrees = 3.0

            for slice in slices {
                let sweep = slice.pct / 100 * 360
                let end = start + max(sweep - gapDegrees, 0)
                var path = Path()
                path.addArc(center: center, radius: radius, startAngle: .degrees(start), endAngle: .degrees(end), clockwise: false)
                context.stroke(path, with: .color(slice.color), style: StrokeStyle(lineWidth: 38, lineCap: .round))
                start += sweep
            }
        }
        .accessibilityLabel("Repartição: hidratos \(carbsPct)%, proteína \(proteinPct)%, gordura \(fatPct)%")
    }
}

/// Editar meta de calorias e repartição percentual de macros.
private struct EditMacrosSheet: View {
    let kcal: Int
    let split: (carbsPct: Int, proteinPct: Int, fatPct: Int)
    var onSave: (Int, Int, Int, Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var kcalText: String
    @State private var carbsText: String
    @State private var proteinText: String
    @State private var fatText: String

    init(kcal: Int, split: (carbsPct: Int, proteinPct: Int, fatPct: Int), onSave: @escaping (Int, Int, Int, Int) -> Void) {
        self.kcal = kcal
        self.split = split
        self.onSave = onSave
        _kcalText = State(initialValue: String(kcal))
        _carbsText = State(initialValue: String(split.carbsPct))
        _proteinText = State(initialValue: String(split.proteinPct))
        _fatText = State(initialValue: String(split.fatPct))
    }

    private var total: Int { (Int(carbsText) ?? 0) + (Int(proteinText) ?? 0) + (Int(fatText) ?? 0) }
    private var kcalN: Int { Int(kcalText) ?? 0 }
    private var valid: Bool { total == 100 && kcalN >= 800 && kcalN <= 8000 }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                fieldLabeled("Meta de calorias (kcal)") {
                    TextField("kcal", text: $kcalText)
                        .keyboardType(.numberPad)
                        .textFieldStyle(MacrosFieldStyle())
                        .font(.system(size: 17, weight: .semibold))
                }

                HStack(spacing: 12) {
                    pctField("Hidratos", AppColor.carbs, $carbsText)
                    pctField("Proteína", AppColor.protein, $proteinText)
                    pctField("Gordura", AppColor.fat, $fatText)
                }

                Text(total == 100 ? "Total: 100%" : "Total: \(total)% (tem de somar 100)")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(total == 100 ? AppColor.good : AppColor.critical)

                PrimaryButton(title: "Guardar", disabled: !valid) {
                    onSave(kcalN, Int(carbsText) ?? 0, Int(proteinText) ?? 0, Int(fatText) ?? 0)
                    dismiss()
                }
                Spacer()
            }
            .padding(20)
            .background(AppColor.bg.ignoresSafeArea())
            .navigationTitle("Editar macronutrientes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func fieldLabeled<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.system(size: 13, weight: .medium)).foregroundStyle(AppColor.ink2)
            content()
        }
    }

    private func pctField(_ label: String, _ color: Color, _ text: Binding<String>) -> some View {
        VStack(spacing: 6) {
            Text(label).font(.system(size: 13, weight: .bold)).foregroundStyle(color)
            TextField("0", text: text)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.center)
                .font(.system(size: 17, weight: .semibold))
                .padding(.vertical, 12)
                .background(AppColor.surface)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }
}
