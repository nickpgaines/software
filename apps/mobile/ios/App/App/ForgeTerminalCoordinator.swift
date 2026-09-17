import Foundation

struct TerminalFailure: Error, Equatable {
    let code: String
    let message: String
    static let busy = Self(code: "busy", message: "A reader operation is still active. Wait for cleanup or restart Forge.")
    static let canceled = Self(code: "canceled", message: "Tap to Pay was canceled.")
    static let sessionChanged = Self(code: "session_changed", message: "Your session changed. Sign in and recover this attempt before trying again.")
    static let unknown = Self(code: "payment_unknown", message: "The result is not yet known. Check this attempt before taking another payment.")
    static let terminalError = Self(code: "terminal_error", message: "The reader could not complete this operation. Check permissions and connection, then recover this attempt.")
    static func unsupported(_ message: String) -> Self { Self(code: "unsupported", message: message) }
}

struct TerminalRequest {
    enum Kind { case payment(saveCard: Bool), setup }
    let operationID: String
    let clientSecret: String
    let account: String
    let locationID: String
    let kind: Kind
}

final class TerminalOperationState {
    struct Lease: Equatable { let generation: UUID; let id: String; let account: String }
    private var active: Lease?
    func begin(id: String, account: String) throws -> Lease {
        guard active == nil else { throw TerminalFailure.busy }
        let lease = Lease(generation: UUID(), id: id, account: account)
        active = lease
        return lease
    }
    func isCurrent(_ lease: Lease) -> Bool { active == lease }
    func invalidate() { active = nil }
}

// All calls and provider callbacks run on the main queue. This also serializes
// WebView navigation, cookie-change and application-background notifications.
protocol TerminalSessionProviding: AnyObject {
    func begin(account: String, completion: @escaping (Result<Void, TerminalFailure>) -> Void)
    func validate(completion: @escaping (Result<Void, TerminalFailure>) -> Void)
    func end()
}

protocol TerminalReaderProviding: AnyObject {
    // Must drain/cancel outstanding SDK work before disconnecting and clearing.
    // Failure leaves the coordinator locked; another generation may never reuse it.
    func cleanUp(completion: @escaping (Result<Void, TerminalFailure>) -> Void)
    func connect(location: String, completion: @escaping (Result<Void, TerminalFailure>) -> Void)
    func educate(completion: @escaping (Result<Void, TerminalFailure>) -> Void)
    func retrieve(_ request: TerminalRequest, completion: @escaping (Result<Void, TerminalFailure>) -> Void)
    func collect(_ request: TerminalRequest, completion: @escaping (Result<Void, TerminalFailure>) -> Void)
    func confirm(completion: @escaping (Result<String, TerminalFailure>) -> Void)
}

final class ForgeTerminalCoordinator {
    private let provider: TerminalReaderProviding
    private let session: TerminalSessionProviding
    private let state = TerminalOperationState()
    private var busy = false
    private var cleaning = false
    private var initialCleanup = false
    private var deferredCleanup: ((Result<Void, TerminalFailure>) -> Void)?
    private var confirming = false
    private var completion: ((Result<String, TerminalFailure>) -> Void)?
    private var cleanupWaiters: [(Result<Void, TerminalFailure>) -> Void] = []

    init(provider: TerminalReaderProviding, session: TerminalSessionProviding) {
        self.provider = provider
        self.session = session
    }

    func showEducation(completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        guard !busy else { completion(.failure(.busy)); return }
        let lease = try! state.begin(id: UUID().uuidString, account: "education")
        busy = true
        self.completion = { completion($0.map { _ in () }) }
        provider.educate { [self] result in
            guard state.isCurrent(lease) else { return }
            finish(result.map { "" })
        }
    }

    func collect(_ request: TerminalRequest, completion: @escaping (Result<String, TerminalFailure>) -> Void) {
        precondition(Thread.isMainThread)
        guard !busy else { completion(.failure(.busy)); return }
        guard !request.operationID.isEmpty, !request.clientSecret.isEmpty,
              request.account.hasPrefix("acct_"), request.locationID.hasPrefix("tml_") else {
            completion(.failure(.terminalError)); return
        }
        let lease: TerminalOperationState.Lease
        do { lease = try state.begin(id: request.operationID, account: request.account) }
        catch { completion(.failure(.busy)); return }
        busy = true
        self.completion = completion
        initialCleanup = true
        provider.cleanUp { [self] result in
            initialCleanup = false
            if let deferred = deferredCleanup {
                deferredCleanup = nil
                deferred(result)
                return
            }
            guard state.isCurrent(lease) else { return }
            guard case .success = result else { finish(result.map { "" }, cleanupAlreadyFailed: true); return }
            let stages: [Stage] = [
                { [session] in session.begin(account: request.account, completion: $0) },
                { [provider] in provider.connect(location: request.locationID, completion: $0) },
                { [provider] in provider.educate(completion: $0) },
                { [provider] in provider.retrieve(request, completion: $0) },
                { [session] in session.validate(completion: $0) },
                { [provider] in provider.collect(request, completion: $0) },
                { [session] in session.validate(completion: $0) },
            ]
            advance(stages, index: 0, lease: lease)
        }
    }

    func cancel(reason: TerminalFailure, completion: ((Result<Void, TerminalFailure>) -> Void)? = nil) {
        precondition(Thread.isMainThread)
        if let completion { cleanupWaiters.append(completion) }
        if cleaning { return }
        finish(.failure(confirming ? .unknown : reason))
    }

    private typealias Stage = (@escaping (Result<Void, TerminalFailure>) -> Void) -> Void

    private func advance(_ stages: [Stage], index: Int, lease: TerminalOperationState.Lease) {
        guard state.isCurrent(lease) else { return }
        guard index < stages.count else {
            confirming = true
            provider.confirm { [self] result in
                guard state.isCurrent(lease) else { return }
                finish(result.mapError { _ in .unknown })
            }
            return
        }
        stages[index]({ [self] result in
            guard state.isCurrent(lease) else { return }
            switch result {
            case .success: advance(stages, index: index + 1, lease: lease)
            case .failure(let error): finish(.failure(error))
            }
        })
    }

    private func finish(_ result: Result<String, TerminalFailure>, cleanupAlreadyFailed: Bool = false) {
        guard !cleaning else { return }
        state.invalidate()
        session.end() // immediately revoke pending token requests
        cleaning = true
        busy = true
        let deliver: (Result<Void, TerminalFailure>) -> Void = { [self] cleanup in
            let callback = completion
            completion = nil
            confirming = false
            cleaning = false
            if case .success = cleanup { busy = false }
            // A successful provider result still requires server reconciliation;
            // cleanup failure keeps the reader locked but must not hide payment.
            callback?(result)
            let waiters = cleanupWaiters
            cleanupWaiters.removeAll()
            waiters.forEach { $0(cleanup) }
        }
        if initialCleanup { deferredCleanup = deliver }
        else if cleanupAlreadyFailed { deliver(.failure(.terminalError)) }
        else { provider.cleanUp(completion: deliver) }
    }
}
