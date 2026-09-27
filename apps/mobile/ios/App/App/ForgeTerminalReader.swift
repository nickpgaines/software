import Foundation
import StripeTerminal
import UIKit
import ProximityReader
import CoreLocation
import CoreBluetooth

final class ForgeTerminalReader: NSObject, TerminalReaderProviding, ConnectionTokenProvider {
    private let session: ForgeTerminalSession
    private let presenter: () -> UIViewController?
    private var initialized = false
    private var pending = false
    private var cancelable: Cancelable?
    private var cleanup: ((Result<Void, TerminalFailure>) -> Void)?
    private var payment: PaymentIntent?
    private var setup: SetupIntent?
    private var educationTask: Task<Void, Never>?
    // The SDK requires retaining this delegate until its reader disconnects.
    private var readerDelegate: ForgeTapToPayReaderDelegate?
    var onDisconnect: (() -> Void)?
    var onProgress: ((TerminalReaderProgress) -> Void)?

    var canWarmWithoutPrompt: Bool {
        // Reading authorization must not request it. Even simulated readers do
        // not bypass this guard: prepare explicitly on a fresh installation.
        let location = CLLocationManager().authorizationStatus
        return (location == .authorizedAlways || location == .authorizedWhenInUse)
            && CBManager.authorization == .allowedAlways
            && UIApplication.shared.applicationState == .active
    }

    private func initialize() {
        if !initialized { Terminal.initWithTokenProvider(self); initialized = true }
    }

    func accountLinkStatus(completion: @escaping (TerminalAccountLinkStatus) -> Void) {
        guard #available(iOS 16.4, *) else { completion(.unavailable); return }
        initialize() // Session must already be pinned before token provider init.
        pending = true
        // Direct charges: the connection token scopes the connected account.
        Terminal.shared.isTapToPayAccountLinked(nil) { [self] linked, error in
            complete {
                guard error == nil, let linked else { completion(.unavailable); return }
                completion(linked.boolValue ? .accepted : .setupRequired)
            }
        }
    }

    init(session: ForgeTerminalSession, presenter: @escaping () -> UIViewController?) {
        self.session = session
        self.presenter = presenter
    }

    func fetchConnectionToken(_ completion: @escaping ConnectionTokenCompletionBlock) {
        DispatchQueue.main.async { [self] in
            session.fetchToken { result in
                switch result {
                case .success(let token): completion(token, nil)
                case .failure(let error): completion(nil, NSError(domain: "ForgeTerminal", code: 1, userInfo: [NSLocalizedDescriptionKey: error.message]))
                }
            }
        }
    }

    func connect(location: String, permitsTerms: Bool, completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        initialize()
        do {
            let discovery = try TapToPayDiscoveryConfigurationBuilder().setSimulated(Self.simulated).build()
            readerDelegate?.events.invalidate()
            let delegate = ForgeTapToPayReaderDelegate(events: TerminalReaderEventLease(unexpectedDisconnect: { [weak self] in self?.onDisconnect?() }, progress: { [weak self] in self?.onProgress?($0) }))
            readerDelegate = delegate
            delegate.events.report(.init(phase: "preparing", message: "Preparing this iPhone for Tap to Pay…", progress: nil))
            let connection = try TapToPayConnectionConfigurationBuilder(delegate: delegate, locationId: location)
                .setAutoReconnectOnUnexpectedDisconnect(false)
                .setTosAcceptancePermitted(permitsTerms).build()
            pending = true
            cancelable = Terminal.shared.easyConnect(TapToPayEasyConnectConfiguration(discoveryConfiguration: discovery, connectionConfiguration: connection)) { [self] reader, error in
                complete { completion(error.map { .failure(Self.map($0)) } ?? (reader == nil ? .failure(.terminalError) : .success(()))) }
            }
        } catch { completion(.failure(Self.map(error))) }
    }

    // Simulation requires an isolated test origin; Release ignores both flags.
    static var simulated: Bool {
        TerminalSessionPolicy.configuration?.simulated == true
    }

