import Foundation

protocol WidgetNetworkTransport {
    func data(for request: URLRequest) async throws -> (Data, Int)
}

struct URLSessionWidgetTransport: WidgetNetworkTransport {
    func data(for request: URLRequest) async throws -> (Data, Int) {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        return (data, http.statusCode)
    }
}

enum ForgeWidgetConnectionState: Equatable {
    case connected
    case cached
    case reconnect
    case unavailable
}

struct ForgeWidgetLoadResult {
    let snapshot: ForgeWidgetSnapshot?
    let state: ForgeWidgetConnectionState
    let refreshDate: Date
}

struct ForgeWidgetSnapshotLoader {
    private let store: ForgeWidgetStore
    private let transport: WidgetNetworkTransport
    private let endpoint: URL

    init(
        store: ForgeWidgetStore = ForgeWidgetStore(),
        transport: WidgetNetworkTransport = URLSessionWidgetTransport(),
        endpoint: URL = URL(string: "https://www.forgecrm.app/api/widget/summary")!
    ) {
        self.store = store
        self.transport = transport
        self.endpoint = endpoint
    }

    func load(now: Date = Date()) async -> ForgeWidgetLoadResult {
        let refreshDate = now.addingTimeInterval(30 * 60)
        let cached = try? store.loadSnapshot()
        let credential = (try? store.loadCredential()) ?? nil
        guard let credential else {
            return ForgeWidgetLoadResult(
                snapshot: nil,
                state: .reconnect,
                refreshDate: refreshDate
            )
        }

        var request = URLRequest(url: endpoint)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 15
        request.setValue(
            "Bearer \(credential.token)",
            forHTTPHeaderField: "Authorization"
        )

        do {
            let (data, statusCode) = try await transport.data(for: request)
            if statusCode == 401 || statusCode == 403 {
                try? store.clearCredentialAndCache()
                return ForgeWidgetLoadResult(
                    snapshot: nil,
                    state: .reconnect,
                    refreshDate: refreshDate
                )
            }
            guard statusCode == 200 else {
                return fallback(cached: cached, refreshDate: refreshDate)
            }
            let snapshot = try JSONDecoder.forgeWidgetDecoder().decode(
                ForgeWidgetSnapshot.self,
                from: data
            )
            guard snapshot.version == 1,
                  snapshot.companyID == credential.companyID,
                  snapshot.staffID == credential.staffID else {
                return fallback(cached: cached, refreshDate: refreshDate)
            }
            guard let activeCredential = try store.loadCredential(),
                  activeCredential == credential else {
                return ForgeWidgetLoadResult(
                    snapshot: nil,
                    state: .reconnect,
                    refreshDate: refreshDate
                )
            }
            try store.saveSnapshot(snapshot)
            return ForgeWidgetLoadResult(
                snapshot: snapshot,
                state: .connected,
                refreshDate: refreshDate
            )
        } catch {
            return fallback(cached: cached, refreshDate: refreshDate)
        }
    }

    private func fallback(
        cached: ForgeWidgetSnapshot?,
        refreshDate: Date
    ) -> ForgeWidgetLoadResult {
        ForgeWidgetLoadResult(
            snapshot: cached,
            state: cached == nil ? .unavailable : .cached,
            refreshDate: refreshDate
        )
    }
}
