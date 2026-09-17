import Foundation

/// Snapshot and transport boundaries let tests exercise the real session checks
/// without a WebView, reader, Stripe account, or persistent cookie storage.
final class ForgeTerminalSession: TerminalSessionProviding {
    typealias Snapshot = (@escaping (URL?, [HTTPCookie]) -> Void) -> Void
    typealias Transport = (URLRequest, @escaping (Data?, URLResponse?, Error?) -> Void) -> Void
    private struct Context: Equatable { let id: UUID; let account: String; let cookie: String }
    private let snapshot: Snapshot
    private let transport: Transport
    private var context: Context?
    private var generation = UUID()

    init(snapshot: @escaping Snapshot, transport: @escaping Transport) {
        self.snapshot = snapshot
        self.transport = transport
    }

    func begin(account: String, completion: @escaping (Result<Void, TerminalFailure>) -> Void) {
        let generation = self.generation
        snapshot { [self] url, cookies in
            guard self.generation == generation, TerminalSessionPolicy.isTrusted(url),
                  let cookie = try? TerminalSessionPolicy.sessionCookie(from: cookies) else {
                completion(.failure(.sessionChanged)); return
            }
            context = Context(id: UUID(), account: account, cookie: cookie)
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
            completion(TerminalSessionPolicy.isTrusted(url)
                       && (try? TerminalSessionPolicy.sessionCookie(from: cookies)) == expected.cookie)
        }
    }

    func fetchToken(completion: @escaping (Result<String, TerminalFailure>) -> Void) {
        guard let expected = context else { completion(.failure(.sessionChanged)); return }
        snapshot { [self] url, cookies in
            guard context == expected, TerminalSessionPolicy.isTrusted(url),
                  (try? TerminalSessionPolicy.sessionCookie(from: cookies)) == expected.cookie else {
                completion(.failure(.sessionChanged)); return
            }
            transport(TerminalSessionPolicy.request(session: expected.cookie, account: expected.account)) { [self] data, response, error in
                // Transport callback must arrive on main; production URLSession wrapper ensures this.
                guard context == expected else { completion(.failure(.sessionChanged)); return }
                guard error == nil, let http = response as? HTTPURLResponse,
                      http.url == TerminalSessionPolicy.endpoint, http.statusCode == 200, let data else {
                    let status = (response as? HTTPURLResponse)?.statusCode
                    completion(.failure(status == 401 || status == 403 || status == 409 ? .sessionChanged : .terminalError)); return
                }
                guard let token = try? TerminalSessionPolicy.token(from: data, account: expected.account) else {
                    completion(.failure(.sessionChanged)); return
                }
                snapshot { [self] url, cookies in
                    guard context == expected, TerminalSessionPolicy.isTrusted(url),
                          (try? TerminalSessionPolicy.sessionCookie(from: cookies)) == expected.cookie else {
                        completion(.failure(.sessionChanged)); return
                    }
                    completion(.success(token))
                }
            }
        }
    }

    func end() { context = nil; generation = UUID() }
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