    func educate(completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        guard #available(iOS 18.0, *), let controller = presenter() else {
            completion(.failure(.unsupported("Tap to Pay education requires iOS 18 or later."))); return
        }
        pending = true
        educationTask = Task { @MainActor [self] in
            do {
                let discovery = ProximityReaderDiscovery()
                let content = try await discovery.content(for: .payment(.howToTap))
                try Task.checkCancellation()
                try await discovery.presentContent(content, from: controller)
                try Task.checkCancellation()
                complete { completion(.success(())) }
            } catch { complete { completion(.failure(error is CancellationError ? .canceled : .terminalError)) } }
            educationTask = nil
        }
    }

    func retrieve(_ request: TerminalRequest, completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        pending = true
        switch request.kind {
        case .payment:
            Terminal.shared.retrievePaymentIntent(clientSecret: request.clientSecret) { [self] intent, error in
                complete { payment = intent; completion(error.map { .failure(Self.map($0)) } ?? (intent == nil ? .failure(.terminalError) : .success(()))) }
            }
        case .setup:
            Terminal.shared.retrieveSetupIntent(clientSecret: request.clientSecret) { [self] intent, error in
                complete { setup = intent; completion(error.map { .failure(Self.map($0)) } ?? (intent == nil ? .failure(.terminalError) : .success(()))) }
            }
        }
    }

    func collect(_ request: TerminalRequest, completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        do {
            switch request.kind {
            case .payment(let saveCard):
                guard let payment else { completion(.failure(.terminalError)); return }
                let config = try CollectPaymentIntentConfigurationBuilder().setSkipTipping(true)
                    .setAllowRedisplay(saveCard ? .limited : .unspecified).build()
                pending = true
                cancelable = Terminal.shared.collectPaymentMethod(payment, collectConfig: config) { [self] intent, error in
                    complete { self.payment = intent; completion(error.map { .failure(Self.map($0)) } ?? (intent == nil ? .failure(.terminalError) : .success(()))) }
                }
            case .setup:
                guard let setup else { completion(.failure(.terminalError)); return }
                pending = true
                cancelable = Terminal.shared.collectSetupIntentPaymentMethod(setup, allowRedisplay: .limited) { [self] intent, error in
                    complete { self.setup = intent; completion(error.map { .failure(Self.map($0)) } ?? (intent == nil ? .failure(.terminalError) : .success(()))) }
                }
            }
        } catch { completion(.failure(Self.map(error))) }
    }

    func confirm(completion: @escaping (Result<String, TerminalFailure>) -> Void) {
        if let payment {
            pending = true
            cancelable = Terminal.shared.confirmPaymentIntent(payment) { [self] intent, error in
                complete { completion(error == nil ? intent?.stripeId.map(Result.success) ?? .failure(.unknown) : .failure(.unknown)) }
            }
        } else if let setup {
            pending = true
            cancelable = Terminal.shared.confirmSetupIntent(setup) { [self] intent, error in
                complete { completion(error == nil ? intent?.stripeId.map(Result.success) ?? .failure(.unknown) : .failure(.unknown)) }
            }
        } else { completion(.failure(.terminalError)) }
    }

    func cleanUp(completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        precondition(cleanup == nil)
        // Invalidate before requesting cancellation: disconnect notifications
        // have no ordering guarantee relative to SDK cleanup callbacks.
        readerDelegate?.events.invalidate()
        cleanup = completion
        if pending {
            educationTask?.cancel()
            // Do not release the generation on cancel acknowledgement alone.
            // The SDK operation callback must drain before credentials are cleared.
            cancelable?.cancel { _ in }
            return
        }
        disconnectAndClear()
    }

    func clearOperation(completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        guard !pending, cleanup == nil else { completion(.failure(.busy)); return }
        payment = nil
        setup = nil
        cancelable = nil
        guard initialized, Terminal.shared.connectedReader != nil,
              UIApplication.shared.applicationState == .active else { completion(.failure(.terminalError)); return }
        completion(.success(()))
    }

    private func complete(_ callback: () -> Void) {
        pending = false
        cancelable = nil
        if cleanup != nil { disconnectAndClear() } else { callback() }
    }

    private func disconnectAndClear() {
        payment = nil
        setup = nil
        guard initialized else { finishCleanup(.success(())); return }
        if Terminal.shared.connectedReader != nil {
            Terminal.shared.disconnectReader { [self] error in
                guard error == nil else { finishCleanup(.failure(.terminalError)); return }
                clearCredentials()
            }
        } else { clearCredentials() }
    }

    private func clearCredentials() {
        finishCleanup(Terminal.shared.clearCachedCredentials().mapError { _ in .terminalError })
    }

    private func finishCleanup(_ result: Result<Void, TerminalFailure>) {
        if case .success = result { readerDelegate = nil }
        let callback = cleanup
        cleanup = nil
        callback?(result)
    }

    private static func map(_ error: Error) -> TerminalFailure {
        let error = error as NSError
        guard error.domain == ErrorDomain else { return .terminalError }
        switch error.code {
        case ErrorCode.canceled.rawValue, ErrorCode.tapToPayReaderTOSAcceptanceCanceled.rawValue: return .canceled
        case ErrorCode.commandNotAllowed.rawValue:
            return .unsupported("Tap to Pay requires an Apple-approved, correctly provisioned Forge build. Use manual card entry.")
        case ErrorCode.unsupportedMobileDeviceConfiguration.rawValue, ErrorCode.unsupportedSDK.rawValue:
            return .unsupported("Update Forge and install a released iOS version supported by Stripe on a compatible iPhone. Use manual card entry for now.")
        case ErrorCode.locationServicesDisabled.rawValue:
            return .unsupported("Enable Location Services and allow Forge location access in Settings, or use manual card entry.")
        case ErrorCode.bluetoothDisabled.rawValue, ErrorCode.bluetoothAccessDenied.rawValue:
            return .unsupported("Enable Bluetooth and allow Forge Bluetooth access in Settings, or use manual card entry.")
        case ErrorCode.passcodeNotEnabled.rawValue:
            return .unsupported("Set an iPhone passcode in Settings before using Tap to Pay.")
        case ErrorCode.tapToPayReaderTOSAcceptanceRequiresiCloudSignIn.rawValue:
            return .unsupported("Sign in to an Apple Account on this iPhone to accept Tap to Pay terms.")
        case ErrorCode.tapToPayReaderTOSNotYetAccepted.rawValue:
            return TerminalFailure(code: "setup_required", message: "An authorized administrator must finish Tap to Pay setup in Settings → Payments before accepting payments.")
        default: break
        }
        // Deliberately omit SDK diagnostic strings, which can contain provider identifiers.
        return .terminalError
    }

}

