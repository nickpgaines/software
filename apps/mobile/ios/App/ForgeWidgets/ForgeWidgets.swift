import SwiftUI
import WidgetKit

@main
struct ForgeWidgets: WidgetBundle {
    var body: some Widget {
        ForgeMetricsWidget()
    }
}

struct ForgeMetricsWidget: Widget {
    let kind = "ForgeMetrics"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: SelectForgeMetricIntent.self,
            provider: ForgeWidgetProvider()
        ) { entry in
            ForgeWidgetView(entry: entry)
                .widgetURL(
                    entry.metric == .salesLeaderboard
                        ? URL(string: "https://www.forgecrm.app/leaderboard")
                        : URL(string: "https://www.forgecrm.app/reports")
                )
        }
        .configurationDisplayName("Forge Metrics")
        .description("Revenue, ARR, and sales performance at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
