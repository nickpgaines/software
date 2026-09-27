import AppIntents

enum WidgetMetric: String, AppEnum {
    case monthlyRevenue
    case ytdRevenue
    case currentARR
    case salesLeaderboard

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Metric")
    static var caseDisplayRepresentations: [WidgetMetric: DisplayRepresentation] = [
        .monthlyRevenue: "Monthly Revenue",
        .ytdRevenue: "YTD Revenue",
        .currentARR: "Current ARR",
        .salesLeaderboard: "Sales Leaderboard",
    ]

    var title: String {
        switch self {
        case .monthlyRevenue: return "Monthly Revenue"
        case .ytdRevenue: return "YTD Revenue"
        case .currentARR: return "Current ARR"
        case .salesLeaderboard: return "Sales Leaders"
        }
    }
}

struct SelectForgeMetricIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Forge Metric"
    static var description = IntentDescription("Choose the Forge metric to display.")

    @Parameter(title: "Metric", default: .monthlyRevenue)
    var metric: WidgetMetric

    init() {
        metric = .monthlyRevenue
    }

    init(metric: WidgetMetric) {
        self.metric = metric
    }
}
