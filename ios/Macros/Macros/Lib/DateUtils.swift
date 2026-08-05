//
//  DateUtils.swift
//  Macros
//
//  Utilitários de datas — equivalente de src/lib/store.ts.
//

import Foundation

enum DateUtils {
    static func todayISO() -> String {
        toISO(Date())
    }

    static func toISO(_ d: Date) -> String {
        isoDateFormatter.string(from: d)
    }

    static func shiftDate(_ iso: String, days: Int) -> String {
        guard let date = isoDateFormatter.date(from: iso) else { return iso }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone.current
        let shifted = cal.date(byAdding: .day, value: days, to: date) ?? date
        return toISO(shifted)
    }

    static func formatDatePT(_ iso: String) -> String {
        let today = todayISO()
        if iso == today { return "Hoje" }
        if iso == shiftDate(today, days: -1) { return "Ontem" }
        if iso == shiftDate(today, days: 1) { return "Amanhã" }
        guard let date = isoDateFormatter.date(from: iso) else { return iso }
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_PT")
        f.setLocalizedDateFormatFromTemplate("EEEd MMM")
        return f.string(from: date)
    }

    static func longDateLabel(_ iso: String) -> String {
        guard let date = isoDateFormatter.date(from: iso) else { return iso }
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_PT")
        f.dateStyle = .full
        return f.string(from: date)
    }

    /// A refeição provável para a hora atual.
    static func mealForNow(_ now: Date = Date()) -> MealId {
        let h = Calendar.current.component(.hour, from: now)
        if h < 6 { return .madrugada }
        if h < 11 { return .breakfast }
        if h < 15 { return .lunch }
        if h < 19 { return .snack }
        if h < 23 { return .dinner }
        return .supper
    }
}

func uid() -> String { UUID().uuidString }
