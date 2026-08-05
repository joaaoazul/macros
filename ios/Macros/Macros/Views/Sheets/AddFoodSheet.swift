//
//  AddFoodSheet.swift
//  Macros
//
//  Pesquisa local de alimentos, quantidades e alimentos personalizados —
//  equivalente nativo (simplificado, sem Open Food Facts) de
//  src/components/AddFoodSheet.tsx.
//

import SwiftUI

struct AddFoodSheet: View {
    let meal: MealId
    var onAdd: (Entry) -> Void

    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var selectedFood: Food?
    @State private var showingCustomFood = false

    private var usage: [String: Int] { FoodDatabase.buildUsageIndex(store.diary) }
    private var mealUsage: [MealId: [String: Int]] { FoodDatabase.buildMealUsageIndex(store.diary, today: DateUtils.todayISO()) }

    private var results: [Food] {
        if query.trimmingCharacters(in: .whitespaces).isEmpty {
            let suggestions = FoodDatabase.topFoodsForMeal(store.allFoods, index: mealUsage, meal: meal)
            if !suggestions.isEmpty { return suggestions + store.allFoods.filter { f in !suggestions.contains(where: { $0.id == f.id }) } }
        }
        return FoodDatabase.search(store.allFoods, query: query, usage: usage)
    }

    var body: some View {
        NavigationStack {
            Group {
                if let food = selectedFood {
                    QuantityView(food: food, meal: meal, onConfirm: { entry in
                        onAdd(entry)
                    }, onBack: { selectedFood = nil })
                } else {
                    List {
                        if query.isEmpty {
                            Section("Sugestões para esta refeição") {
                                foodRows
                            }
                        } else {
                            foodRows
                        }
                    }
                    .listStyle(.plain)
                    .searchable(text: $query, prompt: "Pesquisar alimento")
                }
            }
            .navigationTitle(selectedFood == nil ? "Adicionar a \(mealInfo(meal).label)" : food_title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                if selectedFood == nil {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Novo") { showingCustomFood = true }
                    }
                }
            }
            .sheet(isPresented: $showingCustomFood) {
                CustomFoodSheet { food in
                    store.addCustomFood(food)
                    selectedFood = food
                }
            }
        }
    }

    private var food_title: String { selectedFood?.displayName ?? "" }

    @ViewBuilder
    private var foodRows: some View {
        ForEach(results) { food in
            Button {
                selectedFood = food
            } label: {
                HStack(spacing: 12) {
                    Text(food.emoji).font(.system(size: 20))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(food.displayName).font(.system(size: 15, weight: .medium)).foregroundStyle(AppColor.ink)
                        Text("\(Int(food.kcal.rounded())) kcal / 100\(food.unit.rawValue) · P \(Int(food.protein.rounded())) H \(Int(food.carbs.rounded())) G \(Int(food.fat.rounded()))")
                            .font(.system(size: 12))
                            .foregroundStyle(AppColor.muted)
                    }
                    Spacer()
                    if food.custom == true {
                        Text("pessoal").font(.system(size: 11, weight: .medium)).foregroundStyle(AppColor.accent)
                    }
                }
                .padding(.vertical, 4)
            }
            .buttonStyle(.plain)
        }
        if results.isEmpty {
            EmptyStateView(emoji: "🔍", title: "Sem resultados", hint: "Tenta outro nome ou cria um alimento novo.")
        }
    }
}

/// Escolha de quantidade (gramas ou porção caseira) e confirmação do registo.
private struct QuantityView: View {
    let food: Food
    let meal: MealId
    var onConfirm: (Entry) -> Void
    var onBack: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var gramsText = "100"
    @State private var selectedPortion: Portion?

    private var grams: Double {
        if let p = selectedPortion, let mult = Double(gramsText) {
            return p.grams * mult
        }
        return Double(gramsText.replacingOccurrences(of: ",", with: ".")) ?? 0
    }

