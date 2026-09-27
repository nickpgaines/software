import SwiftUI
import WidgetKit

struct ForgeWidgetContent: View {
    let entry: ForgeWidgetEntry
    let family: WidgetFamily

    var body: some View {
        Group {
            if entry.state == .reconnect {
                messageView(title: "Open Forge", detail: "Reconnect your widget", systemImage: "arrow.triangle.2.circlepath")
            } else if let snapshot = entry.snapshot {
                metricView(snapshot)
            } else {
                messageView(title: "Forge", detail: "Metrics unavailable", systemImage: "chart.bar.xaxis")
            }
        }
        .foregroundStyle(ForgeWidgetStyle.foreground)
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
                .font(.system(size: family == .systemSmall ? 30 : 36, weight: .bold))
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            if !trend.isEmpty {
                MiniTrend(points: trend, color: ForgeWidgetStyle.foreground)
                    .frame(maxHeight: family == .systemSmall ? 38 : 52)
            } else {
                Spacer(minLength: 0)
                Text("Recurring revenue run rate")
                    .font(.caption2)
                    .foregroundStyle(ForgeWidgetStyle.muted)
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
                    .foregroundStyle(ForgeWidgetStyle.foreground)
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
                            .foregroundStyle(index == 0 ? ForgeWidgetStyle.foreground : ForgeWidgetStyle.muted)
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
                .font(.caption2.weight(.heavy))
                .tracking(0.8)
                .foregroundStyle(ForgeWidgetStyle.muted)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 4)
            if entry.state == .cached {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.caption2)
                    .foregroundStyle(ForgeWidgetStyle.muted)
                    .accessibilityLabel("Showing cached data")
            }
        }
        .overlay(alignment: .bottomTrailing) {
            Text(updatedAt, style: .relative)
                .font(.system(size: 8))
                .foregroundStyle(ForgeWidgetStyle.muted)
                .offset(y: 9)
        }
    }

    private func permissionView() -> some View {
        messageView(title: entry.metric.title, detail: "Not available for this account", systemImage: "lock")
    }

    private func messageView(title: String, detail: String, systemImage: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(ForgeWidgetStyle.muted)
                .frame(width: 34, height: 34)
                .background(ForgeWidgetStyle.elevated, in: RoundedRectangle(cornerRadius: 10))
                .overlay {
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(ForgeWidgetStyle.border, lineWidth: 1)
                }
                .accessibilityHidden(true)
            Spacer(minLength: 0)
            Text(title)
                .font(.headline)
            Text(detail)
                .font(.caption)
                .foregroundStyle(ForgeWidgetStyle.muted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}
