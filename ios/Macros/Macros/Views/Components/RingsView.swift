//
//  RingsView.swift
//  Macros
//
//  Anéis concêntricos à Apple Fitness — equivalente nativo de src/components/Rings.tsx.
//

import SwiftUI

struct RingSpec {
    let value: Double
    let target: Double
    let color: Color
    let label: String
}

struct RingsView<Center: View>: View {
    let rings: [RingSpec]
    var size: CGFloat = 150
    var strokeWidth: CGFloat = 13
    var gap: CGFloat = 4
    @ViewBuilder var center: Center

    var body: some View {
        ZStack {
            ForEach(Array(rings.enumerated()), id: \.offset) { index, ring in
                let radius = size / 2 - strokeWidth / 2 - CGFloat(index) * (strokeWidth + gap)
                let pct = ring.target > 0 ? min(ring.value / ring.target, 1) : 0

                Circle()
                    .stroke(ring.color.opacity(0.18), lineWidth: strokeWidth)
                    .frame(width: radius * 2, height: radius * 2)

                if pct > 0 {
                    Circle()
                        .trim(from: 0, to: pct)
                        .stroke(ring.color, style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round))
                        .frame(width: radius * 2, height: radius * 2)
                        .rotationEffect(.degrees(-90))
                        .animation(.easeOut(duration: 0.5), value: pct)
                }
            }
            center
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rings.map { "\($0.label): \(Int($0.value.rounded())) de \(Int($0.target.rounded()))" }.joined(separator: ", "))
    }
}
