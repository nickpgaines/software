import Foundation

enum TerminalSessionPolicy {
    static let origin = "https://www.forgecrm.app"
    static let endpoint = URL(string: origin + "/api/stripe/terminal/connection-token")!

    static func isTrusted(_ url: URL?) -> Bool {
        guard let url else { return false }
        return url.scheme == "https" && url.host == "www.forgecrm.app"
            && (url.port == nil || url.port == 443) && url.user == nil && url.password == nil
    }

    static func sessionCookie(from cookies: [HTTPCookie]) throws -> String {
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

    static func request(session: String, account: String, purpose: TerminalSessionPurpose = .collection) -> URLRequest {
        var request = URLRequest(url: endpoint, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.httpMethod = "POST"
        request.httpShouldHandleCookies = false
        request.setValue(origin, forHTTPHeaderField: "Origin")
        request.setValue(account, forHTTPHeaderField: "X-Forge-Stripe-Account")
        request.setValue("crm_session=\(session)", forHTTPHeaderField: "Cookie")
        request.setValue(purpose == .collection ? "collection" : "preparation", forHTTPHeaderField: "X-Forge-Terminal-Purpose")
        if purpose.requestsTerms { request.setValue("true", forHTTPHeaderField: "X-Forge-Authorized-Representative") }
        return request
    }

    static func token(from data: Data, account: String) throws -> String {
        try authorization(from: data, account: account, purpose: .collection).secret
    }

    static func authorization(from data: Data, account: String, purpose: TerminalSessionPurpose) throws -> (secret: String, permitsTerms: Bool) {
        struct Response: Decodable { let secret: String; let stripe_account: String; let tos_acceptance_permitted: Bool? }
        let response = try JSONDecoder().decode(Response.self, from: data)
        guard response.stripe_account == account, !response.secret.isEmpty else { throw TerminalFailure.sessionChanged }
        let permitsTerms = response.tos_acceptance_permitted == true
        guard permitsTerms == purpose.requestsTerms else { throw TerminalFailure.sessionChanged }
        return (response.secret, permitsTerms)
    }
}
