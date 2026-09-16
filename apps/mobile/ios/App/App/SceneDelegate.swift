import UIKit
import Capacitor
import WebKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    // UIKit creates this window and the Forge bridge from the scene storyboard.
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // Register Capacitor's listeners before forwarding cold-launch links.
        window?.rootViewController?.loadViewIfNeeded()
        openURLContexts(connectionOptions.urlContexts)
        for activity in connectionOptions.userActivities {
            continueUserActivity(activity)
        }
    }

    func sceneWillResignActive(_ scene: UIScene) {
        flushWebViewCookies()
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        flushWebViewCookies()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        openURLContexts(URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        continueUserActivity(userActivity)
    }

    private func openURLContexts(_ contexts: Set<UIOpenURLContext>) {
        for context in contexts {
            var options: [UIApplication.OpenURLOptionsKey: Any] = [
                .openInPlace: context.options.openInPlace,
            ]
            if let sourceApplication = context.options.sourceApplication {
                options[.sourceApplication] = sourceApplication
            }
            if let annotation = context.options.annotation {
                options[.annotation] = annotation
            }
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared, open: context.url, options: options
            )
        }
    }

    private func continueUserActivity(_ activity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared, continue: activity, restorationHandler: { _ in }
        )
    }

    /// Keep WebKit's cookie-store round trip alive across deactivation/background
    /// so login and logout cookies can persist before iOS suspends the process.
    /// The lifecycle transition triggers persistence; reading cookies alone does not.
    private func flushWebViewCookies() {
        let application = UIApplication.shared
        var task: UIBackgroundTaskIdentifier = .invalid
        task = application.beginBackgroundTask(withName: "FlushWebViewCookies") {
            if task != .invalid {
                application.endBackgroundTask(task)
                task = .invalid
            }
        }
        WKWebsiteDataStore.default().httpCookieStore.getAllCookies { _ in
            if task != .invalid {
                application.endBackgroundTask(task)
                task = .invalid
            }
        }
    }
}
