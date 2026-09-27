import Foundation

struct TerminalReaderProgress {
    let phase: String
    let message: String
    let progress: Double?
}

/// A reference identity owned by one SDK connection delegate. Invalidation
/// happens before cancellation/disconnection, so delayed events cannot reach a
/// replacement operation even if the SDK delivers them after cleanup completes.
final class TerminalReaderEventLease {
    private var active = true
    private let unexpectedDisconnect: () -> Void
    private let progress: (TerminalReaderProgress) -> Void

    init(unexpectedDisconnect: @escaping () -> Void, progress: @escaping (TerminalReaderProgress) -> Void = { _ in }) {
        self.unexpectedDisconnect = unexpectedDisconnect
        self.progress = progress
    }

    func report(_ update: TerminalReaderProgress) {
        precondition(Thread.isMainThread)
        guard active else { return }
        progress(update)
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
