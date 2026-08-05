//
//  ProgressoView.swift
//  Macros
//
//  Estatísticas e gráfico semanal — equivalente nativo de
//  src/components/Progresso.tsx.
//

import SwiftUI
import Charts

private struct DayPoint: Identifiable {
    let iso: String
    let label: String
    let kcal: Double
    let protein: Double
    let carbs: Double
    let fat: Double
    let burned: Double
    let logged: Bool
    let onPlan: Bool
    var id: String { iso }
}

struct ProgressoView: View {
    @EnvironmentObject var store: AppStore
    let profile: Profile

    @State private var period = 7
    @State private var showTable = false
    private let periods = [7, 14, 30]

    private var targets: Targets { profile.targets }

    private var days: [DayPoint] {
        let today = DateUtils.todayISO()
        return (0..<period).map { i in
            let iso = DateUtils.shiftDate(today, days: i - (period - 1))
            let entries = store.entries(on: iso)
            let t = sumEntries(entries)
            let burned = store.exercises(on: iso).reduce(0) { $0 + $1.kcal }
            let net = t.kcal - burned
            let logged = !entries.isEmpty
            let onPlan = logged && net >= Double(targets.kcal) * 0.9 && net <= Double(targets.kcal) * 1.1
            let label = shortWeekday(iso, singleLetter: period > 7)
            return DayPoint(iso: iso, label: label, kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat, burned: burned, logged: logged, onPlan: onPlan)
        }
    }

    private var loggedDays: [DayPoint] { days.filter { $0.logged } }
    private var nLogged: Int { loggedDays.count }
    private var avgKcal: Int { nLogged > 0 ? Int((loggedDays.reduce(0) { $0 + $1.kcal } / Double(nLogged)).rounded()) : 0 }
    private var onPlanDays: Int { days.filter { $0.onPlan }.count }
    private var adherence: Int { nLogged > 0 ? Int((Double(onPlanDays) / Double(nLogged) * 100).rounded()) : 0 }
    private var proteinRate: Int {
        guard nLogged > 0 else { return 0 }
        let hits = loggedDays.filter { $0.protein >= Double(targets.protein) * 0.9 }.count
        return Int((Double(hits) / Double(nLogged) * 100).rounded())
    }

    private var streak: Int {
        let today = DateUtils.todayISO()
        var s = 0
        var i = store.entries(on: today).isEmpty ? 1 : 0
        while !store.entries(on: DateUtils.shiftDate(today, days: -i)).isEmpty {
            s += 1
            i += 1
        }
        return s
    }

    private var macroAttain: (carbs: Int, protein: Int, fat: Int) {
        func avg(_ sel: (DayPoint) -> Double, _ target: Int) -> Int {
            guard nLogged > 0, target > 0 else { return 0 }
            return Int((loggedDays.reduce(0) { $0 + sel($1) } / Double(nLogged) / Double(target) * 100).rounded())
        }
        return (avg({ $0.carbs }, targets.carbs), avg({ $0.protein }, targets.protein), avg({ $0.fat }, targets.fat))
    }

    var body: some View {
        ScrollView {
            LargeTitleHeader(title: "Progresso", subtitle: "Últimos \(period) dias")

            Picker("Período", selection: $period) {
                ForEach(periods, id: \.self) { p in Text("\(p) dias").tag(p) }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.top, 4)

            VStack(spacing: 14) {
                HStack(spacing: 12) {
                    statTile("\(adherence)%", "no plano (\(onPlanDays)/\(nLogged))")
                    statTile("\(proteinRate)%", "metas de proteína")
                    statTile(streak > 0 ? "\(streak) 🔥" : "0", streak == 1 ? "dia seguido" : "dias seguidos")
                }
                .padding(.top, 14)

                if nLogged > 0 {
                    Card {
                        Text("Atingimento médio").font(.system(size: 17, weight: .semibold))
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text("média do consumo vs. meta, nos \(nLogged) dias registados")
                            .font(.system(size: 12)).foregroundStyle(AppColor.muted)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        VStack(spacing: 10) {
                            AttainmentBar(label: "Hidratos", pct: macroAttain.carbs, color: AppColor.carbs)
                            AttainmentBar(label: "Proteína", pct: macroAttain.protein, color: AppColor.protein)
                            AttainmentBar(label: "Gordura", pct: macroAttain.fat, color: AppColor.fat)
                            AttainmentBar(label: "Calorias", pct: nLogged > 0 ? Int((Double(avgKcal) / Double(targets.kcal) * 100).rounded()) : 0, color: AppColor.accent)
                        }
                        .padding(.top, 10)
                    }
                }

                Card {
                    Text("Calendário").font(.system(size: 17, weight: .semibold))
                        .frame(maxWidth: .infinity, alignment: .leading)
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(26), spacing: 6), count: 10), spacing: 6) {
                        ForEach(days) { d in
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(d.onPlan ? AppColor.good : d.logged ? AppColor.accentSoft : AppColor.line)
                                .frame(width: 26, height: 26)
                        }
                    }
                    .padding(.top, 10)

                    HStack(spacing: 16) {
                        calendarLegend(AppColor.good, "no plano")
                        calendarLegend(AppColor.accentSoft, "registado")
                        calendarLegend(AppColor.line, "sem registo")
                    }
                    .padding(.top, 10)
                }

