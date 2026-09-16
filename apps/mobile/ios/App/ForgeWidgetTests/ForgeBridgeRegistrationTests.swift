import XCTest
@testable import App

@MainActor
final class ForgeBridgeRegistrationTests: XCTestCase {
    func testApplicationLaunchesWithBridgeInWindowScene() throws {
        let manifest = try XCTUnwrap(
            Bundle.main.object(forInfoDictionaryKey: "UIApplicationSceneManifest") as? [String: Any],
            "iOS 27 requires an explicit scene configuration."
        )
        let configurations = try XCTUnwrap(manifest["UISceneConfigurations"] as? [String: [[String: Any]]])
        let configuration = try XCTUnwrap(configurations["UIWindowSceneSessionRoleApplication"]?.first)
        let delegateName = try XCTUnwrap(configuration["UISceneDelegateClassName"] as? String)
        let delegateClass: AnyClass = try XCTUnwrap(NSClassFromString(delegateName))
        let scene = try XCTUnwrap(
            UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first,
            "Forge must adopt the scene lifecycle to launch on iOS 27."
        )
        XCTAssertTrue((scene.delegate as? NSObject)?.isKind(of: delegateClass) == true)
        let controller = try XCTUnwrap(
            scene.windows.compactMap { $0.rootViewController as? ForgeBridgeViewController }.first,
            "The scene must host Forge's Capacitor bridge."
        )
        controller.loadViewIfNeeded()
        XCTAssertNotNil(controller.webView)
    }

    func testLoadingBridgeExportsForgeWidgetPluginToJavaScript() {
        let controller = ForgeBridgeViewController()

        controller.loadViewIfNeeded()

        let scripts = controller.webView?.configuration.userContentController.userScripts ?? []
        XCTAssertTrue(
            scripts.contains { $0.source.contains("p['ForgeWidget']") },
            "ForgeWidget must be exported before the production web app loads."
        )
    }
}
