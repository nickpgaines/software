import SwiftUI
import WidgetKit

struct ForgeWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ForgeWidgetEntry

    private let forgeOrange = Color(red: 1, green: 0.36, blue: 0.08)

    var body: some View {
        Group {
            if entry.state == .reconnect {
                messageView(title: "Open Forge", detail: "Reconnect your widget")
            } else if let snapshot = entry.snapshot {
                metricView(snapshot)
            } else {
                messageView(title: "Forge", detail: "Metrics unavailable")
            }
        }
        .containerBackground(for: .widget) {
            LinearGradient(
                colors: [Color.black, Color(red: 0.10, green: 0.10, blue: 0.12)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        .foregroundStyle(.white)
    }

    @ViewBuilder
    private func metricView(_ snapshot: ForgeWidgetSnapshot) -> some View {
        switch entry.metric {
        case .monthlyRevenue:
            if snapshot.permissions.reports,
               let metric = snapshot.metrics.monthlyRevenue {
                kpiView(title: entry.metric.title, cents: metric.totalCents, trend: metric.trend, updatedAt: snapshot.updatedAt)
            } else {
                permissionView()
            }
        case .ytdRevenue:
            if snapshot.permissions.reports,
               let metric = snapshot.metrics.ytdRevenue {
                kpiView(title: entry.metric.title, cents: metric.totalCents, trend: metric.trend, updatedAt: snapshot.updatedAt)
            } else {
                permissionView()
            }
        case .currentARR:
            if snapshot.permissions.reports,
               let cents = snapshot.metrics.currentARRCents {
                kpiView(title: entry.metric.title, cents: cents, trend: [], updatedAt: snapshot.updatedAt)
            } else {
                permissionView()
            }
        case .salesLeaderboard:
            if snapshot.permissions.salesLeaderboard,
               let rows = snapshot.metrics.salesLeaderboard {
                leaderboardView(rows: rows, updatedAt: snapshot.updatedAt)
            } else {
                permissionView()
            }
        }
    }

    private func kpiView(
        title: String,
        cents: Int,
        trend: [ForgeWidgetTrendPoint],
        updatedAt: Date
    ) -> some View {
        VStack(alignment: .leading, spacing: family == .systemSmall ? 8 : 10) {
            header(title: title, updatedAt: updatedAt)
            Text(formatCompactCurrency(cents))
                .font(.system(size: family == .systemSmall ? 30 : 36, weight: .bold, design: .rounded))
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            if !trend.isEmpty {
                MiniTrend(points: trend, color: forgeOrange)
                    .frame(maxHeight: family == .systemSmall ? 38 : 52)
            } else {
                Spacer(minLength: 0)
                Text("Recurring revenue run rate")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func leaderboardView(
        rows: [ForgeWidgetLeaderboardRow],
        updatedAt: Date
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            header(title: "Sales Leaders", updatedAt: updatedAt)
            if rows.isEmpty {
                Spacer()
                Text("No sales this month")
                    .font(.subheadline.weight(.semibold))
                Spacer()
            } else if family == .systemSmall, let first = rows.first {
                Spacer(minLength: 2)
                Text("#1")
                    .font(.caption.bold())
                    .foregroundStyle(forgeOrange)
                Text(first.name)
                    .font(.title3.bold())
                    .lineLimit(1)
                Text(formatCompactCurrency(first.revenueCents))
                    .font(.title2.bold())
                Spacer(minLength: 0)
            } else {
                ForEach(Array(rows.prefix(3).enumerated()), id: \.element.staffID) { index, row in
                    HStack(spacing: 8) {
                        Text("\(index + 1)")
                            .font(.caption.bold())
                            .foregroundStyle(index == 0 ? forgeOrange : .secondary)
                            .frame(width: 14)
                        Text(row.name)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(1)
                        Spacer()
                        Text(formatCompactCurrency(row.revenueCents))
                            .font(.subheadline.bold())
                    }
                }
                Spacer(minLength: 0)
            }
        }
    }

    private func header(title: String, updatedAt: Date) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title.uppercased())
                .font(.caption2.bold())
                .foregroundStyle(forgeOrange)
                .lineLimit(1)
            Spacer(minLength: 4)
            if entry.state == .cached {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .overlay(alignment: .bottomTrailing) {
            Text(updatedAt, style: .relative)
                .font(.system(size: 8))
                .foregroundStyle(.secondary)
                .offset(y: 9)
        }
    }

    private func permissionView() -> some View {
        messageView(title: entry.metric.title, detail: "Not available for this account")
    }

    private func messageView(title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: "flame.fill")
                .font(.title2)
                .foregroundStyle(forgeOrange)
            Spacer()
            Text(title)
                .font(.headline)
            Text(detail)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

private struct MiniTrend: View {
    let points: [ForgeWidgetTrendPoint]
    let color: Color

    var body: some View {
        GeometryReader { geometry in
            let maximum = max(points.map(\.cents).max() ?? 1, 1)
            HStack(alignment: .bottom, spacing: 2) {
                ForEach(Array(points.suffix(14).enumerated()), id: \.offset) { _, point in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(color.opacity(point.cents == 0 ? 0.2 : 0.9))
                        .frame(height: max(3, geometry.size.height * CGFloat(point.cents) / CGFloat(maximum)))
                }
            }
        }
    }
}
