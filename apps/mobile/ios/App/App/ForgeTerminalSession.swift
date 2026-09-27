import Foundation

/// Snapshot and transport boundaries let tests exercise the real session checks
/// without a WebView, reader, Stripe account, or persistent cookie storage.
final class ForgeTerminalSession: TerminalSessionProviding {
    typealias Snapshot = (@escaping (URL?, [HTTPCookie]) -> Void) -> Void
    typealias Transport = (URLRequest, @escaping (Data?, URLResponse?, Error?) -> Void) -> Void
    private struct Context: Equatable { let id: UUID; let account: String; let cookie: String; let purpose: TerminalSessionPurpose }
    private let snapshot: Snapshot
    private let transport: Transport
    private let configuration: TerminalEnvironment?
    private var context: Context?
    private var generation = UUID()
    private(set) var tosAcceptancePermitted = false

    init(configuration: TerminalEnvironment? = TerminalSessionPolicy.configuration, snapshot: @escaping Snapshot, transport: @escaping Transport) {
        self.configuration = configuration
        self.snapshot = snapshot
        self.transport = transport
    }

    func begin(account: String, purpose: TerminalSessionPurpose = .collection, completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        tosAcceptancePermitted = false
        let generation = self.generation
        snapshot { [self] url, cookies in
            guard self.generation == generation, TerminalSessionPolicy.isTrusted(url, configuration: configuration),
                  let cookie = try? TerminalSessionPolicy.sessionCookie(from: cookies, configuration: configuration) else {
                completion(.failure(.sessionChanged)); return
            }
            context = Context(id: UUID(), account: account, cookie: cookie, purpose: purpose)
            validate(completion: completion)
        }
    }

    func validate(completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        fetchToken { completion($0.map { _ in () }) }
    }

    func checkCurrent(completion: @escaping (Bool) -> Void) {
        guard let expected = context else { completion(true); return }
        snapshot { [self] url, cookies in
            // An observation belongs to the session that requested it; a late
            // cookie-store callback must never cancel a replacement generation.
            guard context == expected else { completion(true); return }
            completion(TerminalSessionPolicy.isTrusted(url, configuration: configuration)
                       && (try? TerminalSessionPolicy.sessionCookie(from: cookies, configuration: configuration)) == expected.cookie)
        }
    }

    func fetchToken(completion: @escaping (Result<String, TerminalFailure>) -> Void) {
        guard let expected = context else { completion(.failure(.sessionChanged)); return }
        snapshot { [self] url, cookies in
            guard context == expected, TerminalSessionPolicy.isTrusted(url, configuration: configuration),
                  (try? TerminalSessionPolicy.sessionCookie(from: cookies, configuration: configuration)) == expected.cookie,
                  let request = try? TerminalSessionPolicy.request(session: expected.cookie, account: expected.account, purpose: expected.purpose, configuration: configuration) else {
                completion(.failure(.sessionChanged)); return
            }
            transport(request) { [self] data, response, error in
                // Transport callback must arrive on main; production URLSession wrapper ensures this.
                guard context == expected else { completion(.failure(.sessionChanged)); return }
                guard error == nil, let http = response as? HTTPURLResponse,
                      http.url == configuration?.endpoint, http.statusCode == 200, let data else {
                    let status = (response as? HTTPURLResponse)?.statusCode
                    completion(.failure(status == 401 || status == 403 || status == 409 ? .sessionChanged : .terminalError)); return
                }
                guard let authorization = try? TerminalSessionPolicy.authorization(from: data, account: expected.account, purpose: expected.purpose, configuration: configuration) else {
                    completion(.failure(.sessionChanged)); return
                }
                snapshot { [self] url, cookies in
                    guard context == expected, TerminalSessionPolicy.isTrusted(url, configuration: configuration),
                          (try? TerminalSessionPolicy.sessionCookie(from: cookies, configuration: configuration)) == expected.cookie else {
                        completion(.failure(.sessionChanged)); return
                    }
                    tosAcceptancePermitted = authorization.permitsTerms
                    completion(.success(authorization.secret))
                }
            }
        }
    }

    func end() { context = nil; tosAcceptancePermitted = false; generation = UUID() }
}

final class TerminalHTTPSClient: NSObject, URLSessionTaskDelegate {
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.urlCache = nil
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()

    func send(_ request: URLRequest, completion: @escaping (Data?, URLResponse?, Error?) -> Void) {
        session.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async { completion(data, response, error) }
        }.resume()
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}
