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

enum TerminalSessionPurpose: Equatable {
    case collection
    case warmup
    case preparation(representativeConfirmed: Bool)

    var requestsTerms: Bool {
        if case .preparation(representativeConfirmed: true) = self { return true }
        return false
    }
}

enum TerminalAccountLinkStatus { case accepted, setupRequired, unavailable }
enum TerminalReadinessState: String { case disconnected, warming, ready, collecting, cleaning }

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
    var tosAcceptancePermitted: Bool { get }
    func begin(account: String, location: String?, purpose: TerminalSessionPurpose, completion: @escaping (Result<Void, TerminalFailure>) -> Void)
    func validate(completion: @escaping (Result<Void, TerminalFailure>) -> Void)
    func end()
}

protocol TerminalReaderProviding: AnyObject {
    var canWarmWithoutPrompt: Bool { get }
    func accountLinkStatus(completion: @escaping (TerminalAccountLinkStatus) -> Void)
    var onProgress: ((TerminalReaderProgress) -> Void)? { get set }
    // Must drain/cancel outstanding SDK work before disconnecting and clearing.
    // Failure leaves the coordinator locked; another generation may never reuse it.
    func cleanUp(completion: @escaping (Result<Void, TerminalFailure>) -> Void)
    func clearOperation(completion: @escaping (Result<Void, TerminalFailure>) -> Void)
    func connect(location: String, permitsTerms: Bool, completion: @escaping (Result<Void, TerminalFailure>) -> Void)
    func educate(completion: @escaping (Result<Void, TerminalFailure>) -> Void)
    func retrieve(_ request: TerminalRequest, completion: @escaping (Result<Void, TerminalFailure>) -> Void)
    func collect(_ request: TerminalRequest, completion: @escaping (Result<Void, TerminalFailure>) -> Void)
    func confirm(completion: @escaping (Result<String, TerminalFailure>) -> Void)
}

