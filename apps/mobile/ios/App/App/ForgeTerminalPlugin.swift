import Capacitor
import CoreLocation
import ProximityReader
import WebKit
import OSLog

@objc(ForgeTerminalPlugin)
public final class ForgeTerminalPlugin: CAPPlugin, CAPBridgedPlugin, WKHTTPCookieStoreObserver {
    public let identifier = "ForgeTerminalPlugin"
    public let jsName = "ForgeTerminal"
    public let pluginMethods: [CAPPluginMethod] = ["getCapabilities", "shareDeclinedDocument", "warmUp", "prepareDevice", "showEducation", "collectPayment", "collectSetup", "cancel", "reset"].map {
        CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise)
    }
    private let runtime = ForgeTerminalRuntime.shared
    private var navigation: NSKeyValueObservation?
    private var background: NSObjectProtocol?

    public override func load() {
        DispatchQueue.main.async { [self] in
            runtime.attach(webView: bridge?.webView, presenter: bridge?.viewController)
            runtime.coordinator.onReaderPresentation = { seconds in
                Logger(subsystem: "app.forgecrm", category: "TerminalTiming").debug("collection_to_first_input_seconds=\(seconds, privacy: .public)")
            }
            runtime.coordinator.onReadiness = { [weak self] state in self?.notifyListeners("terminalReadiness", data: ["state": state.rawValue]) }
            runtime.coordinator.onProgress = { [weak self] id, update in
                var data: [String: Any] = ["operationId": id, "phase": update.phase, "message": update.message]
                if let progress = update.progress { data["progress"] = progress }
                self?.notifyListeners("terminalProgress", data: data)
            }
            navigation = bridge?.webView?.observe(\.url, options: [.new]) { [weak self] _, _ in
                DispatchQueue.main.async { self?.runtime.checkSession() }
            }
            bridge?.webView?.configuration.websiteDataStore.httpCookieStore.add(self)
            background = NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
                self?.runtime.coordinator.cancel(reason: .canceled)
            }
        }
    }

    deinit {
        if let background { NotificationCenter.default.removeObserver(background) }
        bridge?.webView?.configuration.websiteDataStore.httpCookieStore.remove(self)
    }

    public func cookiesDidChange(in cookieStore: WKHTTPCookieStore) {
        DispatchQueue.main.async { [weak self] in self?.runtime.checkSession() }
    }

    @objc func getCapabilities(_ call: CAPPluginCall) {
        onMain(call) {
            guard let mode = TerminalSessionPolicy.configuration?.providerMode else { call.reject("Invalid Terminal environment", "session_changed"); return }
            if let reason = Self.unavailableReason { call.resolve(["supported": false, "reason": reason, "providerMode": mode, "declinedDocumentSharingSupported": true]) }
            else { call.resolve(["supported": true, "preparationSupported": true, "warmupSupported": true, "declinedDocumentSharingSupported": true, "readiness": self.runtime.coordinator.readiness.rawValue, "providerMode": mode]) }
        }
    }

    @objc func warmUp(_ call: CAPPluginCall) {
        onMain(call) { [self] in
            if let reason = Self.unavailableReason { reject(call, .unsupported(reason)); return }
            guard UIApplication.shared.applicationState == .active,
                  let account = call.getString("stripeAccount"), let location = call.getString("locationId") else { reject(call, .terminalError); return }
            runtime.coordinator.warmUp(account: account, location: location) { [self] result in
                switch result { case .success(let state): call.resolve(["state": state.rawValue]); case .failure(let error): reject(call, error) }
            }
        }
    }

    @objc func prepareDevice(_ call: CAPPluginCall) {
        onMain(call) { [self] in
            if let reason = Self.unavailableReason { reject(call, .unsupported(reason)); return }
            guard let id = call.getString("operationId"), let account = call.getString("stripeAccount"),
                  let location = call.getString("locationId") else { reject(call, .terminalError); return }
            runtime.coordinator.prepareDevice(operationID: id, account: account, locationID: location,
                representativeConfirmed: call.getBool("representativeConfirmed") ?? false) { [self] in resolve(call, $0) }
        }
    }

    @objc func showEducation(_ call: CAPPluginCall) {
        onMain(call) { [self] in
            guard #available(iOS 18.0, *) else { reject(call, .unsupported("How to Tap requires iOS 18 or later.")); return }
            runtime.coordinator.showEducation { [self] in resolve(call, $0) }
        }
    }

    @objc func collectPayment(_ call: CAPPluginCall) { collect(call, kind: .payment(saveCard: call.getBool("saveCard") ?? false)) }
    @objc func collectSetup(_ call: CAPPluginCall) { collect(call, kind: .setup) }
    @objc func shareDeclinedDocument(_ call: CAPPluginCall) {
        onMain(call) { [self] in
            guard let text = call.getString("text") else { reject(call, .terminalError); return }
            runtime.shareDocument(text: text) { result in
                switch result {
                case .success(let shared): call.resolve(["status": shared ? "shared" : "canceled"])
                case .failure: call.reject("Document sharing is unavailable. No delivery has been confirmed.")
                }
            }
        }
    }
    @objc func cancel(_ call: CAPPluginCall) { onMain(call) { [self] in runtime.coordinator.cancel(reason: .canceled) { [self] in resolve(call, $0) } } }
    @objc func reset(_ call: CAPPluginCall) { onMain(call) { [self] in runtime.cancelDocumentShare(); runtime.coordinator.cancel(reason: .sessionChanged) { [self] in resolve(call, $0) } } }

    private func collect(_ call: CAPPluginCall, kind: TerminalRequest.Kind) {
        onMain(call) { [self] in
            if let reason = Self.unavailableReason { reject(call, .unsupported(reason)); return }
            guard let id = call.getString("operationId"), let secret = call.getString("clientSecret"),
                  let account = call.getString("stripeAccount"), let location = call.getString("locationId") else {
                reject(call, .terminalError); return
            }
            runtime.coordinator.collect(TerminalRequest(operationID: id, clientSecret: secret, account: account, locationID: location, kind: kind)) { [self] result in
                switch result { case .success(let id): call.resolve(["intentId": id]); case .failure(let error): reject(call, error) }
            }
        }
    }

    private func onMain(_ call: CAPPluginCall, action: @escaping () -> Void) {
        DispatchQueue.main.async { [self] in
            guard TerminalSessionPolicy.isTrusted(bridge?.webView?.url) else { reject(call, .sessionChanged); return }
            action()
        }
    }

    private func resolve(_ call: CAPPluginCall, _ result: Result<Void, TerminalFailure>) {
        switch result { case .success: call.resolve(); case .failure(let error): reject(call, error) }
    }
    private func reject(_ call: CAPPluginCall, _ error: TerminalFailure) { call.reject(error.message, error.code) }

    private static var unavailableReason: String? {
        guard #available(iOS 18.0, *) else { return "Tap to Pay requires iOS 18 or later. Use manual card entry on this device." }
        #if DEBUG
        if ForgeTerminalReader.simulated { return nil }
        #endif
        #if !FORGE_TAP_TO_PAY_ENABLED
        return "Tap to Pay is not enabled in this Forge build. Use manual card entry until an approved build is installed."
        #else
        guard PaymentCardReader.isSupported else { return "This device does not support Tap to Pay. Use a compatible iPhone or manual card entry." }
        let permission = CLLocationManager().authorizationStatus
        if permission == .denied || permission == .restricted { return "Allow location access in Settings to use Tap to Pay, or use manual card entry." }
        return nil
        #endif
    }
}

