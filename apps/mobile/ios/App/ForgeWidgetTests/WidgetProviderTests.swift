import Foundation
import XCTest

private final class StubWidgetTransport: WidgetNetworkTransport {
    var result: Result<(Data, Int), Error>

    init(result: Result<(Data, Int), Error>) {
        self.result = result
    }

    func data(for request: URLRequest) async throws -> (Data, Int) {
        try result.get()
    }
}

private enum StubNetworkError: Error {
    case offline
}

final class WidgetProviderTests: XCTestCase {
    private var defaults: UserDefaults!
    private var cacheDirectory: URL!
    private var secrets: MemoryProviderSecretStore!
    private var store: ForgeWidgetStore!
    private let now = Date(timeIntervalSince1970: 1_787_403_600)

    override func setUpWithError() throws {
        let suite = "WidgetProviderTests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suite)
        cacheDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("WidgetProviderTests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
        secrets = MemoryProviderSecretStore()
        store = ForgeWidgetStore(secretStore: secrets, defaults: defaults, cacheDirectory: cacheDirectory)
        try store.saveCredential(.fixture())
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: cacheDirectory)
    }

    func testDecodesVersionOneResponseAndRequestsThirtyMinutes() async throws {
        let loader = ForgeWidgetSnapshotLoader(
            store: store,
            transport: StubWidgetTransport(result: .success((validJSON(), 200)))
        )
        let result = await loader.load(now: now)
        XCTAssertEqual(result.state, .connected)
        XCTAssertEqual(result.snapshot?.metrics.monthlyRevenue?.totalCents, 990_200)
        XCTAssertEqual(result.refreshDate.timeIntervalSince(now), 1_800, accuracy: 1)
        XCTAssertEqual(try store.loadSnapshot()?.companyID, 42)
    }

    func testOfflineUsesLastValidCache() async throws {
        try store.saveSnapshot(.fixture())
        let loader = ForgeWidgetSnapshotLoader(
            store: store,
            transport: StubWidgetTransport(result: .failure(StubNetworkError.offline))
        )
        let result = await loader.load(now: now)
        XCTAssertEqual(result.state, .cached)
        XCTAssertEqual(result.snapshot?.companyID, 42)
    }

    func testUnauthorizedClearsCredentialAndCache() async throws {
        try store.saveSnapshot(.fixture())
        let loader = ForgeWidgetSnapshotLoader(
            store: store,
            transport: StubWidgetTransport(result: .success((Data(), 401)))
        )
        let result = await loader.load(now: now)
        XCTAssertEqual(result.state, .reconnect)
        XCTAssertNil(try store.loadCredential())
        XCTAssertNil(try store.loadSnapshot())
    }

    func testForbiddenClearsCredentialAndCache() async throws {
        try store.saveSnapshot(.fixture())
        let loader = ForgeWidgetSnapshotLoader(
            store: store,
            transport: StubWidgetTransport(result: .success((Data(), 403)))
        )
        let result = await loader.load(now: now)
        XCTAssertEqual(result.state, .reconnect)
        XCTAssertNil(try store.loadCredential())
        XCTAssertNil(try store.loadSnapshot())
    }

    func testIdentityMismatchPreservesExistingCache() async throws {
        try store.saveSnapshot(.fixture(monthlyRevenueCents: 111))
        let mismatched = validJSON(companyID: 99)
        let loader = ForgeWidgetSnapshotLoader(
            store: store,
            transport: StubWidgetTransport(result: .success((mismatched, 200)))
        )
        let result = await loader.load(now: now)
        XCTAssertEqual(result.state, .cached)
        XCTAssertEqual(result.snapshot?.metrics.monthlyRevenue?.totalCents, 111)
    }

    func testMalformedResponsePreservesExistingCache() async throws {
        try store.saveSnapshot(.fixture(monthlyRevenueCents: 222))
        let loader = ForgeWidgetSnapshotLoader(
            store: store,
            transport: StubWidgetTransport(result: .success((Data("not-json".utf8), 200)))
        )
        let result = await loader.load(now: now)
        XCTAssertEqual(result.state, .cached)
        XCTAssertEqual(result.snapshot?.metrics.monthlyRevenue?.totalCents, 222)
    }

    func testPermissionRestrictedResponseReplacesUnauthorizedMetrics() async throws {
        try store.saveSnapshot(.fixture(monthlyRevenueCents: 333))
        let restricted = Data(
            """
            {
              "version": 1,
              "company_id": 42,
              "staff_id": 9,
              "updated_at": "2026-08-22T17:00:00Z",
              "permissions": {"reports": false, "sales_leaderboard": true},
              "metrics": {
                "monthly_revenue": null,
                "ytd_revenue": null,
                "current_arr_cents": null,
                "sales_leaderboard": []
              }
            }
            """.utf8
        )
        let loader = ForgeWidgetSnapshotLoader(
            store: store,
            transport: StubWidgetTransport(result: .success((restricted, 200)))
        )
        let result = await loader.load(now: now)
        XCTAssertEqual(result.state, .connected)
        XCTAssertFalse(result.snapshot?.permissions.reports ?? true)
        XCTAssertNil(result.snapshot?.metrics.monthlyRevenue)
        XCTAssertNil(try store.loadSnapshot()?.metrics.monthlyRevenue)
    }

    private func validJSON(companyID: Int = 42) -> Data {
        Data(
            """
            {
              "version": 1,
              "company_id": \(companyID),
              "staff_id": 9,
              "updated_at": "2026-08-22T17:00:00.123Z",
              "permissions": {"reports": true, "sales_leaderboard": true},
              "metrics": {
                "monthly_revenue": {"total_cents": 990200, "trend": []},
                "ytd_revenue": {"total_cents": 4820000, "trend": []},
                "current_arr_cents": 1200000,
                "sales_leaderboard": [{"staff_id": 9, "name": "Aubrey", "revenue_cents": 500000, "job_count": 3}]
              }
            }
            """.utf8
        )
    }
}

private final class MemoryProviderSecretStore: WidgetSecretStoring {
    var values: [String: Data] = [:]
    func data(for key: String) throws -> Data? { values[key] }
    func set(_ data: Data, for key: String) throws { values[key] = data }
    func removeValue(for key: String) throws { values.removeValue(forKey: key) }
}

private extension ForgeWidgetCredential {
    static func fixture() -> ForgeWidgetCredential {
        ForgeWidgetCredential(
            token: String(repeating: "a", count: 43),
            companyID: 42,
            staffID: 9,
            expiresAt: Date(timeIntervalSince1970: 2_000_000_000)
        )
    }
}

private extension ForgeWidgetSnapshot {
    static func fixture(monthlyRevenueCents: Int = 100) -> ForgeWidgetSnapshot {
        ForgeWidgetSnapshot(
            version: 1,
            companyID: 42,
            staffID: 9,
            updatedAt: Date(timeIntervalSince1970: 1_787_400_000),
            permissions: .init(reports: true, salesLeaderboard: true),
            metrics: .init(
                monthlyRevenue: .init(totalCents: monthlyRevenueCents, trend: []),
                ytdRevenue: .init(totalCents: 200, trend: []),
                currentARRCents: 300,
                salesLeaderboard: []
            )
        )
    }
}
