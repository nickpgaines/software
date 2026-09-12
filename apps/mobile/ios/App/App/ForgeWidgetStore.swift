import Foundation
import Security

struct ForgeWidgetCredential: Codable, Equatable {
    let token: String
    let companyID: Int
    let staffID: Int
    let expiresAt: Date

    enum CodingKeys: String, CodingKey {
        case token
        case companyID = "company_id"
        case staffID = "staff_id"
        case expiresAt = "expires_at"
    }
}

struct ForgeWidgetPermissions: Codable, Equatable {
    let reports: Bool
    let salesLeaderboard: Bool

    enum CodingKeys: String, CodingKey {
        case reports
        case salesLeaderboard = "sales_leaderboard"
    }
}

struct ForgeWidgetTrendPoint: Codable, Equatable {
    let date: String
    let cents: Int
}

struct ForgeWidgetRevenueMetric: Codable, Equatable {
    let totalCents: Int
    let trend: [ForgeWidgetTrendPoint]

    enum CodingKeys: String, CodingKey {
        case totalCents = "total_cents"
        case trend
    }
}

struct ForgeWidgetLeaderboardRow: Codable, Equatable {
    let staffID: Int
    let name: String
    let revenueCents: Int
    let jobCount: Int

    enum CodingKeys: String, CodingKey {
        case staffID = "staff_id"
        case name
        case revenueCents = "revenue_cents"
        case jobCount = "job_count"
    }
}

struct ForgeWidgetMetrics: Codable, Equatable {
    let monthlyRevenue: ForgeWidgetRevenueMetric?
    let ytdRevenue: ForgeWidgetRevenueMetric?
    let currentARRCents: Int?
    let salesLeaderboard: [ForgeWidgetLeaderboardRow]?

    enum CodingKeys: String, CodingKey {
        case monthlyRevenue = "monthly_revenue"
        case ytdRevenue = "ytd_revenue"
        case currentARRCents = "current_arr_cents"
        case salesLeaderboard = "sales_leaderboard"
    }
}

struct ForgeWidgetSnapshot: Codable, Equatable {
    let version: Int
    let companyID: Int
    let staffID: Int
    let updatedAt: Date
    let permissions: ForgeWidgetPermissions
    let metrics: ForgeWidgetMetrics

    enum CodingKeys: String, CodingKey {
        case version
        case companyID = "company_id"
        case staffID = "staff_id"
        case updatedAt = "updated_at"
        case permissions
        case metrics
    }
}

extension JSONDecoder {
    static func forgeWidgetDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let value = try decoder.singleValueContainer().decode(String.self)
            let fractional = ISO8601DateFormatter()
            fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = fractional.date(from: value) { return date }
            let standard = ISO8601DateFormatter()
            standard.formatOptions = [.withInternetDateTime]
            if let date = standard.date(from: value) { return date }
            throw DecodingError.dataCorruptedError(
                in: try decoder.singleValueContainer(),
                debugDescription: "Invalid ISO-8601 date"
            )
        }
        return decoder
    }
}

extension JSONEncoder {
    static func forgeWidgetEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}

protocol WidgetSecretStoring {
    func data(for key: String) throws -> Data?
    func set(_ data: Data, for key: String) throws
    func removeValue(for key: String) throws
}

protocol KeychainItemWriting {
    func update(
        _ query: [String: Any],
        attributes: [String: Any]
    ) -> OSStatus
    func add(_ attributes: [String: Any]) -> OSStatus
}

protocol WidgetCredentialCacheLocking {
    func withLock<T>(_ operation: () throws -> T) throws -> T
}

final class FileWidgetCredentialCacheLock: WidgetCredentialCacheLocking {
    private let cacheDirectory: URL?
    private let lockFile = ".widget-credential-cache.lock"

    init(cacheDirectory: URL?) {
        self.cacheDirectory = cacheDirectory
    }

    func withLock<T>(_ operation: () throws -> T) throws -> T {
        guard let cacheDirectory else {
            throw ForgeWidgetStoreError.missingSharedContainer
        }
        try FileManager.default.createDirectory(
            at: cacheDirectory,
            withIntermediateDirectories: true
        )
        let lockURL = cacheDirectory.appendingPathComponent(
            lockFile,
            isDirectory: false
        )
        if !FileManager.default.fileExists(atPath: lockURL.path) {
            _ = FileManager.default.createFile(
                atPath: lockURL.path,
                contents: Data()
            )
        }

        let coordinator = NSFileCoordinator(filePresenter: nil)
        var coordinationError: NSError?
        var operationResult: Result<T, Swift.Error>?
        coordinator.coordinate(
            writingItemAt: lockURL,
            options: [],
            error: &coordinationError
        ) { _ in
            operationResult = Result { try operation() }
        }
        if let coordinationError {
            throw ForgeWidgetStoreError.processSharedLock(coordinationError)
        }
        guard let operationResult else {
            throw ForgeWidgetStoreError.processSharedLock(
                NSError(
                    domain: "ForgeWidgetStore",
                    code: 1,
                    userInfo: [
                        NSLocalizedDescriptionKey:
                            "Credential/cache coordination did not run.",
                    ]
                )
            )
        }
        return try operationResult.get()
    }
}

