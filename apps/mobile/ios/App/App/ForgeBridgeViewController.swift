import Capacitor

final class ForgeBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ForgeWidgetPlugin())
    }
}
