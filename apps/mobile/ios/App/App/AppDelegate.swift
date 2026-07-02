import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    /// Persist the WKWebView's cookies to the on-disk store before the app can
    /// be suspended or terminated.
    ///
    /// WebKit bug 177478: cookies set via an XHR/fetch `Set-Cookie` response
    /// (how `/api/login` issues `crm_session`, and how `/api/logout` clears it)
    /// are not reliably written to WKWebView's on-disk store until the app
    /// leaves the foreground. Without this, force-quitting after login loses the
    /// session (bounced to /login on relaunch); symmetrically, a logout could be
    /// undone if the app dies before the cleared cookie is persisted, silently
    /// resurrecting an ended session.
    ///
    /// It is the foreground→inactive/background transition itself that triggers
    /// WebKit to persist these cookies (per the bug thread) — the `getAllCookies`
    /// call rides that transition and keeps the WKHTTPCookieStore round-trip
    /// alive; it is not the read that writes to disk. The work is async, so we
    /// hold a background-task assertion until the completion fires — otherwise
    /// iOS can suspend the process before the on-disk write lands (a real-device
    /// race the simulator's lenient timing hides). We flush on both resign-active
    /// and background so a logout that is never followed by a clean background
    /// transition is still persisted. Native cookie persistence only — the
    /// HMAC/session logic is untouched.
    private func flushWebViewCookies(_ application: UIApplication) {
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

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Persist any pending cookie change (e.g. a logout that just cleared
        // crm_session) before the app could be killed without a clean
        // background transition (see flushWebViewCookies).
        flushWebViewCookies(application)
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
        // Persist the session cookie before a possible force-quit (see flushWebViewCookies).
        flushWebViewCookies(application)
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
