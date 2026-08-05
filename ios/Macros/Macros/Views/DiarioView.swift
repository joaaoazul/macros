//
//  DiarioView.swift
//  Macros
//
//  Diário do dia, resumo, água e exercício — equivalente nativo de
//  src/components/Diario.tsx.
//

import SwiftUI

struct DiarioView: View {
    @EnvironmentObject var store: AppStore
    let profile: Profile

    @State private var date: String = DateUtils.todayISO()
    @State private var addingTo: MealId?
    @State private var addingExercise = false
    @State private var customWaterText = ""

    private var entries: [Entry] { store.entries(on: date) }
    private var totals: DayTotals { sumEntries(entries) }
    private var dayExercises: [Exercise] { store.exercises(on: date) }
    private var burned: Double { dayExercises.reduce(0) { $0 + $1.kcal } }
    private var waterMl: Double { store.waterAmount(on: date) }
    private var targets: Targets { profile.targets }
    private var eaten: Int { Int(totals.kcal.rounded()) }
    private var net: Int { eaten - Int(burned.rounded()) }
    private var remaining: Int { targets.kcal - net }
    private var isToday: Bool { date >= DateUtils.todayISO() }

    var body: some View {
        ScrollView {
            LargeTitleHeader(title: DateUtils.formatDatePT(date), subtitle: nil) {
                HStack(spacing: 8) {
                    CircleIconButton(systemImage: "chevron.left") { date = DateUtils.shiftDate(date, days: -1) }
                    CircleIconButton(systemImage: "chevron.right", action: { date = DateUtils.shiftDate(date, days: 1) }, disabled: isToday)
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(DateUtils.longDateLabel(date))
                    .font(.system(size: 13))
                    .foregroundStyle(AppColor.muted)
                if date != DateUtils.todayISO() {
                    Button("Voltar a hoje") { date = DateUtils.todayISO() }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(AppColor.accent)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.bottom, 8)

            VStack(spacing: 14) {
                heroCard
                ForEach(MEALS) { meal in mealCard(meal) }
                exerciseCard
                waterCard
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .background(AppColor.bg.ignoresSafeArea())
        .sheet(item: $addingTo) { meal in
            AddFoodSheet(meal: meal) { entry in
                store.addEntry(entry, on: date)
                addingTo = nil
            }
            .environmentObject(store)
        }
        .sheet(isPresented: $addingExercise) {
            AddExerciseSheet { ex in
                store.addExercise(ex, on: date)
                addingExercise = false
            }
        }
    }

    // MARK: - Cartão principal

    private var heroCard: some View {
        Card {
            HStack(alignment: .center, spacing: 20) {
                RingsView(rings: [
                    RingSpec(value: totals.carbs, target: Double(targets.carbs), color: AppColor.carbs, label: "Hidratos"),
                    RingSpec(value: totals.protein, target: Double(targets.protein), color: AppColor.protein, label: "Proteína"),
                    RingSpec(value: totals.fat, target: Double(targets.fat), color: AppColor.fat, label: "Gordura"),
                ]) {
                    VStack(spacing: 2) {
                        Text("\(abs(remaining))")
                            .font(.system(size: 28, weight: .bold))
                            .monospacedDigit()
                        Text(remaining >= 0 ? "kcal restantes" : "kcal a mais")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(AppColor.muted)
                            .multilineTextAlignment(.center)
                    }
                }

                VStack(spacing: 10) {
                    MacroStatRow(label: "Hidratos", value: totals.carbs, target: targets.carbs, unit: "g", color: AppColor.carbs)
                    MacroStatRow(label: "Proteína", value: totals.protein, target: targets.protein, unit: "g", color: AppColor.protein)
                    MacroStatRow(label: "Gordura", value: totals.fat, target: targets.fat, unit: "g", color: AppColor.fat)
                }
            }

            Divider().overlay(AppColor.line).padding(.vertical, 12)

            (
                Text("\(eaten)").fontWeight(.semibold).foregroundStyle(AppColor.ink2)
                    + Text(" ingeridas − ").foregroundStyle(AppColor.muted)
                    + Text("\(Int(burned.rounded()))").fontWeight(.semibold).foregroundStyle(AppColor.ink2)
                    + Text(" exercício = ").foregroundStyle(AppColor.muted)
                    + Text("\(net)").fontWeight(.semibold).foregroundStyle(AppColor.ink2)
                    + Text(" / \(targets.kcal) kcal").foregroundStyle(AppColor.muted)
            )
            .font(.system(size: 13))
            .monospacedDigit()
            .frame(maxWidth: .infinity)
            .multilineTextAlignment(.center)
        }
    }

    // MARK: - Refeições

    private func mealCard(_ meal: MealInfo) -> some View {
        let mealEntries = entries.filter { $0.meal == meal.id }
        let t = sumEntries(mealEntries)

        return BareCard {
            VStack(spacing: 0) {
                HStack {
                    Text(meal.label).font(.system(size: 17, weight: .semibold))
                    Spacer()
                    if t.kcal > 0 {
                        Text("\(Int(t.kcal.rounded())) kcal")
                            .font(.system(size: 13))
                            .foregroundStyle(AppColor.muted)
                            .monospacedDigit()
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, mealEntries.isEmpty ? 12 : 0)

                if !mealEntries.isEmpty {
                    VStack(spacing: 0) {
                        Divider().overlay(AppColor.line)
                        ForEach(mealEntries) { entry in
                            entryRow(entry)
                            if entry.id != mealEntries.last?.id {
                                Divider().overlay(AppColor.line).padding(.leading, 20)
                            }
                        }
                    }
                    .padding(.top, 12)
                }

                Divider().overlay(AppColor.line)
                Button {
                    addingTo = meal.id
                } label: {
                    Text("＋ Adicionar alimento")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AppColor.accent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
            }
        }
    }

    private func entryRow(_ entry: Entry) -> some View {
        HStack(spacing: 12) {
            Text(entry.emoji).font(.system(size: 18))
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.foodName).font(.system(size: 15, weight: .medium)).lineLimit(1)
                Text("\(Int(entry.grams)) \(entry.unit.rawValue) · H \(Int(entry.carbs.rounded())) · P \(Int(entry.protein.rounded())) · G \(Int(entry.fat.rounded()))")
                    .font(.system(size: 12))
                    .foregroundStyle(AppColor.muted)
            }
            Spacer()
            Text("\(Int(entry.kcal.rounded()))")
                .font(.system(size: 15, weight: .semibold))
                .monospacedDigit()
            Button {
                store.removeEntry(id: entry.id, on: date)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AppColor.muted)
                    .padding(6)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
    }

    // MARK: - Exercício

    private var exerciseCard: some View {
        BareCard {
            VStack(spacing: 0) {
                HStack {
                    Text("Exercício").font(.system(size: 17, weight: .semibold))
                    Spacer()
                    Text("\(Int(burned.rounded())) kcal")
                        .font(.system(size: 13)).foregroundStyle(AppColor.muted).monospacedDigit()
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, dayExercises.isEmpty ? 12 : 0)

                if !dayExercises.isEmpty {
                    VStack(spacing: 0) {
                        Divider().overlay(AppColor.line)
                        ForEach(dayExercises) { ex in
                            HStack(spacing: 12) {
                                Text("🏃").font(.system(size: 18))
                                Text(ex.name).font(.system(size: 15, weight: .medium)).lineLimit(1)
                                Spacer()
                                Text("−\(Int(ex.kcal.rounded()))")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(AppColor.good)
                                    .monospacedDigit()
                                Button {
                                    store.removeExercise(id: ex.id, on: date)
                                } label: {
                                    Image(systemName: "xmark")
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundStyle(AppColor.muted)
                                        .padding(6)
                                }
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 8)
                            if ex.id != dayExercises.last?.id {
                                Divider().overlay(AppColor.line).padding(.leading, 20)
                            }
                        }
                    }
                    .padding(.top, 12)
                }

                Divider().overlay(AppColor.line)
                Button {
                    addingExercise = true
                } label: {
                    Text("＋ Adicionar exercício")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AppColor.accent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
            }
        }
    }

    // MARK: - Água

    private var waterCard: some View {
        let target = max(targets.waterMl, 1)
        let dropCount = max(Int((Double(target) / 250).rounded(.up)), 1)
        let pct = Int((waterMl / Double(target) * 100).rounded())

        return Card {
            HStack {
                Text("Água").font(.system(size: 17, weight: .semibold))
                Spacer()
                Text("\(Int(waterMl)) / \(target) ml · \(pct)%")
                    .font(.system(size: 13)).foregroundStyle(AppColor.muted).monospacedDigit()
            }

            LazyVGrid(columns: Array(repeating: GridItem(.fixed(22), spacing: 6), count: min(dropCount, 12)), spacing: 6) {
                ForEach(0..<dropCount, id: \.self) { i in
                    Image(systemName: "drop.fill")
                        .font(.system(size: 15))
                        .foregroundStyle(waterMl >= Double(i + 1) * 250 ? AppColor.water : AppColor.line)
                }
            }
            .padding(.top, 10)

            HStack(spacing: 8) {
                waterButton("+250 ml") { store.addWater(250, on: date) }
                waterButton("+500 ml") { store.addWater(500, on: date) }
                Button("−250") { store.addWater(-250, on: date) }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(AppColor.muted)
                    .disabled(waterMl == 0)
                    .opacity(waterMl == 0 ? 0.4 : 1)
            }
            .padding(.top, 14)

            HStack(spacing: 8) {
                TextField("Outra quantidade (ml)", text: $customWaterText)
                    .keyboardType(.numberPad)
                    .textFieldStyle(MacrosFieldStyle())
                Button("Adicionar") {
                    if let ml = Double(customWaterText), ml > 0 {
                        store.addWater(ml, on: date)
                        customWaterText = ""
                    }
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(AppColor.accent)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(AppColor.accentSoft)
                .clipShape(Capsule())
                .disabled(!((Double(customWaterText) ?? 0) > 0))
            }
            .padding(.top, 8)
        }
    }

    private func waterButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(AppColor.accent)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(AppColor.accentSoft)
            .clipShape(Capsule())
    }
}

// MARK: - Adicionar exercício

struct AddExerciseSheet: View {
    var onAdd: (Exercise) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var kcal = ""

    private var valid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && (Double(kcal) ?? 0) > 0
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                TextField("Ex.: corrida, ginásio, caminhada…", text: $name)
                    .textFieldStyle(MacrosFieldStyle())
                TextField("Calorias queimadas", text: $kcal)
                    .keyboardType(.numberPad)
                    .textFieldStyle(MacrosFieldStyle())
                PrimaryButton(title: "Adicionar", disabled: !valid) {
                    onAdd(Exercise(id: uid(), name: name.trimmingCharacters(in: .whitespaces), kcal: Double(kcal) ?? 0))
                }
                Spacer()
            }
            .padding(20)
            .background(AppColor.bg.ignoresSafeArea())
            .navigationTitle("Adicionar exercício")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }
}