struct SystemKeychainItemWriter: KeychainItemWriting {
    func update(
        _ query: [String: Any],
        attributes: [String: Any]
    ) -> OSStatus {
        SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    }

    func add(_ attributes: [String: Any]) -> OSStatus {
        SecItemAdd(attributes as CFDictionary, nil)
    }
}

enum ForgeWidgetStoreError: Error {
    case keychain(OSStatus)
    case randomIdentifier(OSStatus)
    case missingSharedContainer
    case processSharedLock(NSError)
}

final class KeychainWidgetSecretStore: WidgetSecretStoring {
    private let service: String
    private let accessGroup: String?
    private let itemWriter: KeychainItemWriting

    init(
        service: String = "app.forgecrm.widget-secrets",
        accessGroup: String? = Bundle.main.object(
            forInfoDictionaryKey: "ForgeKeychainAccessGroup"
        ) as? String,
        itemWriter: KeychainItemWriting = SystemKeychainItemWriter()
    ) {
        self.service = service
        self.accessGroup = accessGroup
        self.itemWriter = itemWriter
    }

    private func query(for key: String) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        if let accessGroup, !accessGroup.isEmpty {
            query[kSecAttrAccessGroup as String] = accessGroup
        }
        return query
    }

    func data(for key: String) throws -> Data? {
        var query = query(for: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else {
            throw ForgeWidgetStoreError.keychain(status)
        }
        return result as? Data
    }

    func set(_ data: Data, for key: String) throws {
        let base = query(for: key)
        let updated = itemWriter.update(
            base,
            attributes: [
                kSecValueData as String: data,
                kSecAttrAccessible as String:
                    kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            ]
        )
        if updated == errSecSuccess { return }
        guard updated == errSecItemNotFound else {
            throw ForgeWidgetStoreError.keychain(updated)
        }
        var inserted = base
        inserted[kSecValueData as String] = data
        inserted[kSecAttrAccessible as String] =
            kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = itemWriter.add(inserted)
        guard status == errSecSuccess else {
            throw ForgeWidgetStoreError.keychain(status)
        }
    }

    func removeValue(for key: String) throws {
        let status = SecItemDelete(query(for: key) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw ForgeWidgetStoreError.keychain(status)
        }
    }
}

final class ForgeWidgetStore {
    static let appGroup = "group.app.forgecrm"
    private static let credentialCacheLock = NSLock()

    private let secretStore: WidgetSecretStoring
    private let defaults: UserDefaults
    private let cacheDirectory: URL?
    private let processSharedLock: WidgetCredentialCacheLocking
    private let installationKey = "installation-id"
    private let credentialKey = "widget-credential"
    private let snapshotFile = "widget-summary.json"

