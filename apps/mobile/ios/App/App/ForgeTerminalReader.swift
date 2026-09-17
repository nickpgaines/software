import Foundation
import StripeTerminal
import UIKit
import ProximityReader

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

    func connect(location: String, completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        if !initialized {
            // Set the operation's session before SDK init: initialization can request a token.
            Terminal.initWithTokenProvider(self)
            initialized = true
        }
        do {
            let discovery = try TapToPayDiscoveryConfigurationBuilder().setSimulated(Self.simulated).build()
            readerDelegate?.events.invalidate()
            let delegate = ForgeTapToPayReaderDelegate(events: TerminalReaderEventLease { [weak self] in self?.onDisconnect?() })
            readerDelegate = delegate
            let connection = try TapToPayConnectionConfigurationBuilder(delegate: delegate, locationId: location)
                .setAutoReconnectOnUnexpectedDisconnect(false).build()
            pending = true
            cancelable = Terminal.shared.easyConnect(TapToPayEasyConnectConfiguration(discoveryConfiguration: discovery, connectionConfiguration: connection)) { [self] reader, error in
                complete { completion(error.map { .failure(Self.map($0)) } ?? (reader == nil ? .failure(.terminalError) : .success(()))) }
            }
        } catch { completion(.failure(Self.map(error))) }
    }

    // An Xcode launch-environment flag is the only simulation switch. JavaScript
    // cannot enable it, and the flag is compiled out of Release.
    static var simulated: Bool {
        #if DEBUG
        return ProcessInfo.processInfo.environment["FORGE_TERMINAL_SIMULATED"] == "1"
        #else
        return false
        #endif
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

    func tapToPayReader(_ reader: Reader, didStartInstallingUpdate update: ReaderSoftwareUpdate, cancelable: Cancelable?) {}
    func tapToPayReader(_ reader: Reader, didReportReaderSoftwareUpdateProgress progress: Float) {}
    func tapToPayReader(_ reader: Reader, didFinishInstallingUpdate update: ReaderSoftwareUpdate?, error: Error?) {}
    func tapToPayReader(_ reader: Reader, didRequestReaderInput inputOptions: ReaderInputOptions) {}
    func tapToPayReader(_ reader: Reader, didRequestReaderDisplayMessage displayMessage: ReaderDisplayMessage) {}
    func reader(_ reader: Reader, didDisconnect reason: DisconnectReason) {
        events.didDisconnect(intentional: reason == .disconnectRequested)
    }
}
