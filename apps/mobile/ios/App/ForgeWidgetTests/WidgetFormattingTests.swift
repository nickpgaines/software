import XCTest

final class WidgetFormattingTests: XCTestCase {
    func testCompactCurrencyFormatting() {
        XCTAssertEqual(formatCompactCurrency(0), "$0")
        XCTAssertEqual(formatCompactCurrency(990_200), "$9.9K")
        XCTAssertEqual(formatCompactCurrency(125_000_000), "$1.3M")
        XCTAssertEqual(formatCompactCurrency(-250_000), "-$2.5K")
    }
}
