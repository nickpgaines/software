import XCTest
#if !TERMINAL_STANDALONE
@testable import App
#endif

final class ForgeTerminalTests: XCTestCase {
    func testDocumentSessionPinsCookieWithoutAReaderAndRejectsReplacement() {
        var value = "merchant-one"
        var trusted = true
        let guardSession = ForgeTerminalDocumentSession(snapshot: { completion in
            completion(URL(string: trusted ? "https://www.forgecrm.app/schedule/12" : "https://example.invalid"), [HTTPCookie(properties: [.name: "crm_session", .value: value, .domain: "www.forgecrm.app", .path: "/", .secure: "TRUE"])!])
        })
        guardSession.begin { XCTAssertTrue($0) }
        guardSession.checkCurrent { XCTAssertTrue($0) }
        value = "merchant-two"
        guardSession.checkCurrent { XCTAssertFalse($0) }
        guardSession.end()
        guardSession.begin { XCTAssertTrue($0) }
        trusted = false
        guardSession.checkCurrent { XCTAssertFalse($0) }
        guardSession.end()
        guardSession.begin { XCTAssertFalse($0) }
    }
    func testCanceledDocumentPinCannotRestoreAReplacementShare() {
        var snapshots: [((URL?, [HTTPCookie]) -> Void)] = []
        let guardSession = ForgeTerminalDocumentSession(snapshot: { snapshots.append($0) })
        var stale: Bool?
        guardSession.begin { stale = $0 }
        guardSession.end()
        let cookies = [HTTPCookie(properties: [.name: "crm_session", .value: "a", .domain: "www.forgecrm.app", .path: "/", .secure: "TRUE"])!]
        snapshots.removeFirst()(URL(string: "https://www.forgecrm.app"), cookies)
        XCTAssertEqual(stale, false)
    }
    func testDeclinedDocumentUsesPrivateBoundedFileAndOneActiveShare() throws {
        let document = ForgeTerminalDocument()
        let text = "Declined transaction — not proof of payment\nUSD 225.00"
        let url = try document.begin(text: text)
        XCTAssertEqual(try String(contentsOf: url, encoding: .utf8), text)
        XCTAssertEqual(url.lastPathComponent, "declined-transaction.txt")
        XCTAssertThrowsError(try document.begin(text: text))
        document.finish()
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
        XCTAssertNil(document.fileURL)
        XCTAssertThrowsError(try document.begin(text: String(repeating: "x", count: 20_000)))
        XCTAssertThrowsError(try document.begin(text: "file:///private/customer-data"))
        _ = try document.begin(text: text)
        document.finish()
    }
    func testReaderTimingReportsOnlyFirstCurrentInputAndNoIdentifiers() {
        let sdk = ReaderDouble()
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: SessionDouble())
        var durations: [Double] = []
        coordinator.onReaderPresentation = { durations.append($0) }
        coordinator.collect(request) { _ in }
        sdk.onProgress?(.init(phase: "input", message: "Present card", progress: nil))
        sdk.onProgress?(.init(phase: "input", message: "Present again", progress: nil))
        coordinator.cancel(reason: .canceled)
        sdk.onProgress?(.init(phase: "input", message: "Late", progress: nil))
        XCTAssertEqual(durations.count, 1)
        XCTAssertGreaterThanOrEqual(durations.first ?? -1, 0)
    }
    func testWarmReaderIsReusedAndIntentClearedBeforeBecomingIdle() {
        let sdk = ReaderDouble()
        let session = SessionDouble()
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: session)
        coordinator.warmUp(account: "acct_1", location: "tml_1") { _ in }
        coordinator.collect(request) { _ in }
        XCTAssertEqual(sdk.calls.filter { $0 == "connect" }.count, 1)
        XCTAssertEqual(coordinator.readiness, .collecting)
        sdk.collected?(.success(()))
        sdk.confirmed?(.success("pi_confirmed"))
        XCTAssertEqual(sdk.calls.last, "clearOperation")
        XCTAssertEqual(coordinator.readiness, .ready)
        XCTAssertFalse(sdk.hasRetainedIntent)
    }

    func testCollectionWaitsForWarmupAndBackgroundKeepsUnknownRecovery() {
        let sdk = ReaderDouble()
        sdk.holdConnect = true
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: SessionDouble())
        coordinator.warmUp(account: "acct_1", location: "tml_1") { _ in }
        var result: Result<String, TerminalFailure>?
        coordinator.collect(request) { result = $0 }
        XCTAssertNil(result)
        sdk.connected?(.success(()))
        XCTAssertEqual(sdk.calls.filter { $0 == "connect" }.count, 1)
        sdk.collected?(.success(()))
        coordinator.cancel(reason: .canceled)
        sdk.confirmed?(.success("pi_late"))
        XCTAssertEqual(result?.failure, .unknown)
        XCTAssertEqual(coordinator.readiness, .disconnected)
    }

    func testReusedReaderRevalidatesPinnedSessionBeforeCollection() {
        let sdk = ReaderDouble()
        let session = SessionDouble()
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: session)
        coordinator.warmUp(account: "acct_1", location: "tml_1") { _ in }
        session.failure = .sessionChanged
        var result: Result<String, TerminalFailure>?
        coordinator.collect(request) { result = $0 }
        XCTAssertEqual(result?.failure, .sessionChanged)
        XCTAssertFalse(sdk.calls.contains("collect"))
        XCTAssertEqual(coordinator.readiness, .disconnected)
    }

    func testIdleReuseCleanupFailureKeepsReaderLockedButReturnsConfirmedIntent() {
        let sdk = ReaderDouble()
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: SessionDouble())
        coordinator.warmUp(account: "acct_1", location: "tml_1") { _ in }
        var result: Result<String, TerminalFailure>?
        coordinator.collect(request) { result = $0 }
        sdk.collected?(.success(()))
        sdk.cleanupError = .terminalError
        sdk.confirmed?(.success("pi_confirmed"))
        XCTAssertEqual(try? result?.get(), "pi_confirmed")
        XCTAssertNotEqual(coordinator.readiness, .ready)
        var next: Result<String, TerminalFailure>?
        coordinator.collect(request) { next = $0 }
        XCTAssertEqual(next?.failure, .busy)
    }

    func testChangedWarmBindingReconnectsInsteadOfReusing() {
        for (account, location) in [("acct_other","tml_1"),("acct_1","tml_other")] {
            let sdk = ReaderDouble()
            let coordinator = ForgeTerminalCoordinator(provider: sdk, session: SessionDouble())
            coordinator.warmUp(account: "acct_1", location: "tml_1") { _ in }
            coordinator.collect(TerminalRequest(operationID: "next", clientSecret: "secret", account: account, locationID: location, kind: .setup)) { _ in }
            XCTAssertEqual(sdk.calls.filter { $0 == "connect" }.count, 2)
        }
    }
    func testWarmupSkipsUndeterminedPermissionsAndUnknownTerms() {
        for status in [TerminalAccountLinkStatus.accepted, .setupRequired, .unavailable] {
            let sdk = ReaderDouble()
            sdk.linkStatus = status
            sdk.canWarmWithoutPrompt = status != .accepted
            let coordinator = ForgeTerminalCoordinator(provider: sdk, session: SessionDouble())
            var result: Result<TerminalReadinessState, TerminalFailure>?
            coordinator.warmUp(account: "acct_1", location: "tml_1") { result = $0 }
            XCTAssertNotNil(result)
            XCTAssertFalse(sdk.calls.contains("connect"))
            XCTAssertFalse(sdk.calls.contains("educate"))
            XCTAssertEqual(coordinator.readiness, .disconnected)
        }
    }

    func testWarmupChecksLinkAndNeverPermitsTermsOrCollects() {
        let sdk = ReaderDouble()
        let session = SessionDouble()
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: session)
        var result: Result<TerminalReadinessState, TerminalFailure>?
        coordinator.warmUp(account: "acct_1", location: "tml_1") { result = $0 }
        XCTAssertEqual(try? result?.get(), .ready)
        XCTAssertEqual(session.purpose, .warmup)
        XCTAssertEqual(sdk.termsPermissions, [false])
        XCTAssertEqual(sdk.calls, ["cleanup", "linked", "connect"])
        XCTAssertEqual(coordinator.readiness, .ready)
    }

    func testWarmupDuplicatesJoinAndLateCallbackCannotRestoreReadiness() {
        let sdk = ReaderDouble()
        sdk.holdConnect = true
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: SessionDouble())
        var results: [Result<TerminalReadinessState, TerminalFailure>] = []
        coordinator.warmUp(account: "acct_1", location: "tml_1") { results.append($0) }
        coordinator.warmUp(account: "acct_1", location: "tml_1") { results.append($0) }
        XCTAssertEqual(sdk.calls.filter { $0 == "connect" }.count, 1)
        let late = sdk.connected
        coordinator.cancel(reason: .sessionChanged)
        late?(.success(()))
        XCTAssertEqual(results.count, 2)
        XCTAssertTrue(results.allSatisfy { $0.failure == .sessionChanged })
        XCTAssertEqual(coordinator.readiness, .disconnected)
    }

    func testWarmupTokenCannotRequestTerms() throws {
        let request = try TerminalSessionPolicy.request(session: "cookie", account: "acct_1", purpose: .warmup)
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Forge-Terminal-Purpose"), "warmup")
        XCTAssertNil(request.value(forHTTPHeaderField: "X-Forge-Authorized-Representative"))
        XCTAssertThrowsError(try TerminalSessionPolicy.authorization(from: Data(#"{"secret":"token","stripe_account":"acct_1","tos_acceptance_permitted":true}"#.utf8), account: "acct_1", purpose: .warmup))
    }
    func testDebugSimulationRequiresAnIsolatedHTTPSOrigin() throws {
        let env = ["FORGE_TERMINAL_TEST_ORIGIN": "https://terminal-test.invalid/", "FORGE_TERMINAL_SIMULATED": "1"]
        let config = try XCTUnwrap(TerminalEnvironment.resolve(environment: env, debugBuild: true))
        XCTAssertEqual(config.origin, "https://terminal-test.invalid")
        XCTAssertEqual(config.providerMode, "test")
        XCTAssertTrue(config.simulated)
        XCTAssertNil(TerminalEnvironment.resolve(environment: ["FORGE_TERMINAL_SIMULATED": "1"], debugBuild: true))
        for origin in ["", "http://terminal-test.invalid", "https://www.forgecrm.app", "https://forgecrm.app", "https://test.forgecrm.app", "https://FORGECRM.APP", "https://forgecrm.app.", "https://user@terminal-test.invalid", "https://terminal-test.invalid:444", "https://terminal-test.invalid/path", "https://terminal-test.invalid?query=1", "https://terminal-test.invalid#fragment"] {
            XCTAssertNil(TerminalEnvironment.resolve(environment: ["FORGE_TERMINAL_TEST_ORIGIN": origin], debugBuild: true), origin)
        }
        let realReader = try XCTUnwrap(TerminalEnvironment.resolve(environment: ["FORGE_TERMINAL_TEST_ORIGIN": "https://terminal-test.invalid"], debugBuild: true))
        XCTAssertEqual(realReader.providerMode, "test")
        XCTAssertFalse(realReader.simulated)
    }

    func testReleaseIgnoresAllTestOverrides() throws {
        for origin in ["https://terminal-test.invalid", "invalid"] {
            let config = try XCTUnwrap(TerminalEnvironment.resolve(environment: ["FORGE_TERMINAL_TEST_ORIGIN": origin, "FORGE_TERMINAL_SIMULATED": "1"], debugBuild: false))
            XCTAssertEqual(config.origin, "https://www.forgecrm.app")
            XCTAssertEqual(config.providerMode, "live")
            XCTAssertFalse(config.simulated)
            XCTAssertFalse(TerminalSessionPolicy.isTrusted(URL(string: "https://terminal-test.invalid"), configuration: config))
        }
    }

    func testTestSessionPinsOriginCookiesAndProviderModeBeforeDeliveringToken() throws {
        let config = try XCTUnwrap(TerminalEnvironment.resolve(environment: ["FORGE_TERMINAL_TEST_ORIGIN": "https://terminal-test.invalid"], debugBuild: true))
        let cookie = HTTPCookie(properties: [.name: "crm_session", .value: "isolated", .domain: "terminal-test.invalid", .path: "/", .secure: "TRUE"])!
        XCTAssertFalse(TerminalSessionPolicy.isTrusted(URL(string: "https://www.forgecrm.app"), configuration: config))
        XCTAssertThrowsError(try TerminalSessionPolicy.sessionCookie(from: [cookie]))
        XCTAssertEqual(try TerminalSessionPolicy.sessionCookie(from: [cookie], configuration: config), "isolated")
        for mode in [nil, "live", "test"] as [String?] {
            var result: Result<Void, TerminalFailure>?
            let session = ForgeTerminalSession(configuration: config, snapshot: { done in
                done(URL(string: "https://terminal-test.invalid/jobs"), [cookie])
            }, transport: { request, done in
                XCTAssertEqual(request.url?.absoluteString, "https://terminal-test.invalid/api/stripe/terminal/connection-token")
                XCTAssertEqual(request.value(forHTTPHeaderField: "Origin"), "https://terminal-test.invalid")
                XCTAssertEqual(request.value(forHTTPHeaderField: "X-Forge-Terminal-Mode"), "test")
                let modeField = mode.map { ",\"provider_mode\":\"\($0)\"" } ?? ""
                done(Data("{\"secret\":\"token\",\"stripe_account\":\"acct_1\"\(modeField)}".utf8), HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil), nil)
            })
            session.begin(account: "acct_1") { result = $0 }
            if mode == "test" { XCTAssertNotNil(result); XCTAssertNil(result?.failure) }
            else { XCTAssertEqual(result?.failure?.code, "session_changed") }
        }
    }

    func testInvalidNativeConfigurationNeverCallsTokenTransport() {
        var transported = false
        let session = ForgeTerminalSession(configuration: nil, snapshot: { done in done(URL(string: "https://www.forgecrm.app"), []) }, transport: { _, _ in transported = true })
        var result: Result<Void, TerminalFailure>?
        session.begin(account: "acct_1") { result = $0 }
        XCTAssertFalse(transported)
        XCTAssertEqual(result?.failure?.code, "session_changed")
    }
    func testProgressCannotEscapeItsReaderLease() {
        var messages: [String] = []
        let events = TerminalReaderEventLease(unexpectedDisconnect: {}, progress: { messages.append($0.message) })
        events.report(.init(phase: "preparing", message: "current", progress: nil))
        events.invalidate()
        events.report(.init(phase: "preparing", message: "stale", progress: nil))
        XCTAssertEqual(messages, ["current"])
    }
    func testDevicePreparationNeverCollectsOrConfirmsAnIntent() {
        let sdk = ReaderDouble()
        let session = SessionDouble()
        session.tosAcceptancePermitted = true
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: session)
        var result: Result<Void, TerminalFailure>?
        coordinator.prepareDevice(operationID: "prepare-1", account: "acct_1", locationID: "tml_1", representativeConfirmed: true) { result = $0 }
        XCTAssertNotNil(result)
        XCTAssertNil(result?.failure)
        XCTAssertEqual(session.purpose, .preparation(representativeConfirmed: true))
        XCTAssertEqual(sdk.termsPermissions, [true])
        XCTAssertEqual(sdk.calls, ["cleanup", "connect", "educate", "cleanup"])
    }

    func testOrdinaryCollectionNeverPermitsMerchantTerms() {
        let sdk = ReaderDouble()
        let session = SessionDouble()
        session.tosAcceptancePermitted = true // Even a stale grant must not leak into checkout.
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: session)
        coordinator.collect(request) { _ in }
        XCTAssertEqual(session.purpose, .collection)
        XCTAssertEqual(sdk.termsPermissions, [false])
    }

    func testPaymentAndCardSavingDoNotRepeatEducation() {
        for kind in [TerminalRequest.Kind.payment(saveCard: false), .payment(saveCard: true), .setup] {
            let sdk = ReaderDouble()
            let coordinator = ForgeTerminalCoordinator(provider: sdk, session: SessionDouble())
            let operation = TerminalRequest(operationID: "attempt", clientSecret: "secret", account: "acct_1", locationID: "tml_1", kind: kind)
            var result: Result<String, TerminalFailure>?
            coordinator.collect(operation) { result = $0 }
            XCTAssertEqual(sdk.calls, ["cleanup", "connect", "retrieve", "collect"])
            sdk.collected?(.success(()))
            sdk.confirmed?(.success("intent_confirmed"))
            XCTAssertEqual(try? result?.get(), "intent_confirmed")
            XCTAssertEqual(sdk.calls, ["cleanup", "connect", "retrieve", "collect", "confirm", "cleanup"])
        }
    }

    func testHowToTapRemainsAvailableOnDemand() {
        let sdk = ReaderDouble()
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: SessionDouble())
        var result: Result<Void, TerminalFailure>?
        coordinator.showEducation { result = $0 }
        XCTAssertNotNil(result)
        XCTAssertNil(result?.failure)
        XCTAssertEqual(sdk.calls, ["educate", "cleanup"])
    }

    func testPreparationCleanupFailureCannotReportReady() {
        let sdk = ReaderDouble()
        sdk.holdConnect = true
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: SessionDouble())
        var result: Result<Void, TerminalFailure>?
        coordinator.prepareDevice(operationID: "prepare", account: "acct_1", locationID: "tml_1", representativeConfirmed: false) { result = $0 }
        sdk.cleanupError = .terminalError
        sdk.connected?(.success(()))
        XCTAssertEqual(result?.failure?.code, "cleanup_failed")
        XCTAssertTrue(result?.failure?.message.contains("Restart Forge") == true)
        var next: Result<Void, TerminalFailure>?
        coordinator.prepareDevice(operationID: "next", account: "acct_1", locationID: "tml_1", representativeConfirmed: false) { next = $0 }
        XCTAssertEqual(next?.failure?.code, "busy")
    }

    func testConfirmedPaymentSurvivesCleanupFailureForReconciliation() {
        let sdk = ReaderDouble()
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: SessionDouble())
        var result: Result<String, TerminalFailure>?
        coordinator.collect(request) { result = $0 }
        sdk.collected?(.success(()))
        sdk.cleanupError = .terminalError
        sdk.confirmed?(.success("pi_confirmed"))
        XCTAssertEqual(try? result?.get(), "pi_confirmed")
    }

    func testPreparationCancelIgnoresLateConnection() {
        let sdk = ReaderDouble()
        sdk.holdConnect = true
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: SessionDouble())
        var result: Result<Void, TerminalFailure>?
        coordinator.prepareDevice(operationID: "prepare-1", account: "acct_1", locationID: "tml_1", representativeConfirmed: false) { result = $0 }
        let late = sdk.connected
        coordinator.cancel(reason: .sessionChanged)
        XCTAssertEqual(result?.failure?.code, "session_changed")
        sdk.holdConnect = false
        coordinator.collect(request) { _ in }
        let count = sdk.calls.count
        late?(.success(()))
        XCTAssertEqual(sdk.calls.count, count)
        XCTAssertEqual(sdk.termsPermissions, [false, false])
    }

    func testTermsGrantIsBoundToExplicitPreparationPurpose() throws {
        let yes = Data(#"{"secret":"token","stripe_account":"acct_1","tos_acceptance_permitted":true}"#.utf8)
        let no = Data(#"{"secret":"token","stripe_account":"acct_1","tos_acceptance_permitted":false}"#.utf8)
        XCTAssertThrowsError(try TerminalSessionPolicy.authorization(from: yes, account: "acct_1", purpose: .collection))
        XCTAssertThrowsError(try TerminalSessionPolicy.authorization(from: yes, account: "acct_1", purpose: .preparation(representativeConfirmed: false)))
        XCTAssertThrowsError(try TerminalSessionPolicy.authorization(from: no, account: "acct_1", purpose: .preparation(representativeConfirmed: true)))
        XCTAssertTrue(try TerminalSessionPolicy.authorization(from: yes, account: "acct_1", purpose: .preparation(representativeConfirmed: true)).permitsTerms)
        let req = try TerminalSessionPolicy.request(session: "cookie", account: "acct_1", purpose: .preparation(representativeConfirmed: true))
        XCTAssertEqual(req.value(forHTTPHeaderField: "X-Forge-Terminal-Purpose"), "preparation")
        XCTAssertEqual(req.value(forHTTPHeaderField: "X-Forge-Authorized-Representative"), "true")
    }

    func testLateCompletionCannotFinishReplacementOperation() throws {
        let state = TerminalOperationState()
        let old = try state.begin(id: "a", account: "acct_1")
        XCTAssertThrowsError(try state.begin(id: "duplicate", account: "acct_1"))
        state.invalidate()
        let current = try state.begin(id: "b", account: "acct_2")
        XCTAssertFalse(state.isCurrent(old))
        XCTAssertTrue(state.isCurrent(current))
    }

    func testOriginAndCookieBoundaries() throws {
        XCTAssertTrue(TerminalSessionPolicy.isTrusted(URL(string: "https://www.forgecrm.app/jobs")!))
        for url in ["http://www.forgecrm.app", "https://evil.forgecrm.app", "https://www.forgecrm.app.evil.test", "https://www.forgecrm.app:444", "https://user@www.forgecrm.app", "http://localhost:3000"] {
            XCTAssertFalse(TerminalSessionPolicy.isTrusted(URL(string: url)!))
        }
        func cookie(_ domain: String, _ path: String = "/", secure: Bool = true) -> HTTPCookie {
            var properties: [HTTPCookiePropertyKey: Any] = [.name: "crm_session", .value: "current", .domain: domain, .path: path]
            if secure { properties[.secure] = "TRUE" }
            return HTTPCookie(properties: properties)!
        }
        XCTAssertEqual(try TerminalSessionPolicy.sessionCookie(from: [cookie(".forgecrm.app")]), "current")
        XCTAssertThrowsError(try TerminalSessionPolicy.sessionCookie(from: [cookie("evil.forgecrm.app")]))
        XCTAssertThrowsError(try TerminalSessionPolicy.sessionCookie(from: [cookie("www.forgecrm.app", "/jobs")]))
        XCTAssertThrowsError(try TerminalSessionPolicy.sessionCookie(from: [cookie("www.forgecrm.app", secure: false)]))
        XCTAssertThrowsError(try TerminalSessionPolicy.sessionCookie(from: [cookie("www.forgecrm.app"), cookie(".forgecrm.app")]))
    }

    func testRequestAlwaysUsesFixedOriginAndAccount() throws {
        let request = try TerminalSessionPolicy.request(session: "secret-session", account: "acct_1")
        XCTAssertEqual(request.url?.absoluteString, "https://www.forgecrm.app/api/stripe/terminal/connection-token")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Origin"), "https://www.forgecrm.app")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Forge-Stripe-Account"), "acct_1")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Cookie"), "crm_session=secret-session")
        XCTAssertFalse(request.httpShouldHandleCookies)
        XCTAssertThrowsError(try TerminalSessionPolicy.token(from: Data(#"{"secret":"pst_test","stripe_account":"acct_other"}"#.utf8), account: "acct_1"))
    }

    func testCoordinatorSerializesAndRevalidatesBeforeConfirmation() {
        let sdk = ReaderDouble()
        let session = SessionDouble()
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: session)
        var result: Result<String, TerminalFailure>?
        coordinator.collect(request, completion: { result = $0 })
        var duplicate: Result<String, TerminalFailure>?
        coordinator.collect(request, completion: { duplicate = $0 })
        XCTAssertEqual(duplicate?.failure?.code, "busy")
        XCTAssertEqual(sdk.calls, ["cleanup", "connect", "retrieve", "collect"])
        session.failure = .sessionChanged
        sdk.collected?(.success(()))
        XCTAssertFalse(sdk.calls.contains("confirm"))
        XCTAssertEqual(result?.failure?.code, "session_changed")
    }

    func testCancellationWaitsForCleanupAndIgnoresLateCollection() {
        let sdk = ReaderDouble()
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: SessionDouble())
        var result: Result<String, TerminalFailure>?
        coordinator.collect(request, completion: { result = $0 })
        let late = sdk.collected
        sdk.holdCleanup = true
        coordinator.cancel(reason: .canceled)
        var blocked: Result<String, TerminalFailure>?
        coordinator.collect(request, completion: { blocked = $0 })
        XCTAssertEqual(blocked?.failure?.code, "busy")
        sdk.finishCleanup?(.success(()))
        XCTAssertEqual(result?.failure?.code, "canceled")
        sdk.holdCleanup = false
        coordinator.collect(request, completion: { _ in })
        let count = sdk.calls.count
        late?(.success(()))
        XCTAssertEqual(sdk.calls.count, count)
        XCTAssertFalse(sdk.calls.contains("confirm"))
    }

    func testCancelDuringConfirmationIsUnknownAndCleanupFailureBlocksReuse() {
        let sdk = ReaderDouble()
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: SessionDouble())
        var result: Result<String, TerminalFailure>?
        coordinator.collect(request, completion: { result = $0 })
        sdk.collected?(.success(()))
        XCTAssertTrue(sdk.calls.contains("confirm"))
        sdk.cleanupError = .terminalError
        coordinator.cancel(reason: .canceled)
        XCTAssertEqual(result?.failure?.code, "payment_unknown")
        var next: Result<String, TerminalFailure>?
        coordinator.collect(request, completion: { next = $0 })
        XCTAssertEqual(next?.failure?.code, "busy")
    }

    func testSuccessCleansReaderBeforeReturningIntent() {
        let sdk = ReaderDouble()
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: SessionDouble())
        var result: Result<String, TerminalFailure>?
        coordinator.collect(request, completion: { result = $0 })
        sdk.collected?(.success(()))
        sdk.holdCleanup = true
        sdk.confirmed?(.success("pi_123"))
        XCTAssertNil(result)
        sdk.finishCleanup?(.success(()))
        XCTAssertEqual(try? result?.get(), "pi_123")
    }

    func testFreshSessionAccountAndTokenValidation() {
        var cookieValue = "session-a"
        var requests: [URLRequest] = []
        var responses: [(Data?, URLResponse?, Error?) -> Void] = []
        let session = ForgeTerminalSession(snapshot: { completion in
            completion(URL(string: "https://www.forgecrm.app/jobs"), [HTTPCookie(properties: [.name: "crm_session", .value: cookieValue, .domain: "www.forgecrm.app", .path: "/", .secure: "TRUE"])!])
        }, transport: { request, completion in requests.append(request); responses.append(completion) })
        var result: Result<Void, TerminalFailure>?
        session.begin(account: "acct_1") { result = $0 }
        XCTAssertEqual(requests.count, 1)
        cookieValue = "session-b"
        responses.removeFirst()(Data(#"{"secret":"pst_secret","stripe_account":"acct_1"}"#.utf8), HTTPURLResponse(url: URL(string: "https://www.forgecrm.app/api/stripe/terminal/connection-token")!, statusCode: 200, httpVersion: nil, headerFields: nil), nil)
        XCTAssertEqual(result?.failure?.code, "session_changed")
        session.end()
        session.begin(account: "acct_2") { result = $0 }
        XCTAssertEqual(requests.last?.value(forHTTPHeaderField: "Cookie"), "crm_session=session-b")
        XCTAssertEqual(requests.last?.value(forHTTPHeaderField: "X-Forge-Stripe-Account"), "acct_2")
        session.end()
        responses.removeFirst()(Data(#"{"secret":"pst_secret","stripe_account":"acct_2"}"#.utf8), HTTPURLResponse(url: URL(string: "https://www.forgecrm.app/api/stripe/terminal/connection-token")!, statusCode: 200, httpVersion: nil, headerFields: nil), nil)
        XCTAssertEqual(result?.failure?.code, "session_changed")
    }

    func testRedirectAndUnauthorizedResponseNeverYieldTokens() {
        for status in [302, 401, 403, 409] {
            let session = ForgeTerminalSession(snapshot: { completion in
                completion(URL(string: "https://www.forgecrm.app"), [HTTPCookie(properties: [.name: "crm_session", .value: "a", .domain: "www.forgecrm.app", .path: "/", .secure: "TRUE"])!])
            }, transport: { _, completion in
                completion(Data(#"{"secret":"pst_secret","stripe_account":"acct_1"}"#.utf8), HTTPURLResponse(url: URL(string: "https://www.forgecrm.app/api/stripe/terminal/connection-token")!, statusCode: status, httpVersion: nil, headerFields: nil), nil)
            })
            var result: Result<Void, TerminalFailure>?
            session.begin(account: "acct_1") { result = $0 }
            XCTAssertNotNil(result?.failure)
        }
        var followRedirect = true
        let transport = TerminalHTTPSClient()
        transport.urlSession(URLSession.shared, task: URLSession.shared.dataTask(with: URL(string: "https://www.forgecrm.app")!), willPerformHTTPRedirection: HTTPURLResponse(url: URL(string: "https://www.forgecrm.app")!, statusCode: 302, httpVersion: nil, headerFields: nil)!, newRequest: URLRequest(url: URL(string: "https://evil.test")!)) { followRedirect = $0 != nil }
        XCTAssertFalse(followRedirect)
    }

    func testBackgroundDuringInitialCleanupDoesNotStartReader() {
        let sdk = ReaderDouble()
        sdk.holdCleanup = true
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: SessionDouble())
        var result: Result<String, TerminalFailure>?
        coordinator.collect(request) { result = $0 }
        coordinator.cancel(reason: .canceled)
        XCTAssertEqual(sdk.calls.filter { $0 == "cleanup" }.count, 1)
        sdk.finishCleanup?(.success(()))
        XCTAssertEqual(result?.failure?.code, "canceled")
        XCTAssertFalse(sdk.calls.contains("connect"))
    }

    func testOldCookieObservationCannotCancelReplacementSession() {
        let url = URL(string: "https://www.forgecrm.app")!
        let cookies = [HTTPCookie(properties: [.name: "crm_session", .value: "a", .domain: "www.forgecrm.app", .path: "/", .secure: "TRUE"])!]
        var hold = false
        var pending: ((URL?, [HTTPCookie]) -> Void)?
        let session = ForgeTerminalSession(snapshot: { completion in
            if hold { pending = completion } else { completion(url, cookies) }
        }, transport: { _, completion in
            completion(Data(#"{"secret":"pst_secret","stripe_account":"acct_1"}"#.utf8), HTTPURLResponse(url: URL(string: "https://www.forgecrm.app/api/stripe/terminal/connection-token")!, statusCode: 200, httpVersion: nil, headerFields: nil), nil)
        })
        session.begin(account: "acct_1") { _ in }
        hold = true
        var mayContinue: Bool?
        session.checkCurrent { mayContinue = $0 }
        session.end()
        hold = false
        session.begin(account: "acct_1") { _ in }
        pending?(nil, [])
        XCTAssertEqual(mayContinue, true, "An obsolete observation must not cancel a new session")
    }

    func testDelayedReaderDisconnectCannotCancelReplacementConnection() {
        let sdk = ReaderDouble()
        let coordinator = ForgeTerminalCoordinator(provider: sdk, session: SessionDouble())
        let oldConnection = TerminalReaderEventLease { coordinator.cancel(reason: .terminalError) }
        coordinator.collect(request) { _ in }
        oldConnection.invalidate()
        coordinator.cancel(reason: .canceled)

        var replacementResult: Result<String, TerminalFailure>?
        let currentConnection = TerminalReaderEventLease { coordinator.cancel(reason: .terminalError) }
        coordinator.collect(request) { replacementResult = $0 }
        let cleanupCount = sdk.calls.filter { $0 == "cleanup" }.count
        // The SDK can deliver an old delegate notification after its disconnect
        // completion and after the new easyConnect has installed another delegate.
        oldConnection.didDisconnect(intentional: false)
        oldConnection.didDisconnect(intentional: true)
        XCTAssertNil(replacementResult)
        XCTAssertEqual(sdk.calls.filter { $0 == "cleanup" }.count, cleanupCount)

        currentConnection.didDisconnect(intentional: false)
        XCTAssertEqual(replacementResult?.failure?.code, "terminal_error")
        XCTAssertEqual(sdk.calls.filter { $0 == "cleanup" }.count, cleanupCount + 1)
    }

    func testRequestedDisconnectDoesNotCancelActiveOperation() {
        var cancellations = 0
        let connection = TerminalReaderEventLease { cancellations += 1 }
        connection.didDisconnect(intentional: true)
        XCTAssertEqual(cancellations, 0)
        connection.didDisconnect(intentional: false)
        connection.didDisconnect(intentional: false)
        XCTAssertEqual(cancellations, 1, "A lease delivers unexpected disconnect only once")
    }

    private var request: TerminalRequest {
        TerminalRequest(operationID: "attempt_1", clientSecret: "pi_123_secret_test", account: "acct_1", locationID: "tml_1", kind: .payment(saveCard: false))
    }
}

private extension Result where Failure == TerminalFailure {
    var failure: TerminalFailure? { if case .failure(let error) = self { return error }; return nil }
}

private final class SessionDouble: TerminalSessionProviding {
    var failure: TerminalFailure?
    var tosAcceptancePermitted = false
    var purpose: TerminalSessionPurpose?
    func begin(account: String, location: String?, purpose: TerminalSessionPurpose, completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        self.purpose = purpose
        completion(.success(()))
    }
    func validate(completion: @escaping (Result<Void, TerminalFailure>) -> Void) { completion(failure.map(Result.failure) ?? .success(())) }
    func end() {}
}

private final class ReaderDouble: TerminalReaderProviding {
    var hasRetainedIntent = false
    func clearOperation(completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        calls.append("clearOperation"); hasRetainedIntent = false
        completion(cleanupError.map(Result.failure) ?? .success(()))
    }
    var canWarmWithoutPrompt = true
    var linkStatus: TerminalAccountLinkStatus = .accepted
    func accountLinkStatus(completion: @escaping (TerminalAccountLinkStatus) -> Void) { calls.append("linked"); completion(linkStatus) }
    var onProgress: ((TerminalReaderProgress) -> Void)?
    var calls: [String] = []
    var collected: ((Result<Void, TerminalFailure>) -> Void)?
    var confirmed: ((Result<String, TerminalFailure>) -> Void)?
    var finishCleanup: ((Result<Void, TerminalFailure>) -> Void)?
    var holdCleanup = false
    var cleanupError: TerminalFailure?
    var termsPermissions: [Bool] = []
    var holdConnect = false
    var connected: ((Result<Void, TerminalFailure>) -> Void)?
    func cleanUp(completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        calls.append("cleanup")
        if holdCleanup { finishCleanup = completion } else { completion(cleanupError.map(Result.failure) ?? .success(())) }
    }
    func connect(location: String, permitsTerms: Bool, completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        calls.append("connect"); termsPermissions.append(permitsTerms)
        if holdConnect { connected = completion } else { completion(.success(())) }
    }
    func educate(completion: @escaping (Result<Void, TerminalFailure>) -> Void) { calls.append("educate"); completion(.success(())) }
    func retrieve(_ request: TerminalRequest, completion: @escaping (Result<Void, TerminalFailure>) -> Void) { calls.append("retrieve"); hasRetainedIntent = true; completion(.success(())) }
    func collect(_ request: TerminalRequest, completion: @escaping (Result<Void, TerminalFailure>) -> Void) { calls.append("collect"); collected = completion }
    func confirm(completion: @escaping (Result<String, TerminalFailure>) -> Void) { calls.append("confirm"); confirmed = completion }
}
