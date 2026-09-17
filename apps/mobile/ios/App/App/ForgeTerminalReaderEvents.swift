import Foundation

/// A reference identity owned by one SDK connection delegate. Invalidation
/// happens before cancellation/disconnection, so delayed events cannot reach a
/// replacement operation even if the SDK delivers them after cleanup completes.
final class TerminalReaderEventLease {
    private var active = true
    private let unexpectedDisconnect: () -> Void

    init(unexpectedDisconnect: @escaping () -> Void) {
        self.unexpectedDisconnect = unexpectedDisconnect
    }

    func invalidate() {
        precondition(Thread.isMainThread)
        active = false
    }

    func didDisconnect(intentional: Bool) {
        precondition(Thread.isMainThread)
        guard active, !intentional else { return }
        active = false
        unexpectedDisconnect()
    }
}
