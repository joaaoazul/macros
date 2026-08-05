//
//  Theme.swift
//  Macros
//
//  Paleta de cores ao estilo iOS (grouped backgrounds + tint) — equivalente
//  nativo dos tokens em src/index.css. Adaptativa a claro/escuro.
//

import SwiftUI

#if canImport(UIKit)
import UIKit

extension UIColor {
    convenience init(hex: String, alpha: CGFloat = 1) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        s = s.replacingOccurrences(of: "#", with: "")
        var rgb: UInt64 = 0
        Scanner(string: s).scanHexInt64(&rgb)
        let r = CGFloat((rgb & 0xFF0000) >> 16) / 255
        let g = CGFloat((rgb & 0x00FF00) >> 8) / 255
        let b = CGFloat(rgb & 0x0000FF) / 255
        self.init(red: r, green: g, blue: b, alpha: alpha)
    }
}
#endif

extension Color {
    /// Cor adaptativa: hex diferente conforme o esquema de cores do sistema.
    static func dynamic(light: String, dark: String, alpha: CGFloat = 1) -> Color {
        #if canImport(UIKit)
        return Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? UIColor(hex: dark, alpha: alpha) : UIColor(hex: light, alpha: alpha)
        })
        #else
        return Color(hex: light, alpha: alpha)
        #endif
    }

    init(hex: String, alpha: CGFloat = 1) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        s = s.replacingOccurrences(of: "#", with: "")
        var rgb: UInt64 = 0
        Scanner(string: s).scanHexInt64(&rgb)
        let r = Double((rgb & 0xFF0000) >> 16) / 255
        let g = Double((rgb & 0x00FF00) >> 8) / 255
        let b = Double(rgb & 0x0000FF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}

/// Paleta partilhada — nomes espelham as variáveis CSS da app web original.
enum AppColor {
    static let bg = Color.dynamic(light: "F2F2F7", dark: "000000")
    static let surface = Color.dynamic(light: "FFFFFF", dark: "1C1C1E")
    static let ink = Color.dynamic(light: "0B0B0B", dark: "FFFFFF")
    static let ink2 = Color.dynamic(light: "4C4B50", dark: "C8C7CC")
    static let muted = Color.dynamic(light: "8E8E93", dark: "98989E")
    static let line = Color.dynamic(light: "E5E5EA", dark: "33333A")

    static let carbs = Color.dynamic(light: "1BAF7A", dark: "199E70")
    static let protein = Color.dynamic(light: "2A78D6", dark: "3987E5")
    static let fat = Color.dynamic(light: "EDA100", dark: "C98500")
    static let water = Color.dynamic(light: "0C7792", dark: "2494AD")
    static let accent = Color.dynamic(light: "007AFF", dark: "0A84FF")
    static let accentSoft = Color.dynamic(light: "007AFF", dark: "0A84FF", alpha: 0.14)
    static let good = Color.dynamic(light: "006300", dark: "30D158")
    static let critical = Color.dynamic(light: "D03B3B", dark: "FF6961")
}

enum Layout {
    /// Raio de widget iOS (--radius-card: 1.375rem).
    static let cardRadius: CGFloat = 22
}