    init(
        secretStore: WidgetSecretStoring = KeychainWidgetSecretStore(),
        defaults: UserDefaults? = UserDefaults(suiteName: ForgeWidgetStore.appGroup),
        cacheDirectory: URL? = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: ForgeWidgetStore.appGroup
        ),
        processSharedLock: WidgetCredentialCacheLocking? = nil
    ) {
        self.secretStore = secretStore
        self.defaults = defaults ?? .standard
        self.cacheDirectory = cacheDirectory
        self.processSharedLock = processSharedLock
            ?? FileWidgetCredentialCacheLock(cacheDirectory: cacheDirectory)
    }

    func installationIdentifier() throws -> String {
        if let data = try secretStore.data(for: installationKey),
           let existing = String(data: data, encoding: .utf8),
           !existing.isEmpty {
            return existing
        }
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else {
            throw ForgeWidgetStoreError.randomIdentifier(status)
        }
        let identifier = Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        try secretStore.set(Data(identifier.utf8), for: installationKey)
        return identifier
    }

    func saveCredential(_ credential: ForgeWidgetCredential) throws {
        try withCredentialCacheLock {
            let data = try JSONEncoder.forgeWidgetEncoder().encode(credential)
            try secretStore.set(data, for: credentialKey)
        }
    }

    func loadCredential() throws -> ForgeWidgetCredential? {
        try withCredentialCacheLock {
            try loadCredentialUnlocked()
        }
    }

    private func loadCredentialUnlocked() throws -> ForgeWidgetCredential? {
        guard let data = try secretStore.data(for: credentialKey) else {
            return nil
        }
        return try JSONDecoder.forgeWidgetDecoder().decode(
            ForgeWidgetCredential.self,
            from: data
        )
    }

    func saveSnapshot(_ snapshot: ForgeWidgetSnapshot) throws {
        try withCredentialCacheLock {
            try saveSnapshotUnlocked(snapshot)
        }
    }

    @discardableResult
    func saveSnapshot(
        _ snapshot: ForgeWidgetSnapshot,
        ifCredentialMatches expected: ForgeWidgetCredential
    ) throws -> Bool {
        try withCredentialCacheLock {
            guard try loadCredentialUnlocked() == expected else {
                return false
            }
            try saveSnapshotUnlocked(snapshot)
            return true
        }
    }

    private func saveSnapshotUnlocked(_ snapshot: ForgeWidgetSnapshot) throws {
        let cacheDirectory = try requiredCacheDirectory()
        let snapshotURL = cacheDirectory
            .appendingPathComponent(snapshotFile, isDirectory: false)
        try FileManager.default.createDirectory(
            at: cacheDirectory,
            withIntermediateDirectories: true
        )
        let data = try JSONEncoder.forgeWidgetEncoder().encode(snapshot)
        try data.write(to: snapshotURL, options: .atomic)
        defaults.set(snapshot.updatedAt.timeIntervalSince1970, forKey: "widget-last-update")
    }

    func loadSnapshot() throws -> ForgeWidgetSnapshot? {
        try withCredentialCacheLock {
            try loadSnapshotUnlocked()
        }
    }

    func loadSnapshot(
        ifCredentialMatches expected: ForgeWidgetCredential
    ) throws -> ForgeWidgetSnapshot? {
        try withCredentialCacheLock {
            guard try loadCredentialUnlocked() == expected else {
                return nil
            }
            return try loadSnapshotUnlocked(credential: expected)
        }
    }

    private func loadSnapshotUnlocked() throws -> ForgeWidgetSnapshot? {
        guard let credential = try loadCredentialUnlocked() else {
            return nil
        }
        return try loadSnapshotUnlocked(credential: credential)
    }

    private func loadSnapshotUnlocked(
        credential: ForgeWidgetCredential
    ) throws -> ForgeWidgetSnapshot? {
        let snapshotURL = try requiredCacheDirectory()
            .appendingPathComponent(snapshotFile, isDirectory: false)
        guard let data = try? Data(contentsOf: snapshotURL),
              let snapshot = try? JSONDecoder.forgeWidgetDecoder().decode(
                ForgeWidgetSnapshot.self,
                from: data
              ),
              snapshot.companyID == credential.companyID,
              snapshot.staffID == credential.staffID else {
            return nil
        }
        return snapshot
    }

    func clearCredentialAndCache() throws {
        try withCredentialCacheLock {
            try clearCredentialAndCacheUnlocked()
        }
    }

    @discardableResult
    func clearCredentialAndCache(
        ifCredentialMatches expected: ForgeWidgetCredential
    ) throws -> Bool {
        try withCredentialCacheLock {
            guard try loadCredentialUnlocked() == expected else {
                return false
            }
            try clearCredentialAndCacheUnlocked()
            return true
        }
    }

    private func clearCredentialAndCacheUnlocked() throws {
        try secretStore.removeValue(for: credentialKey)
        try clearCacheUnlocked()
    }

    func clearCache() throws {
        try withCredentialCacheLock {
            try clearCacheUnlocked()
        }
    }

    private func clearCacheUnlocked() throws {
        let snapshotURL = try requiredCacheDirectory()
            .appendingPathComponent(snapshotFile, isDirectory: false)
        if FileManager.default.fileExists(atPath: snapshotURL.path) {
            try FileManager.default.removeItem(at: snapshotURL)
        }
        defaults.removeObject(forKey: "widget-last-update")
    }

    private func requiredCacheDirectory() throws -> URL {
        guard let cacheDirectory else {
            throw ForgeWidgetStoreError.missingSharedContainer
        }
        return cacheDirectory
    }

    private func withCredentialCacheLock<T>(
        _ operation: () throws -> T
    ) throws -> T {
        Self.credentialCacheLock.lock()
        defer { Self.credentialCacheLock.unlock() }
        return try processSharedLock.withLock(operation)
    }
}
