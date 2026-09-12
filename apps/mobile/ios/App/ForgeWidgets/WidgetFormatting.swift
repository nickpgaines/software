import Foundation

func formatCompactCurrency(_ cents: Int) -> String {
    let amount = Double(abs(cents)) / 100
    let sign = cents < 0 ? "-" : ""
    if amount >= 1_000_000 {
        let compact = ((amount / 1_000_000) * 10)
            .rounded(.toNearestOrAwayFromZero) / 10
        return "\(sign)$" + String(format: "%.1fM", compact)
    }
    if amount >= 1_000 {
        let compact = ((amount / 1_000) * 10)
            .rounded(.toNearestOrAwayFromZero) / 10
        return "\(sign)$" + String(format: "%.1fK", compact)
    }
    return "\(sign)$\(Int(amount.rounded()))"
}
