import Foundation

final class ForgeTerminalDocument {
    private(set) var fileURL: URL?
    func begin(text: String) throws -> URL {
        guard fileURL == nil,
              text.hasPrefix("Declined transaction — not proof of payment\n"),
              let data = text.data(using: .utf8), data.count <= 16_384,
              !text.unicodeScalars.contains(where: { $0.value < 32 && $0.value != 10 }) else {
            throw TerminalFailure.terminalError
        }
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("forge-declined-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
        let url = folder.appendingPathComponent("declined-transaction.txt")
        do {
            try data.write(to: url, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
            #if os(iOS)
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: url.path)
            #endif
            fileURL = url
            return url
        } catch {
            try? FileManager.default.removeItem(at: folder)
            throw error
        }
    }
    func finish() {
        if let fileURL { try? FileManager.default.removeItem(at: fileURL.deletingLastPathComponent()) }
        fileURL = nil
    }
    deinit { finish() }
}

#if canImport(UIKit)
import UIKit

enum TerminalDocumentPresentation {
    static func controller(url: URL, presenter: UIViewController) -> UIActivityViewController {
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = presenter.view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
        sheet.popoverPresentationController?.permittedArrowDirections = []
        return sheet
    }
}
#endif