/// Process lifetime ownership matches Terminal's singleton lifetime. Recreating
/// a Capacitor bridge never replaces the SDK token provider or initializes twice.
private final class ForgeTerminalRuntime {
    static let shared = ForgeTerminalRuntime()
    private weak var webView: WKWebView?
    private weak var presenter: UIViewController?
    private let http = TerminalHTTPSClient()
    private let document = ForgeTerminalDocument()
    private var documentSheet: UIActivityViewController?
    private var documentCompletion: ((Result<Bool, Error>) -> Void)?
    func shareDocument(text: String, completion: @escaping (Result<Bool, Error>) -> Void) {
        guard UIApplication.shared.applicationState == .active, documentSheet == nil,
              let presenter, presenter.viewIfLoaded?.window != nil, presenter.presentedViewController == nil else {
            completion(.failure(TerminalFailure.terminalError)); return
        }
        do {
            let url = try document.begin(text: text)
            let sheet = TerminalDocumentPresentation.controller(url: url, presenter: presenter)
            documentSheet = sheet; documentCompletion = completion
            sheet.completionWithItemsHandler = { [weak self, weak sheet] _, completed, _, error in
                guard let self, self.documentSheet === sheet else { return }
                self.finishDocumentShare(error.map { .failure($0) } ?? .success(completed))
            }
            presenter.present(sheet, animated: true)
        } catch { document.finish(); completion(.failure(error)) }
    }
    private func finishDocumentShare(_ result: Result<Bool, Error>) {
        let completion = documentCompletion
        documentCompletion = nil; documentSheet = nil; document.finish()
        completion?(result)
    }
    func cancelDocumentShare() {
        documentSheet?.dismiss(animated: false)
        finishDocumentShare(.success(false))
    }
    private lazy var session = ForgeTerminalSession(snapshot: { [weak self] completion in
        guard let webView = self?.webView else { completion(nil, []); return }
        webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { [weak webView] cookies in completion(webView?.url, cookies) }
    }, transport: { [weak self] request, completion in
        guard let self else { completion(nil, nil, TerminalFailure.sessionChanged); return }
        http.send(request, completion: completion)
    })
    private lazy var reader: ForgeTerminalReader = {
        let reader = ForgeTerminalReader(session: session, presenter: { [weak self] in
            var controller = self?.presenter
            while let current = controller {
                if let presented = current.presentedViewController, !presented.isBeingDismissed { controller = presented }
                else if let navigation = current as? UINavigationController, let visible = navigation.visibleViewController { controller = visible }
                else if let tabs = current as? UITabBarController, let selected = tabs.selectedViewController { controller = selected }
                else { break }
            }
            return controller
        })
        reader.onDisconnect = { [weak self] in self?.coordinator.cancel(reason: .terminalError) }
        return reader
    }()
    lazy var coordinator = ForgeTerminalCoordinator(provider: reader, session: session)

    func attach(webView: WKWebView?, presenter: UIViewController?) {
        if self.webView != nil && self.webView !== webView { cancelDocumentShare(); coordinator.cancel(reason: .sessionChanged) }
        self.webView = webView
        self.presenter = presenter
    }
    func checkSession() {
        if !TerminalSessionPolicy.isTrusted(webView?.url) { cancelDocumentShare(); coordinator.cancel(reason: .sessionChanged); return }
        session.checkCurrent { [weak self] current in if !current { self?.cancelDocumentShare(); self?.coordinator.cancel(reason: .sessionChanged) } }
    }
}
