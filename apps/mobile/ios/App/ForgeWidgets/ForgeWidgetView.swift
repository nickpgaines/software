import SwiftUI
import WidgetKit

struct ForgeWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ForgeWidgetEntry

    var body: some View {
        ForgeWidgetContent(entry: entry, family: family)
            .containerBackground(for: .widget) {
                LinearGradient(
                    colors: [Color.black, Color(red: 0.10, green: 0.10, blue: 0.12)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
    }
}
