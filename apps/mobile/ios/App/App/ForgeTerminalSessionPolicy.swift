import Foundation

struct TerminalEnvironment {
    let origin: String
    let providerMode: String
    let simulated: Bool
    var endpoint: URL { URL(string: origin + "/api/stripe/terminal/connection-token")! }

    static func resolve(environment: [String: String], debugBuild: Bool) -> TerminalEnvironment? {
        let production = TerminalEnvironment(origin: "https://www.forgecrm.app", providerMode: "live", simulated: false)
        guard debugBuild else { return production }
        let simulated = environment["FORGE_TERMINAL_SIMULATED"] == "1"
        guard let raw = environment["FORGE_TERMINAL_TEST_ORIGIN"] else { return simulated ? nil : production }
        guard let url = URL(string: raw), url.scheme == "https", let host = url.host?.lowercased(),
              !host.isEmpty, !host.hasSuffix("."), host != "forgecrm.app", !host.hasSuffix(".forgecrm.app"),
              url.user == nil, url.password == nil, url.port == nil || url.port == 443,
              url.path.isEmpty || url.path == "/", url.query == nil, url.fragment == nil else { return nil }
        return TerminalEnvironment(origin: "https://\(host)", providerMode: "test", simulated: simulated)
    }
}

enum TerminalSessionPolicy {
    static let configuration: TerminalEnvironment? = {
        #if DEBUG
        return TerminalEnvironment.resolve(environment: ProcessInfo.processInfo.environment, debugBuild: true)
        #else
        return TerminalEnvironment.resolve(environment: [:], debugBuild: false)
        #endif
    }()

    static func isTrusted(_ url: URL?, configuration: TerminalEnvironment? = configuration) -> Bool {
        guard let url, let configuration else { return false }
        return url.scheme == "https" && url.host?.lowercased() == configuration.endpoint.host
            && (url.port == nil || url.port == 443) && url.user == nil && url.password == nil
    }

    static func sessionCookie(from cookies: [HTTPCookie], configuration: TerminalEnvironment? = configuration) throws -> String {
        guard let endpoint = configuration?.endpoint else { throw TerminalFailure.sessionChanged }
        let matches = cookies.filter { cookie in
            let domain = cookie.domain.lowercased()
            let host = endpoint.host!
            let domainMatches = domain.hasPrefix(".")
                ? (host == String(domain.dropFirst()) || host.hasSuffix(domain)) : host == domain
            let path = cookie.path
            let target = endpoint.path
            let pathMatches = target == path || (target.hasPrefix(path) && (path.hasSuffix("/") || target.dropFirst(path.count).hasPrefix("/")))
            return cookie.name == "crm_session" && cookie.isSecure && domainMatches && pathMatches
                && (cookie.expiresDate == nil || cookie.expiresDate! > Date())
                && !cookie.value.isEmpty && !cookie.value.contains(";") && !cookie.value.contains("\n") && !cookie.value.contains("\r")
        }
        guard matches.count == 1 else { throw TerminalFailure.sessionChanged }
        return matches[0].value
    }

    static func request(session: String, account: String, purpose: TerminalSessionPurpose = .collection, configuration: TerminalEnvironment? = configuration) throws -> URLRequest {
        guard let configuration else { throw TerminalFailure.sessionChanged }
        var request = URLRequest(url: configuration.endpoint, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.httpMethod = "POST"
        request.httpShouldHandleCookies = false
        request.setValue(configuration.origin, forHTTPHeaderField: "Origin")
        request.setValue(configuration.providerMode, forHTTPHeaderField: "X-Forge-Terminal-Mode")
        request.setValue(account, forHTTPHeaderField: "X-Forge-Stripe-Account")
        request.setValue("crm_session=\(session)", forHTTPHeaderField: "Cookie")
        request.setValue(purpose == .collection ? "collection" : "preparation", forHTTPHeaderField: "X-Forge-Terminal-Purpose")
        if purpose.requestsTerms { request.setValue("true", forHTTPHeaderField: "X-Forge-Authorized-Representative") }
        return request
    }

    static func token(from data: Data, account: String) throws -> String {
        try authorization(from: data, account: account, purpose: .collection).secret
    }

    static func authorization(from data: Data, account: String, purpose: TerminalSessionPurpose, configuration: TerminalEnvironment? = configuration) throws -> (secret: String, permitsTerms: Bool) {
        guard let configuration else { throw TerminalFailure.sessionChanged }
        struct Response: Decodable { let secret: String; let stripe_account: String; let tos_acceptance_permitted: Bool?; let provider_mode: String? }
        let response = try JSONDecoder().decode(Response.self, from: data)
        guard response.stripe_account == account, !response.secret.isEmpty else { throw TerminalFailure.sessionChanged }
        // Older production servers omit this field. Test sessions never may.
        guard (response.provider_mode ?? "live") == configuration.providerMode else { throw TerminalFailure.sessionChanged }
        let permitsTerms = response.tos_acceptance_permitted == true
        guard permitsTerms == purpose.requestsTerms else { throw TerminalFailure.sessionChanged }
        return (response.secret, permitsTerms)
    }
}
