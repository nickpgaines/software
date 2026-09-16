import SwiftUI

struct MiniTrend: View {
    let points: [ForgeWidgetTrendPoint]
    let color: Color

    var body: some View {
        GeometryReader { geometry in
            let maximum = max(points.map(\.cents).max() ?? 1, 1)
            // Fit the complete reporting period, including the beginning of the
            // month. Narrow widgets need smaller gaps, not fewer data points.
            let spacing: CGFloat = geometry.size.width < 200 ? 1 : 2
            HStack(alignment: .bottom, spacing: spacing) {
                ForEach(Array(points.enumerated()), id: \.offset) { _, point in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(color.opacity(point.cents == 0 ? 0.2 : 0.9))
                        .frame(height: max(3, geometry.size.height * CGFloat(point.cents) / CGFloat(maximum)))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Revenue trend")
        .accessibilityValue("\(points.filter { $0.cents > 0 }.count) of \(points.count) periods with revenue")
    }
}
