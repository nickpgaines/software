import Capacitor
import Foundation
import WidgetKit

@objc(ForgeWidgetPlugin)
public final class ForgeWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ForgeWidgetPlugin"
    public let jsName = "ForgeWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getInstallation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storeCredential", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "credentialMetadata", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearCredential", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "refreshSnapshot", returnType: CAPPluginReturnPromise),
    ]

    private let store = ForgeWidgetStore()
    private let summaryURL = URL(string: "https://www.forgecrm.app/api/widget/summary")!

    @objc func getInstallation(_ call: CAPPluginCall) {
        do {
            call.resolve(["installation_id": try store.installationIdentifier()])
        } catch {
            call.reject("Unable to prepare the widget on this device.")
        }
    }

    @objc func storeCredential(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), !token.isEmpty,
              let companyID = call.getInt("company_id"),
              let staffID = call.getInt("staff_id"),
              let expiresAtValue = call.getString("expires_at"),
              let expiresAt = parseISO8601(expiresAtValue) else {
            call.reject("Invalid widget credential.")
            return
        }
        do {
            try store.saveCredential(
                ForgeWidgetCredential(
                    token: token,
                    companyID: companyID,
                    staffID: staffID,
                    expiresAt: expiresAt
                )
            )
            WidgetCenter.shared.reloadAllTimelines()
            call.resolve()
        } catch {
            call.reject("Unable to save the widget credential.")
        }
    }

    @objc func credentialMetadata(_ call: CAPPluginCall) {
        do {
            guard let credential = try store.loadCredential() else {
                call.resolve(["credential": NSNull()])
                return
            }
            call.resolve([
                "credential": [
                    "token": credential.token,
                    "company_id": credential.companyID,
                    "staff_id": credential.staffID,
                    "expires_at": ISO8601DateFormatter().string(from: credential.expiresAt),
                ],
            ])
        } catch {
            call.reject("Unable to read the widget credential.")
        }
    }

    @objc func clearCredential(_ call: CAPPluginCall) {
        do {
            try store.clearCredentialAndCache()
            WidgetCenter.shared.reloadAllTimelines()
            call.resolve()
        } catch {
            call.reject("Unable to clear the widget credential.")
        }
    }

    @objc func refreshSnapshot(_ call: CAPPluginCall) {
        Task {
            do {
                guard let credential = try store.loadCredential() else {
                    call.resolve(["refreshed": false])
                    return
                }
                var request = URLRequest(url: summaryURL)
                request.cachePolicy = .reloadIgnoringLocalCacheData
                request.setValue(
                    "Bearer \(credential.token)",
                    forHTTPHeaderField: "Authorization"
                )
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse else {
                    call.reject("Invalid widget response.")
                    return
                }
                if http.statusCode == 401 || http.statusCode == 403 {
                    try store.clearCredentialAndCache()
                    WidgetCenter.shared.reloadAllTimelines()
                    call.resolve(["refreshed": false, "reconnect": true])
                    return
                }
                guard http.statusCode == 200 else {
                    call.resolve(["refreshed": false])
                    return
                }
                let snapshot = try JSONDecoder.forgeWidgetDecoder().decode(
                    ForgeWidgetSnapshot.self,
                    from: data
                )
                guard snapshot.version == 1,
                      snapshot.companyID == credential.companyID,
                      snapshot.staffID == credential.staffID else {
                    call.reject("Widget response did not match this account.")
                    return
                }
                try store.saveSnapshot(snapshot)
                WidgetCenter.shared.reloadAllTimelines()
                call.resolve(["refreshed": true])
            } catch {
                call.resolve(["refreshed": false])
            }
        }
    }

    private func parseISO8601(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}
