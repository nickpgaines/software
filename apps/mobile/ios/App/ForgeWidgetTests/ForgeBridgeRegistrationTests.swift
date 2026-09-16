import XCTest

@MainActor
final class ForgeBridgeRegistrationTests: XCTestCase {
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
