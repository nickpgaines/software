import WidgetKit

struct ForgeWidgetEntry: TimelineEntry {
    let date: Date
    let metric: WidgetMetric
    let snapshot: ForgeWidgetSnapshot?
    let state: ForgeWidgetConnectionState
}

struct ForgeWidgetProvider: AppIntentTimelineProvider {
    typealias Entry = ForgeWidgetEntry
    typealias Intent = SelectForgeMetricIntent

    private let loader: ForgeWidgetSnapshotLoader

    init(loader: ForgeWidgetSnapshotLoader = ForgeWidgetSnapshotLoader()) {
        self.loader = loader
    }

    func placeholder(in context: Context) -> ForgeWidgetEntry {
        ForgeWidgetEntry(
            date: Date(),
            metric: .monthlyRevenue,
            snapshot: .preview,
            state: .connected
        )
    }

    func snapshot(
        for configuration: SelectForgeMetricIntent,
        in context: Context
    ) async -> ForgeWidgetEntry {
        if context.isPreview { return placeholder(in: context).with(metric: configuration.metric) }
        let snapshot = try? ForgeWidgetStore().loadSnapshot()
        return ForgeWidgetEntry(
            date: Date(),
            metric: configuration.metric,
            snapshot: snapshot,
            state: snapshot == nil ? .unavailable : .cached
        )
    }

    func timeline(
        for configuration: SelectForgeMetricIntent,
        in context: Context
    ) async -> Timeline<ForgeWidgetEntry> {
        let now = Date()
        let loaded = await loader.load(now: now)
        let entry = ForgeWidgetEntry(
            date: now,
            metric: configuration.metric,
            snapshot: loaded.snapshot,
            state: loaded.state
        )
        return Timeline(entries: [entry], policy: .after(loaded.refreshDate))
    }
}

private extension ForgeWidgetEntry {
    func with(metric: WidgetMetric) -> ForgeWidgetEntry {
        ForgeWidgetEntry(
            date: date,
            metric: metric,
            snapshot: snapshot,
            state: state
        )
    }
}

extension ForgeWidgetSnapshot {
    static var preview: ForgeWidgetSnapshot {
        ForgeWidgetSnapshot(
            version: 1,
            companyID: 42,
            staffID: 9,
            updatedAt: Date(),
            permissions: .init(reports: true, salesLeaderboard: true),
            metrics: .init(
                monthlyRevenue: .init(
                    totalCents: 990_200,
                    trend: [12, 18, 15, 24, 21, 32, 38].enumerated().map {
                        .init(date: "2026-08-\($0.offset + 16)", cents: $0.element * 10_000)
                    }
                ),
                ytdRevenue: .init(totalCents: 4_820_000, trend: []),
                currentARRCents: 1_200_000,
                salesLeaderboard: [
                    .init(staffID: 9, name: "Aubrey", revenueCents: 500_000, jobCount: 3),
                    .init(staffID: 10, name: "Jack", revenueCents: 420_000, jobCount: 2),
                    .init(staffID: 11, name: "David", revenueCents: 310_000, jobCount: 2),
                ]
            )
        )
    }
}
