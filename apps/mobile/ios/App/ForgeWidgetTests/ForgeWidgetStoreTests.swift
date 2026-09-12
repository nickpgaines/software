import Foundation
import Security
import XCTest

private final class RecordingKeychainItemWriter: KeychainItemWriting {
    var updateStatuses: [OSStatus] = [errSecItemNotFound, errSecSuccess]
    private(set) var updateAttributes: [[String: Any]] = []
    private(set) var insertedAttributes: [[String: Any]] = []

    func update(
        _ query: [String: Any],
        attributes: [String: Any]
    ) -> OSStatus {
        updateAttributes.append(attributes)
        return updateStatuses.removeFirst()
    }

    func add(_ attributes: [String: Any]) -> OSStatus {
        insertedAttributes.append(attributes)
        return errSecSuccess
    }
}

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

private final class DeterministicCredentialCacheLock: WidgetCredentialCacheLocking {
    private let gate = NSLock()
    private let stateLock = NSLock()
    private var held = false

    var isHeld: Bool {
        stateLock.lock()
        defer { stateLock.unlock() }
        return held
    }

    func withLock<T>(_ operation: () throws -> T) throws -> T {
        gate.lock()
        stateLock.lock()
        held = true
        stateLock.unlock()
        defer {
            stateLock.lock()
            held = false
            stateLock.unlock()
            gate.unlock()
        }
        return try operation()
    }
}

private final class ExternalReplacementSecretStore: WidgetSecretStoring {
    enum ReplacementError: Swift.Error {
        case timedOut
    }

    var values: [String: Data] = [:]

    private let cacheDirectory: URL
    private let replacementLock: DeterministicCredentialCacheLock
    private let replacementAttempted = DispatchSemaphore(value: 0)
    private let replacementFinished = DispatchSemaphore(value: 0)
    private var replacement: (credential: Data, snapshot: Data)?
    private(set) var replacementError: Swift.Error?

    init(
        cacheDirectory: URL,
        replacementLock: DeterministicCredentialCacheLock
    ) {
        self.cacheDirectory = cacheDirectory
        self.replacementLock = replacementLock
    }

    func data(for key: String) throws -> Data? {
        let current = values[key]
        guard key == "widget-credential",
              let replacement else {
            return current
        }
        self.replacement = nil
        DispatchQueue.global().async {
            defer { self.replacementFinished.signal() }
            self.replacementAttempted.signal()
            do {
                try self.replacementLock.withLock {
                    self.values[key] = replacement.credential
                    try replacement.snapshot.write(
                        to: self.cacheDirectory.appendingPathComponent(
                            "widget-summary.json"
                        ),
                        options: .atomic
                    )
                }
            } catch {
                self.replacementError = error
            }
        }
        guard replacementAttempted.wait(timeout: .now() + 2) == .success else {
            throw ReplacementError.timedOut
        }
        if !replacementLock.isHeld,
           replacementFinished.wait(timeout: .now() + 2) != .success {
            throw ReplacementError.timedOut
        }
        return current
    }

    func set(_ data: Data, for key: String) throws {
        values[key] = data
    }

    func removeValue(for key: String) throws {
        values.removeValue(forKey: key)
    }

    func replaceOnNextCredentialRead(
        credential: ForgeWidgetCredential,
        snapshot: ForgeWidgetSnapshot
    ) throws {
        replacement = (
            try JSONEncoder.forgeWidgetEncoder().encode(credential),
            try JSONEncoder.forgeWidgetEncoder().encode(snapshot)
        )
    }