final class ForgeTerminalCoordinator {
    var onReaderPresentation: ((Double) -> Void)?
    private var collectionStarted: TimeInterval?
    private(set) var readiness: TerminalReadinessState = .disconnected
    private struct Binding: Equatable { let account: String; let location: String }
    private var warmBinding: Binding?
    private var warmWaiters: [(Result<TerminalReadinessState, TerminalFailure>) -> Void] = []
    func warmUp(account: String, location: String, completion: @escaping (Result<TerminalReadinessState, TerminalFailure>) -> Void) {
        precondition(Thread.isMainThread)
        let binding = Binding(account: account, location: location)
        if readiness == .warming, warmBinding == binding { warmWaiters.append(completion); return }
        guard !busy else { completion(.failure(.busy)); return }
        guard account.hasPrefix("acct_"), location.hasPrefix("tml_") else { completion(.failure(.terminalError)); return }
        guard provider.canWarmWithoutPrompt else {
            completion(.failure(TerminalFailure(code: "setup_required", message: "Open Payments settings to prepare this iPhone."))); return
        }
        warmBinding = binding
        warmWaiters = [completion]
        readiness = .warming
        let stages: [Stage] = [
            { [session] in session.begin(account: account, location: location, purpose: .warmup, completion: $0) },
            { [provider] done in provider.accountLinkStatus { status in
                switch status {
                case .accepted: done(.success(()))
                case .setupRequired: done(.failure(TerminalFailure(code: "setup_required", message: "An authorized administrator must finish Tap to Pay setup in Payments settings.")))
                case .unavailable: done(.failure(.terminalError))
                }
            } },
            { [session] in session.validate(completion: $0) },
            { [provider] in provider.connect(location: location, permitsTerms: false, completion: $0) },
            { [session] in session.validate(completion: $0) },
        ]
        run(id: UUID().uuidString, account: account, stages: stages, confirmsIntent: false, keepWarm: true) { [self] result in
            let waiters = warmWaiters
            warmWaiters.removeAll()
            let outcome = result.map { _ in readiness }
            waiters.forEach { $0(outcome) }
        }
    }
    var onProgress: ((String, TerminalReaderProgress) -> Void)?
    private let provider: TerminalReaderProviding
    private let session: TerminalSessionProviding
    private let state = TerminalOperationState()
    private var busy = false
    private var cleaning = false
    private var initialCleanup = false
    private var deferredCleanup: ((Result<Void, TerminalFailure>) -> Void)?
    private var confirming = false
    private var keepWarm = false
    private var reuseIdle = false
    private var waitingCollection = false
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
        let binding = Binding(account: request.account, location: request.locationID)
        if readiness == .warming, warmBinding == binding, !waitingCollection {
            waitingCollection = true
            warmWaiters.append { [self] result in
                waitingCollection = false
                switch result {
                case .success: collect(request, completion: completion)
                case .failure(let failure): completion(.failure(failure))
                }
            }
            return
        }
        guard !busy else { completion(.failure(.busy)); return }
        guard !request.operationID.isEmpty, !request.clientSecret.isEmpty,
              request.account.hasPrefix("acct_"), request.locationID.hasPrefix("tml_") else {
            completion(.failure(.terminalError)); return
        }
        let reuse = readiness == .ready && warmBinding == binding
        var stages: [Stage] = []
        // Validate the old pinned cookie before replacing the session context.
        if reuse { stages.append { [session] in session.validate(completion: $0) } }
        stages.append { [session] in session.begin(account: request.account, location: request.locationID, purpose: .collection, completion: $0) }
        if !reuse { stages.append { [provider] in provider.connect(location: request.locationID, permitsTerms: false, completion: $0) } }
        stages += [
            // Education belongs to device preparation and the on-demand How to Tap action.
            { [provider] in provider.retrieve(request, completion: $0) },
            { [session] in session.validate(completion: $0) },
            { [provider] in provider.collect(request, completion: $0) },
            { [session] in session.validate(completion: $0) },
        ]
        readiness = .collecting
        collectionStarted = ProcessInfo.processInfo.systemUptime
        run(id: request.operationID, account: request.account, stages: stages, confirmsIntent: true, reuseIdle: reuse, completion: completion)
    }

    func prepareDevice(operationID: String, account: String, locationID: String, representativeConfirmed: Bool,
                       completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        precondition(Thread.isMainThread)
        guard !busy else { completion(.failure(.busy)); return }
        guard !operationID.isEmpty, account.hasPrefix("acct_"), locationID.hasPrefix("tml_") else {
            completion(.failure(.terminalError)); return
        }
        let stages: [Stage] = [
            { [session] in session.begin(account: account, location: locationID, purpose: .preparation(representativeConfirmed: representativeConfirmed), completion: $0) },
            { [provider, session] in provider.connect(location: locationID, permitsTerms: representativeConfirmed && session.tosAcceptancePermitted, completion: $0) },
            { [provider] in provider.educate(completion: $0) },
            { [session] in session.validate(completion: $0) },
        ]
        run(id: operationID, account: account, stages: stages, confirmsIntent: false) { completion($0.map { _ in () }) }
    }

    private func run(id: String, account: String, stages: [Stage], confirmsIntent: Bool, keepWarm: Bool = false, reuseIdle: Bool = false,
                     completion: @escaping (Result<String, TerminalFailure>) -> Void) {
        let lease: TerminalOperationState.Lease
        do { lease = try state.begin(id: id, account: account) }
        catch { completion(.failure(.busy)); return }
        busy = true
        self.keepWarm = keepWarm
        self.reuseIdle = reuseIdle
        self.completion = completion
        provider.onProgress = { [weak self] update in
            guard let self, self.state.isCurrent(lease) else { return }
            if update.phase == "input", let started = self.collectionStarted {
                self.collectionStarted = nil
                self.onReaderPresentation?(max(0, ProcessInfo.processInfo.systemUptime - started))
            }
            self.onProgress?(id, update)
        }
        if reuseIdle { advance(stages, index: 0, lease: lease, confirmsIntent: confirmsIntent); return }
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
            advance(stages, index: 0, lease: lease, confirmsIntent: confirmsIntent)
        }
    }

    func cancel(reason: TerminalFailure, completion: ((Result<Void, TerminalFailure>) -> Void)? = nil) {
        precondition(Thread.isMainThread)
        if let completion { cleanupWaiters.append(completion) }
        if cleaning { return }
        finish(.failure(confirming ? .unknown : reason))
    }

    private typealias Stage = (@escaping (Result<Void, TerminalFailure>) -> Void) -> Void

    private func advance(_ stages: [Stage], index: Int, lease: TerminalOperationState.Lease, confirmsIntent: Bool) {
        guard state.isCurrent(lease) else { return }
        guard index < stages.count else {
            guard confirmsIntent else {
                if keepWarm {
                    state.invalidate()
                    busy = false
                    readiness = .ready
                    let callback = completion
                    completion = nil
                    callback?(.success(""))
                } else { finish(.success(""), requireCleanupSuccess: true) }
                return
            }
            confirming = true
            provider.confirm { [self] result in
                guard state.isCurrent(lease) else { return }
                if reuseIdle, case .success = result {
                    provider.clearOperation { [self] cleanup in
                        guard state.isCurrent(lease) else { return }
                        guard case .success = cleanup else { finish(result, cleanupAlreadyFailed: true); return }
                        session.validate { [self] validation in
                            guard state.isCurrent(lease) else { return }
                            guard case .success = validation else { finish(result); return }
                            state.invalidate()
                            confirming = false
                            busy = false
                            readiness = .ready
                            let callback = completion
                            completion = nil
                            callback?(result)
                        }
                    }
                    return
                }
                finish(result.mapError { _ in .unknown })
            }
            return
        }
        stages[index]({ [self] result in
            guard state.isCurrent(lease) else { return }
            switch result {
            case .success: advance(stages, index: index + 1, lease: lease, confirmsIntent: confirmsIntent)
            case .failure(let error): finish(.failure(error))
            }
        })
    }

    private func finish(_ result: Result<String, TerminalFailure>, cleanupAlreadyFailed: Bool = false, requireCleanupSuccess: Bool = false) {
        guard !cleaning else { return }
        state.invalidate()
        collectionStarted = nil
        warmBinding = nil
        keepWarm = false
        readiness = .cleaning
        session.end() // immediately revoke pending token requests
        cleaning = true
        busy = true
        let deliver: (Result<Void, TerminalFailure>) -> Void = { [self] cleanup in
            let callback = completion
            completion = nil
            confirming = false
            cleaning = false
            if case .success = cleanup { busy = false; readiness = .disconnected }
            // A successful provider result still requires server reconciliation;
            // cleanup failure keeps the reader locked but must not hide payment.
            if requireCleanupSuccess, case .success = result, case .failure = cleanup {
                callback?(.failure(TerminalFailure(code: "cleanup_failed", message: "Tap to Pay setup could not finish safely. Restart Forge before preparing this iPhone again.")))
            } else {
                callback?(result)
            }
            let waiters = cleanupWaiters
            cleanupWaiters.removeAll()
            waiters.forEach { $0(cleanup) }
        }
        if initialCleanup { deferredCleanup = deliver }
        else if cleanupAlreadyFailed { deliver(.failure(.terminalError)) }
        else { provider.cleanUp(completion: deliver) }
    }
}