    private var factor: Double { grams / 100 }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                VStack(spacing: 6) {
                    Text(food.emoji).font(.system(size: 40))
                    Text(food.displayName).font(.system(size: 18, weight: .bold)).multilineTextAlignment(.center)
                    Text("por 100\(food.unit.rawValue): \(Int(food.kcal.rounded())) kcal")
                        .font(.system(size: 13)).foregroundStyle(AppColor.muted)
                }
                .padding(.top, 12)

                if let portions = food.portions, !portions.isEmpty {
                    Picker("Medida", selection: $selectedPortion) {
                        Text("gramas").tag(Optional<Portion>.none)
                        ForEach(portions) { p in
                            Text(p.label).tag(Optional(p))
                        }
                    }
                    .pickerStyle(.segmented)
                }

                VStack(spacing: 6) {
                    Text(selectedPortion == nil ? "Quantidade (\(food.unit.rawValue))" : "Quantas \(selectedPortion!.label.lowercased())(s)?")
                        .font(.system(size: 13, weight: .medium)).foregroundStyle(AppColor.ink2)
                    TextField("100", text: $gramsText)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.center)
                        .font(.system(size: 28, weight: .bold))
                        .padding(.vertical, 14)
                        .background(AppColor.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }

                Card {
                    HStack(spacing: 0) {
                        macroPreview("Kcal", "\(Int((food.kcal * factor).rounded()))", AppColor.ink)
                        macroPreview("Hidratos", "\(Int((food.carbs * factor).rounded()))g", AppColor.carbs)
                        macroPreview("Proteína", "\(Int((food.protein * factor).rounded()))g", AppColor.protein)
                        macroPreview("Gordura", "\(Int((food.fat * factor).rounded()))g", AppColor.fat)
                    }
                }

                PrimaryButton(title: "Adicionar a \(mealInfo(meal).label)", disabled: grams <= 0) {
                    onConfirm(makeEntry())
                    dismiss()
                }

                Button("‹ Escolher outro alimento", action: onBack)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(AppColor.accent)
            }
            .padding(20)
        }
        .background(AppColor.bg.ignoresSafeArea())
    }

    private func macroPreview(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.system(size: 15, weight: .bold)).foregroundStyle(color).monospacedDigit()
            Text(label).font(.system(size: 10)).foregroundStyle(AppColor.muted)
        }
        .frame(maxWidth: .infinity)
    }

    private func makeEntry() -> Entry {
        Entry(
            id: uid(), meal: meal, foodName: food.displayName, emoji: food.emoji,
            grams: grams.rounded(), unit: food.unit,
            kcal: food.kcal * factor, protein: food.protein * factor,
            carbs: food.carbs * factor, fat: food.fat * factor
        )
    }
}

/// Criar um alimento personalizado (valores por 100 g/ml).
struct CustomFoodSheet: View {
    var onSave: (Food) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var emoji = "🍽️"
    @State private var kcal = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var unit: FoodUnit = .g

    private var valid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && Double(kcal) != nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Alimento") {
                    TextField("Nome", text: $name)
                    TextField("Emoji", text: $emoji)
                    Picker("Unidade", selection: $unit) {
                        Text("gramas (g)").tag(FoodUnit.g)
                        Text("mililitros (ml)").tag(FoodUnit.ml)
                    }
                }
                Section("Valores por 100\(unit.rawValue)") {
                    numberField("Calorias (kcal)", $kcal)
                    numberField("Proteína (g)", $protein)
                    numberField("Hidratos (g)", $carbs)
                    numberField("Gordura (g)", $fat)
                }
            }
            .navigationTitle("Novo alimento")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") {
                        onSave(Food(
                            id: uid(), name: name.trimmingCharacters(in: .whitespaces),
                            emoji: emoji.isEmpty ? "🍽️" : emoji,
                            kcal: Double(kcal) ?? 0, protein: Double(protein) ?? 0,
                            carbs: Double(carbs) ?? 0, fat: Double(fat) ?? 0,
                            unit: unit, custom: true
                        ))
                        dismiss()
                    }.disabled(!valid)
                }
            }
        }
    }

    private func numberField(_ label: String, _ text: Binding<String>) -> some View {
        HStack {
            Text(label)
            Spacer()
            TextField("0", text: text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(width: 100)
        }
    }
}