/// Never reuse a delegate across easyConnect calls. Its lease ties every event
/// to the originating connection, including callbacks retained by the SDK.
private final class ForgeTapToPayReaderDelegate: NSObject, TapToPayReaderDelegate {
    let events: TerminalReaderEventLease

    init(events: TerminalReaderEventLease) { self.events = events }

    func tapToPayReader(_ reader: Reader, didStartInstallingUpdate update: ReaderSoftwareUpdate, cancelable: Cancelable?) {
        events.report(.init(phase: "updating", message: "Configuring Tap to Pay. Keep Forge open; this can take a few minutes.", progress: 0))
    }
    func tapToPayReader(_ reader: Reader, didReportReaderSoftwareUpdateProgress progress: Float) {
        guard progress.isFinite else { return }
        events.report(.init(phase: "updating", message: "Configuring Tap to Pay…", progress: min(1, max(0, Double(progress)))))
    }
    func tapToPayReader(_ reader: Reader, didFinishInstallingUpdate update: ReaderSoftwareUpdate?, error: Error?) {
        events.report(.init(phase: error == nil ? "preparing" : "error", message: error == nil ? "Configuration complete. Connecting…" : "Configuration could not finish. Check your connection and try again.", progress: nil))
    }
    func tapToPayReader(_ reader: Reader, didRequestReaderInput inputOptions: ReaderInputOptions) {
        events.report(.init(phase: "input", message: Terminal.stringFromReaderInputOptions(inputOptions), progress: nil))
    }
    func tapToPayReader(_ reader: Reader, didRequestReaderDisplayMessage displayMessage: ReaderDisplayMessage) {
        events.report(.init(phase: "input", message: Terminal.stringFromReaderDisplayMessage(displayMessage), progress: nil))
    }
    func reader(_ reader: Reader, didDisconnect reason: DisconnectReason) {
        events.didDisconnect(intentional: reason == .disconnectRequested)
    }
}
