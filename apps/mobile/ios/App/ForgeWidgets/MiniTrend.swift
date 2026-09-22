import SwiftUI

struct MiniTrend: View {
    let points: [ForgeWidgetTrendPoint]
    let color: Color

    var body: some View {
        GeometryReader { geometry in
            let plot = coordinates(in: geometry.size)
            let hasRevenue = points.contains { $0.cents > 0 }
            if let first = plot.first, let last = plot.last {
                if plot.count == 1 {
                    Circle()
                        .fill(color.opacity(hasRevenue ? 1 : 0.2))
                        .frame(width: 4, height: 4)
                        .position(first)
                } else {
                    let line = curve(through: plot)
                    let baseline = geometry.size.height - min(2, geometry.size.height / 2)
                    let area = Path { path in
                        path.addPath(line)
                        path.addLine(to: CGPoint(x: last.x, y: baseline))
                        path.addLine(to: CGPoint(x: first.x, y: baseline))
                        path.closeSubpath()
                    }
                    area.fill(LinearGradient(
                        colors: [color.opacity(0.18), color.opacity(0)],
                        startPoint: .top, endPoint: .bottom
                    ))
                    line.stroke(color.opacity(hasRevenue ? 1 : 0.2),
                        style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Revenue trend")
        .accessibilityValue("\(points.filter { $0.cents > 0 }.count) of \(points.count) periods with revenue")
    }

    private func coordinates(in size: CGSize) -> [CGPoint] {
        // Leave room for rounded stroke caps at the first/last point and peaks.
        let insetX = min(2, size.width / 2)
        let insetY = min(2, size.height / 2)
        let width = max(0, size.width - 2 * insetX)
        let height = max(0, size.height - 2 * insetY)
        let maximum = max(points.map(\.cents).max() ?? 0, 1)
        return points.enumerated().map { index, point in
            CGPoint(
                x: insetX + (points.count == 1 ? width / 2 : width * CGFloat(index) / CGFloat(points.count - 1)),
                y: insetY + height * (1 - CGFloat(max(0, point.cents)) / CGFloat(maximum))
            )
        }
    }

    private func curve(through plot: [CGPoint]) -> Path {
        Path { path in
            guard let first = plot.first else { return }
            path.move(to: first)
            for (start, end) in zip(plot, plot.dropFirst()) {
                // Match Home's midpoint-control curve: rounded transitions that
                // stay between the actual values, with no invented overshoot.
                let middleX = (start.x + end.x) / 2
                path.addCurve(to: end,
                    control1: CGPoint(x: middleX, y: start.y),
                    control2: CGPoint(x: middleX, y: end.y))
            }
        }
    }
}
