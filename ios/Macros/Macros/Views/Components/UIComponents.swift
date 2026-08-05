//
//  UIComponents.swift
//  Macros
//
//  Peças partilhadas do estilo iOS — equivalente nativo de src/components/ui.tsx.
//

import SwiftUI

/// Cartão "inset grouped" ao estilo iOS.
struct Card<Content: View>: View {
    var padding: CGFloat = 20
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .background(AppColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: Layout.cardRadius, style: .continuous))
            .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 1)
    }
}

/// Variante do cartão sem padding próprio (para listas internas com divisores).
struct BareCard<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .background(AppColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: Layout.cardRadius, style: .continuous))
            .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 1)
    }
}

/// Large title de ecrã (título grande + subtítulo pequeno por cima).
struct LargeTitleHeader<Trailing: View>: View {
    let title: String
    var subtitle: String? = nil
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 2) {
                if let subtitle {
                    Text(subtitle.uppercased())
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(AppColor.muted)
                        .tracking(0.3)
                }
                Text(title)
                    .font(.system(size: 34, weight: .bold))
                    .foregroundStyle(AppColor.ink)
            }
            Spacer()
            trailing
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 6)
    }
}

extension LargeTitleHeader where Trailing == EmptyView {
    init(title: String, subtitle: String? = nil) {
        self.title = title
        self.subtitle = subtitle
        self.trailing = EmptyView()
    }
}

/// Botão circular "ghost" (setas de navegação de dias).
struct CircleIconButton: View {
    let systemImage: String
    let action: () -> Void
    var disabled: Bool = false

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(AppColor.accent)
                .frame(width: 34, height: 34)
                .background(AppColor.surface)
                .clipShape(Circle())
                .shadow(color: .black.opacity(0.06), radius: 2, x: 0, y: 1)
        }
        .disabled(disabled)
        .opacity(disabled ? 0.3 : 1)
    }
}

/// Botão principal, pílula cheia de cor de destaque.
struct PrimaryButton: View {
    let title: String
    var disabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .foregroundStyle(.white)
                .background(AppColor.accent)
                .clipShape(Capsule())
        }
        .disabled(disabled)
        .opacity(disabled ? 0.4 : 1)
    }
}

/// Botão secundário, pílula em tom suave.
struct SecondaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .padding(.horizontal, 24)
                .padding(.vertical, 14)
                .foregroundStyle(AppColor.ink)
                .background(AppColor.surface)
                .clipShape(Capsule())
        }
    }
}

/// Botão de escolha (usado no onboarding e nos seletores de nível/objetivo).
struct ChoiceButton<Content: View>: View {
    let active: Bool
    let action: () -> Void
    @ViewBuilder var content: Content

    var body: some View {
        Button(action: action) {
            content
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(active ? AppColor.accentSoft : AppColor.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(active ? AppColor.accent : .clear, lineWidth: 1.5)
                )
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

/// Estado vazio: emoji, frase e sugestão opcional.
struct EmptyStateView: View {
    let emoji: String
    let title: String
    var hint: String? = nil

    var body: some View {
        VStack(spacing: 6) {
            Text(emoji).font(.system(size: 36))
            Text(title).font(.system(size: 15, weight: .semibold))
            if let hint {
                Text(hint)
                    .font(.system(size: 13))
                    .foregroundStyle(AppColor.ink2)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.vertical, 32)
        .frame(maxWidth: .infinity)
    }
}

/// Barra de progresso horizontal simples usada nos atingimentos de macro.
struct AttainmentBar: View {
    let label: String
    let pct: Int
    let color: Color

    var body: some View {
        HStack(spacing: 12) {
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(AppColor.ink2)
                .frame(width: 64, alignment: .leading)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(AppColor.line)
                    Capsule()
                        .fill(color)
                        .frame(width: geo.size.width * CGFloat(min(pct, 100)) / 100)
                }
            }
            .frame(height: 10)
            Text("\(pct)%")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AppColor.ink)
                .frame(width: 38, alignment: .trailing)
                .monospacedDigit()
        }
    }
}

/// Linha estatística com bolinha de cor (usada no cartão principal do diário).
struct MacroStatRow: View {
    let label: String
    let value: Double
    let target: Int
    let unit: String
    let color: Color

    var body: some View {
        HStack(spacing: 8) {
            Circle().fill(color).frame(width: 10, height: 10)
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(AppColor.ink2)
            Spacer()
            (
                Text("\(Int(value.rounded()))")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AppColor.ink)
                + Text(" / \(target) \(unit)")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(AppColor.muted)
            )
            .monospacedDigit()
        }
    }
}
