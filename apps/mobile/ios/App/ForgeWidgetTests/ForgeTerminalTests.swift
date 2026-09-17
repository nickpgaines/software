import XCTest
#if !TERMINAL_STANDALONE
@testable import App
#endif

final class ForgeTerminalTests: XCTestCase {
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
        let request = TerminalSessionPolicy.request(session: "secret-session", account: "acct_1")
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
        XCTAssertEqual(sdk.calls, ["cleanup", "connect", "educate", "retrieve", "collect"])
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

    private var request: TerminalRequest {
        TerminalRequest(operationID: "attempt_1", clientSecret: "pi_123_secret_test", account: "acct_1", locationID: "tml_1", kind: .payment(saveCard: false))
    }
}

private extension Result where Failure == TerminalFailure {
    var failure: TerminalFailure? { if case .failure(let error) = self { return error }; return nil }
}

private final class SessionDouble: TerminalSessionProviding {
    var failure: TerminalFailure?
    func begin(account: String, completion: @escaping (Result<Void, TerminalFailure>) -> Void) { completion(.success(())) }
    func validate(completion: @escaping (Result<Void, TerminalFailure>) -> Void) { completion(failure.map(Result.failure) ?? .success(())) }
    func end() {}
}

private final class ReaderDouble: TerminalReaderProviding {
    var calls: [String] = []
    var collected: ((Result<Void, TerminalFailure>) -> Void)?
    var confirmed: ((Result<String, TerminalFailure>) -> Void)?
    var finishCleanup: ((Result<Void, TerminalFailure>) -> Void)?
    var holdCleanup = false
    var cleanupError: TerminalFailure?
    func cleanUp(completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        calls.append("cleanup")
        if holdCleanup { finishCleanup = completion } else { completion(cleanupError.map(Result.failure) ?? .success(())) }
    }
    func connect(location: String, completion: @escaping (Result<Void, TerminalFailure>) -> Void) { calls.append("connect"); completion(.success(())) }
    func educate(completion: @escaping (Result<Void, TerminalFailure>) -> Void) { calls.append("educate"); completion(.success(())) }
    func retrieve(_ request: TerminalRequest, completion: @escaping (Result<Void, TerminalFailure>) -> Void) { calls.append("retrieve"); completion(.success(())) }
    func collect(_ request: TerminalRequest, completion: @escaping (Result<Void, TerminalFailure>) -> Void) { calls.append("collect"); collected = completion }
    func confirm(completion: @escaping (Result<String, TerminalFailure>) -> Void) { calls.append("confirm"); confirmed = completion }
}
