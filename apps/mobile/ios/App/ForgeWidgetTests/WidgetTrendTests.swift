import SwiftUI
import WidgetKit
import XCTest

final class WidgetTrendTests: XCTestCase {
    @MainActor
    func testEarlyMonthRevenueIsVisibleAtBothWidgetWidths() throws {
        for days in [28, 29, 30, 31] {
            for width in [128, 306] {
                let points = (1...days).map {
                    ForgeWidgetTrendPoint(date: "day-\($0)", cents: $0 == 1 ? 100_000 : 0)
                }
                let image = try render(MiniTrend(points: points, color: .orange)
                    .frame(width: CGFloat(width), height: 38)
                    .background(.black))
                XCTAssertGreaterThan(try brightPixels(image), 40,
                    "Day-one revenue must remain visible for a \(days)-day month at width \(width)")
            }
        }
    }

    @MainActor
    func testEmptyAndZeroTrendsDoNotInventRevenue() throws {
        for points in [[], (1...31).map { ForgeWidgetTrendPoint(date: "day-\($0)", cents: 0) }] {
            let image = try render(MiniTrend(points: points, color: .orange)
                .frame(width: 128, height: 38)
                .background(.black))
            XCTAssertEqual(try brightPixels(image), 0)
        }
    }

    @MainActor
    func testWidgetPreviewImages() throws {
        let dayRevenue = [1: 650, 2: 850, 3: 1200, 4: 450, 7: 1750, 8: 925,
                          9: 1375, 10: 600, 11: 1600, 14: 850, 15: 1200, 16: 1000]
        let now = Date(timeIntervalSince1970: 1_789_602_000)
        for isEmpty in [false, true] {
            let points = (1...30).map {
                ForgeWidgetTrendPoint(date: "2026-09-\(String(format: "%02d", $0))",
                    cents: isEmpty ? 0 : (dayRevenue[$0] ?? 0) * 100)
            }
            let snapshot = ForgeWidgetSnapshot(version: 1, companyID: 17, staffID: 23,
                updatedAt: now, permissions: .init(reports: true, salesLeaderboard: true),
                metrics: .init(monthlyRevenue: .init(totalCents: isEmpty ? 0 : 1_245_000, trend: points),
                    ytdRevenue: nil, currentARRCents: nil, salesLeaderboard: nil))
            let entry = ForgeWidgetEntry(date: now, metric: .monthlyRevenue,
                snapshot: snapshot, state: .connected)
            let image = try render(HStack(spacing: 16) {
                ForgeWidgetContent(entry: entry, family: .systemSmall)
                    .padding(16).frame(width: 170, height: 170)
                    .background(.black).clipShape(RoundedRectangle(cornerRadius: 22))
                ForgeWidgetContent(entry: entry, family: .systemMedium)
                    .padding(16).frame(width: 364, height: 170)
                    .background(.black).clipShape(RoundedRectangle(cornerRadius: 22))
            }.padding(20).background(Color(white: 0.15)))
            let name = isEmpty ? "widget-monthly-zero" : "widget-monthly-revenue"
            let attachment = XCTAttachment(image: image)
            attachment.name = name
            attachment.lifetime = .keepAlways
            add(attachment)
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(name + ".png")
            try XCTUnwrap(image.pngData()).write(to: url)
            print("FORGE_WIDGET_RENDER \(url.path)")
        }
    }

    @MainActor
    private func render<V: View>(_ view: V) throws -> UIImage {
        let renderer = ImageRenderer(content: view)
        renderer.scale = 2
        return try XCTUnwrap(renderer.uiImage)
    }

    private func brightPixels(_ image: UIImage) throws -> Int {
        let cgImage = try XCTUnwrap(image.cgImage)
        let width = cgImage.width
        let height = cgImage.height
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        try pixels.withUnsafeMutableBytes { buffer in
            let context = try XCTUnwrap(CGContext(data: buffer.baseAddress, width: width, height: height,
                bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
            context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
        }
        return stride(from: 0, to: pixels.count, by: 4).filter {
            pixels[$0] > 150 && pixels[$0 + 1] < 200 && pixels[$0 + 2] < 100
        }.count
    }
}