    func waitForReplacement() throws {
        guard replacementFinished.wait(timeout: .now() + 2) == .success else {
            throw ReplacementError.timedOut
        }
        if let replacementError {
            throw replacementError
        }
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

    func testConditionalSnapshotSaveRejectsReplacedCredential() throws {
        let accountA = credential(token: "a", companyID: 42, staffID: 9)
        let accountB = credential(token: "b", companyID: 77, staffID: 10)
        let accountBSnapshot = ForgeWidgetSnapshot.fixture(
            companyID: 77,
            staffID: 10,
            monthlyRevenueCents: 777
        )
        try store.saveCredential(accountB)
        try store.saveSnapshot(accountBSnapshot)

        let saved = try store.saveSnapshot(
            .fixture(companyID: 42, staffID: 9, monthlyRevenueCents: 111),
            ifCredentialMatches: accountA
        )

        XCTAssertFalse(saved)
        XCTAssertEqual(try store.loadCredential(), accountB)
        XCTAssertEqual(try store.loadSnapshot(), accountBSnapshot)
    }

    func testConditionalClearRejectsReplacedCredential() throws {
        let accountA = credential(token: "a", companyID: 42, staffID: 9)
        let accountB = credential(token: "b", companyID: 77, staffID: 10)
        let accountBSnapshot = ForgeWidgetSnapshot.fixture(
            companyID: 77,
            staffID: 10,
            monthlyRevenueCents: 777
        )
        try store.saveCredential(accountB)
        try store.saveSnapshot(accountBSnapshot)

        let cleared = try store.clearCredentialAndCache(
            ifCredentialMatches: accountA
        )

        XCTAssertFalse(cleared)
        XCTAssertEqual(try store.loadCredential(), accountB)
        XCTAssertEqual(try store.loadSnapshot(), accountBSnapshot)
    }

    func testKeychainWritesUseDeviceOnlyAccessibilityForInsertAndUpdate() throws {
        let writer = RecordingKeychainItemWriter()
        let secretStore = KeychainWidgetSecretStore(
            service: "ForgeWidgetStoreTests",
            accessGroup: nil,
            itemWriter: writer
        )

        try secretStore.set(Data("first".utf8), for: "credential")
        try secretStore.set(Data("second".utf8), for: "credential")

        XCTAssertEqual(writer.insertedAttributes.count, 1)
        XCTAssertEqual(writer.updateAttributes.count, 2)
        XCTAssertTrue(
            writer.insertedAttributes.allSatisfy(hasDeviceOnlyAccessibility)
        )
        XCTAssertTrue(
            writer.updateAttributes.allSatisfy(hasDeviceOnlyAccessibility)
        )
    }

    func testFileLockExcludesAnIndependentLockInstance() throws {
        let first = FileWidgetCredentialCacheLock(cacheDirectory: cacheDirectory)
        let second = FileWidgetCredentialCacheLock(cacheDirectory: cacheDirectory)
        let firstEntered = DispatchSemaphore(value: 0)
        let releaseFirst = DispatchSemaphore(value: 0)
        let secondAttempted = DispatchSemaphore(value: 0)
        let secondEntered = DispatchSemaphore(value: 0)

        DispatchQueue.global().async {
            try? first.withLock {
                firstEntered.signal()
                releaseFirst.wait()
            }
        }
        XCTAssertEqual(firstEntered.wait(timeout: .now() + 2), .success)

        DispatchQueue.global().async {
            secondAttempted.signal()
            _ = try? second.withLock {
                secondEntered.signal()
            }
        }
        XCTAssertEqual(secondAttempted.wait(timeout: .now() + 2), .success)
        XCTAssertEqual(secondEntered.wait(timeout: .now() + 0.1), .timedOut)

        releaseFirst.signal()
        XCTAssertEqual(secondEntered.wait(timeout: .now() + 2), .success)
    }

    func testIndependentCredentialReplacementCannotBeClearedAfterFinalComparison() throws {
        let (raceStore, raceSecrets, accountA, accountB, accountBSnapshot) =
            try makeExternalReplacementStore()
        try raceStore.saveCredential(accountA)
        try raceStore.saveSnapshot(
            .fixture(companyID: 42, staffID: 9, monthlyRevenueCents: 111)
        )
        try raceSecrets.replaceOnNextCredentialRead(
            credential: accountB,
            snapshot: accountBSnapshot
        )

        _ = try raceStore.clearCredentialAndCache(ifCredentialMatches: accountA)
        try raceSecrets.waitForReplacement()

        XCTAssertEqual(try raceStore.loadCredential(), accountB)
        XCTAssertEqual(try raceStore.loadSnapshot(), accountBSnapshot)
    }

    func testIndependentCredentialReplacementCannotBeOverwrittenAfterFinalComparison() throws {
        let (raceStore, raceSecrets, accountA, accountB, accountBSnapshot) =
            try makeExternalReplacementStore()
        try raceStore.saveCredential(accountA)
        try raceSecrets.replaceOnNextCredentialRead(
            credential: accountB,
            snapshot: accountBSnapshot
        )

        _ = try raceStore.saveSnapshot(
            .fixture(companyID: 42, staffID: 9, monthlyRevenueCents: 111),
            ifCredentialMatches: accountA
        )
        try raceSecrets.waitForReplacement()

        XCTAssertEqual(try raceStore.loadCredential(), accountB)
        XCTAssertEqual(try raceStore.loadSnapshot(), accountBSnapshot)
    }

    func testIndependentCredentialReplacementCannotSplitFallbackComparisonAndRead() throws {
        let (raceStore, raceSecrets, accountA, accountB, accountBSnapshot) =
            try makeExternalReplacementStore()
        let accountASnapshot = ForgeWidgetSnapshot.fixture(
            companyID: 42,
            staffID: 9,
            monthlyRevenueCents: 111
        )
        try raceStore.saveCredential(accountA)
        try raceStore.saveSnapshot(accountASnapshot)
        try raceSecrets.replaceOnNextCredentialRead(
            credential: accountB,
            snapshot: accountBSnapshot
        )

        let fallback = try raceStore.loadSnapshot(
            ifCredentialMatches: accountA
        )
        try raceSecrets.waitForReplacement()

        XCTAssertEqual(fallback, accountASnapshot)
        XCTAssertEqual(try raceStore.loadCredential(), accountB)
        XCTAssertEqual(try raceStore.loadSnapshot(), accountBSnapshot)
    }

    private func credential(
        token: Character,
        companyID: Int,
        staffID: Int
    ) -> ForgeWidgetCredential {
        ForgeWidgetCredential(
            token: String(repeating: token, count: 43),
            companyID: companyID,
            staffID: staffID,
            expiresAt: Date(timeIntervalSince1970: 2_000_000_000)
        )
    }

    private func hasDeviceOnlyAccessibility(_ attributes: [String: Any]) -> Bool {
        guard let accessibility = attributes[kSecAttrAccessible as String] else {
            return false
        }
        return CFEqual(accessibility as CFTypeRef, kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly)
    }

    private func makeExternalReplacementStore() throws -> (
        ForgeWidgetStore,
        ExternalReplacementSecretStore,
        ForgeWidgetCredential,
        ForgeWidgetCredential,
        ForgeWidgetSnapshot
    ) {
        let processSharedLock = DeterministicCredentialCacheLock()
        let raceSecrets = ExternalReplacementSecretStore(
            cacheDirectory: cacheDirectory,
            replacementLock: processSharedLock
        )
        let raceStore = ForgeWidgetStore(
            secretStore: raceSecrets,
            defaults: defaults,
            cacheDirectory: cacheDirectory,
            processSharedLock: processSharedLock
        )
        let accountA = credential(token: "a", companyID: 42, staffID: 9)
        let accountB = credential(token: "b", companyID: 77, staffID: 10)
        let accountBSnapshot = ForgeWidgetSnapshot.fixture(
            companyID: 77,
            staffID: 10,
            monthlyRevenueCents: 777
        )
        return (raceStore, raceSecrets, accountA, accountB, accountBSnapshot)
    }
}
