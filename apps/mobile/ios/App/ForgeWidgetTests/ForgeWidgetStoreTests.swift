import Foundation
import XCTest

private final class MemoryWidgetSecretStore: WidgetSecretStoring {
    var values: [String: Data] = [:]

    func data(for key: String) throws -> Data? {
        values[key]
    }

    func set(_ data: Data, for key: String) throws {
        values[key] = data
    }

    func removeValue(for key: String) throws {
        values.removeValue(forKey: key)
    }
}

private extension ForgeWidgetSnapshot {
    static func fixture(
        companyID: Int,
        staffID: Int,
        monthlyRevenueCents: Int = 100
    ) -> ForgeWidgetSnapshot {
        ForgeWidgetSnapshot(
            version: 1,
            companyID: companyID,
            staffID: staffID,
            updatedAt: Date(timeIntervalSince1970: 2_000_000_000),
            permissions: ForgeWidgetPermissions(
                reports: true,
                salesLeaderboard: true
            ),
            metrics: ForgeWidgetMetrics(
                monthlyRevenue: ForgeWidgetRevenueMetric(
                    totalCents: monthlyRevenueCents,
                    trend: []
                ),
                ytdRevenue: ForgeWidgetRevenueMetric(totalCents: 200, trend: []),
                currentARRCents: 300,
                salesLeaderboard: []
            )
        )
    }
}

final class ForgeWidgetStoreTests: XCTestCase {
    private var defaults: UserDefaults!
    private var cacheDirectory: URL!
    private var secrets: MemoryWidgetSecretStore!
    private var store: ForgeWidgetStore!

    override func setUpWithError() throws {
        let suite = "ForgeWidgetStoreTests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suite)
        defaults.removePersistentDomain(forName: suite)
        cacheDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("ForgeWidgetStoreTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(
            at: cacheDirectory,
            withIntermediateDirectories: true
        )
        secrets = MemoryWidgetSecretStore()
        store = ForgeWidgetStore(
            secretStore: secrets,
            defaults: defaults,
            cacheDirectory: cacheDirectory
        )
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: cacheDirectory)
        store = nil
        secrets = nil
        defaults = nil
    }

    func testInstallationIdentifierIsStableAndOpaque() throws {
        let first = try store.installationIdentifier()
        let second = try store.installationIdentifier()
        XCTAssertEqual(first, second)
        XCTAssertGreaterThanOrEqual(first.count, 32)
        XCTAssertNil(UUID(uuidString: first))
    }

    func testCredentialRoundTripAndClear() throws {
        let credential = ForgeWidgetCredential(
            token: String(repeating: "a", count: 43),
            companyID: 42,
            staffID: 9,
            expiresAt: Date(timeIntervalSince1970: 2_000_000_000)
        )
        try store.saveCredential(credential)
        XCTAssertEqual(try store.loadCredential(), credential)

        try store.clearCredentialAndCache()
        XCTAssertNil(try store.loadCredential())
        XCTAssertNil(try store.loadSnapshot())
    }

    func testRejectsCachedSnapshotFromAnotherPrincipal() throws {
        try store.saveCredential(
            ForgeWidgetCredential(
                token: String(repeating: "a", count: 43),
                companyID: 42,
                staffID: 9,
                expiresAt: Date(timeIntervalSince1970: 2_000_000_000)
            )
        )
        try store.saveSnapshot(
            ForgeWidgetSnapshot.fixture(companyID: 99, staffID: 9)
        )
        XCTAssertNil(try store.loadSnapshot())
    }

    func testSnapshotReplacementPreservesDecodableData() throws {
        let first = ForgeWidgetSnapshot.fixture(
            companyID: 42,
            staffID: 9,
            monthlyRevenueCents: 100
        )
        let second = ForgeWidgetSnapshot.fixture(
            companyID: 42,
            staffID: 9,
            monthlyRevenueCents: 200
        )
        try store.saveCredential(
            ForgeWidgetCredential(
                token: String(repeating: "a", count: 43),
                companyID: 42,
                staffID: 9,
                expiresAt: Date(timeIntervalSince1970: 2_000_000_000)
            )
        )
        try store.saveSnapshot(first)
        try store.saveSnapshot(second)
        XCTAssertEqual(
            try store.loadSnapshot()?.metrics.monthlyRevenue?.totalCents,
            200
        )
    }
}