                Card {
                    HStack {
                        Text("Calorias por dia").font(.system(size: 17, weight: .semibold))
                        Spacer()
                        Button(showTable ? "Ver gráfico" : "Ver tabela") { showTable.toggle() }
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(AppColor.accent)
                    }

                    if !showTable {
                        Chart {
                            ForEach(days) { d in
                                BarMark(x: .value("Dia", d.label), y: .value("kcal", d.logged ? d.kcal : 0))
                                    .foregroundStyle(d.onPlan ? AppColor.good : AppColor.accent)
                                    .cornerRadius(3)
                            }
                            RuleMark(y: .value("Meta", targets.kcal))
                                .foregroundStyle(AppColor.muted)
                                .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                        }
                        .frame(height: 180)
                        .padding(.top, 12)
                    } else {
                        dayTable
                    }
                }

                Text("Alvo diário: \(targets.kcal) kcal · H \(targets.carbs) g · P \(targets.protein) g · G \(targets.fat) g")
                    .font(.system(size: 12))
                    .foregroundStyle(AppColor.muted)
                    .multilineTextAlignment(.center)
                    .padding(.top, 4)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .background(AppColor.bg.ignoresSafeArea())
    }

    private var dayTable: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Dia").frame(width: 50, alignment: .leading)
                Spacer()
                Text("kcal").frame(width: 50, alignment: .trailing)
                Text("P").frame(width: 34, alignment: .trailing)
                Text("H").frame(width: 34, alignment: .trailing)
                Text("G").frame(width: 34, alignment: .trailing)
            }
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(AppColor.muted)
            .padding(.bottom, 6)

            ForEach(days.reversed()) { d in
                HStack {
                    Text(String(d.iso.dropFirst(5))).frame(width: 50, alignment: .leading)
                    Spacer()
                    Text(d.logged ? "\(Int(d.kcal.rounded()))" : "—").frame(width: 50, alignment: .trailing)
                    Text(d.logged ? "\(Int(d.protein.rounded()))" : "—").frame(width: 34, alignment: .trailing)
                    Text(d.logged ? "\(Int(d.carbs.rounded()))" : "—").frame(width: 34, alignment: .trailing)
                    Text(d.logged ? "\(Int(d.fat.rounded()))" : "—").frame(width: 34, alignment: .trailing)
                }
                .font(.system(size: 13))
                .monospacedDigit()
                .padding(.vertical, 6)
                Divider().overlay(AppColor.line)
            }
        }
        .padding(.top, 8)
    }

    private func statTile(_ value: String, _ label: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.system(size: 19, weight: .bold))
            Text(label).font(.system(size: 10)).foregroundStyle(AppColor.muted).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(AppColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: Layout.cardRadius, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 1)
    }

    private func calendarLegend(_ color: Color, _ label: String) -> some View {
        HStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 3).fill(color).frame(width: 12, height: 12)
            Text(label).font(.system(size: 11)).foregroundStyle(AppColor.muted)
        }
    }

    private func shortWeekday(_ iso: String, singleLetter: Bool) -> String {
        guard let date = isoDateFormatter.date(from: iso) else { return "" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_PT")
        f.dateFormat = "EEE"
        let s = f.string(from: date)
        return singleLetter ? String(s.prefix(1)) : String(s.prefix(3))
    }
}
