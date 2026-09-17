import SwiftUI
import WidgetKit

struct ForgeWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ForgeWidgetEntry

    var body: some View {
        ForgeWidgetContent(entry: entry, family: family)
            .containerBackground(for: .widget) {
                ForgeWidgetStyle.card
            }
    }
}
