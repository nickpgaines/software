import SwiftUI
import WidgetKit
import XCTest

final class WidgetTrendTests: XCTestCase {
    @MainActor
    func testSteadyRevenueRendersThinLineWithSubtleAreaInsteadOfSolidBars() throws {
        for width in [128, 306] {
            let points = (1...12).map { ForgeWidgetTrendPoint(date: "month-\($0)", cents: 100_000) }
            let image = try render(MiniTrend(points: points, color: .orange)
                .frame(width: CGFloat(width), height: 52).background(.black))
            let cgImage = try XCTUnwrap(image.cgImage)
            let bright = try brightPixels(image)
            XCTAssertGreaterThan(bright, width, "The revenue line must remain visible")
            XCTAssertLessThan(bright, cgImage.width * cgImage.height / 5,
                "Revenue should be a thin stroke, not filled bars")
            let pixels = try rgbaPixels(image)
            let center = ((cgImage.height / 2) * cgImage.width + cgImage.width / 2) * 4
            XCTAssertGreaterThan(pixels[center], 2, "A subtle gradient should sit beneath the line")
            XCTAssertLessThan(pixels[center], 80, "The area fill must not compete with the line")
        }
    }

    @MainActor
    func testSingleRevenuePointIsVisibleWithoutInventingAFullPeriod() throws {
        let image = try render(MiniTrend(points: [.init(date: "2026-09-01", cents: 100_000)], color: .orange)
            .frame(width: 128, height: 38).background(.black))
        XCTAssertGreaterThan(try brightPixels(image), 5)
        XCTAssertLessThan(try brightPixels(image), 120, "A single observation should be a dot, not a full-width bar")
    }

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
    func testDefaultPaletteIsNeutralAcrossWidgetStates() throws {
        for (name, entry) in previewEntries() {
            let image = try renderWidgetSizes(entry)
            let pixels = try rgbaPixels(image)
            let saturated = stride(from: 0, to: pixels.count, by: 4).filter {
                let channels = [pixels[$0], pixels[$0 + 1], pixels[$0 + 2]]
                return Int(channels.max()!) - Int(channels.min()!) > 50
            }.count
            XCTAssertEqual(saturated, 0, "\(name) must match Forge's neutral default palette")
        }
    }

    @MainActor
    func testWidgetPreviewImages() throws {
        for (name, entry) in previewEntries() {
            let image = try renderWidgetSizes(entry)
            let attachment = XCTAttachment(image: image)
            attachment.name = name
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    private func previewEntries() -> [(String, ForgeWidgetEntry)] {
        let dayRevenue = [1: 650, 2: 850, 3: 1200, 4: 450, 7: 1750, 8: 925,
                          9: 1375, 10: 600, 11: 1600, 14: 850, 15: 1200, 16: 1000]
        let now = Date(timeIntervalSince1970: 1_789_602_000)
        func snapshot(empty: Bool = false, allowed: Bool = true) -> ForgeWidgetSnapshot {
            let points = (1...30).map {
                ForgeWidgetTrendPoint(date: "2026-09-\(String(format: "%02d", $0))",
                    cents: empty ? 0 : (dayRevenue[$0] ?? 0) * 100)
            }
            return ForgeWidgetSnapshot(version: 1, companyID: 17, staffID: 23,
                updatedAt: now, permissions: .init(reports: allowed, salesLeaderboard: allowed),
                metrics: .init(monthlyRevenue: .init(totalCents: empty ? 0 : 1_245_000, trend: points),
                    ytdRevenue: .init(totalCents: 3_184_000, trend: (1...12).map {
                        .init(date: "2026-\($0)-01", cents: $0 <= 9 ? $0 * 50_000 : 0)
                    }), currentARRCents: 2_400_000, salesLeaderboard: empty ? [] : [
                        .init(staffID: 26, name: "Priya Shah", revenueCents: 472_500, jobCount: 4),
                        .init(staffID: 25, name: "Dana Kim", revenueCents: 440_000, jobCount: 4),
                        .init(staffID: 24, name: "Marcus Reyes", revenueCents: 332_500, jobCount: 4),
                    ]))
        }
        return [
            ("monthly-revenue", .init(date: now, metric: .monthlyRevenue, snapshot: snapshot(), state: .connected)),
            ("monthly-zero", .init(date: now, metric: .monthlyRevenue, snapshot: snapshot(empty: true), state: .connected)),
            ("ytd-revenue", .init(date: now, metric: .ytdRevenue, snapshot: snapshot(), state: .connected)),
            ("arr", .init(date: now, metric: .currentARR, snapshot: snapshot(), state: .connected)),
            ("leaderboard", .init(date: now, metric: .salesLeaderboard, snapshot: snapshot(), state: .connected)),
            ("leaderboard-empty", .init(date: now, metric: .salesLeaderboard, snapshot: snapshot(empty: true), state: .connected)),
            ("reconnect", .init(date: now, metric: .monthlyRevenue, snapshot: nil, state: .reconnect)),
            ("unavailable", .init(date: now, metric: .monthlyRevenue, snapshot: nil, state: .unavailable)),
            ("permission-denied", .init(date: now, metric: .monthlyRevenue, snapshot: snapshot(allowed: false), state: .connected)),
            ("cached", .init(date: now, metric: .monthlyRevenue, snapshot: snapshot(), state: .cached)),
        ]
    }

    @MainActor
    private func renderWidgetSizes(_ entry: ForgeWidgetEntry) throws -> UIImage {
        try render(HStack(spacing: 16) {
            ForgeWidgetContent(entry: entry, family: .systemSmall)
                .padding(16).frame(width: 170, height: 170)
                .background(ForgeWidgetStyle.card).clipShape(RoundedRectangle(cornerRadius: 22))
            ForgeWidgetContent(entry: entry, family: .systemMedium)
                .padding(16).frame(width: 364, height: 170)
                .background(ForgeWidgetStyle.card).clipShape(RoundedRectangle(cornerRadius: 22))
        }.padding(20).background(Color(white: 0.15)))
    }

    @MainActor
    private func render<V: View>(_ view: V) throws -> UIImage {
        let renderer = ImageRenderer(content: view)
        renderer.scale = 2
        return try XCTUnwrap(renderer.uiImage)
    }

    private func brightPixels(_ image: UIImage) throws -> Int {
        let pixels = try rgbaPixels(image)
        return stride(from: 0, to: pixels.count, by: 4).filter {
            pixels[$0] > 150 && pixels[$0 + 1] < 200 && pixels[$0 + 2] < 100
        }.count
    }

    private func rgbaPixels(_ image: UIImage) throws -> [UInt8] {
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
        return pixels
    }
}
