import Foundation
import UniformTypeIdentifiers
import WebKit

/// Serves the pages of a release build, from the folder next to the running JS bundle, on an origin
/// of their own.
///
/// WebKit answers `http` and `https` itself and refuses a handler for them, so the pages live on a
/// scheme of their own: `use-dom://localhost/dom.bundle/<file>` is `<root>/<file>`. The origin stays the
/// same whichever bundle runs, so page storage survives over-the-air updates and rollbacks.
final class OfflineBundleSchemeHandler: NSObject, WKURLSchemeHandler {
  static let scheme = "use-dom"
  private static let bundleDirectory = "dom.bundle"

  /// The pages folder next to the running bundle. Nothing is served while it is unset: a page is
  /// never taken from the app binary in place of the running bundle's own.
  var root: URL?

  /// Called with the URL of a page (an `.html` under the bundle folder) that is not in the bundle, so
  /// the view can report it. WebKit does not route a `WKURLSchemeHandler`'s response through the
  /// navigation delegate, so a 404 answered here would otherwise be rendered as the page.
  var onPageMissing: ((URL) -> Void)?

  func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    guard let url = task.request.url else {
      task.didFailWithError(URLError(.badURL))
      return
    }
    // Existence is part of the guard: `resolve` only keeps the path inside the bundle, so a page that
    // was never written, or was removed, has to be reported as missing here, not left to fail the read.
    guard let file = resolve(url), FileManager.default.fileExists(atPath: file.path) else {
      if url.pathExtension == "html" {
        onPageMissing?(url)
      }
      respond(task, url: url, status: 404, type: "text/plain; charset=utf-8", body: Data("Not found".utf8))
      return
    }
    // The page exists but cannot be read: that is an I/O failure, not a missing page, so the task
    // fails and the navigation delegate reports it, instead of reporting it as `PageNotFound`.
    do {
      let data = try Data(contentsOf: file)
      respond(task, url: url, status: 200, type: mimeType(of: file), body: data)
    } catch {
      task.didFailWithError(error)
    }
  }

  func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
    // Every response is written synchronously in `start`, so there is never one left to stop.
  }

  /// The file a URL names, as long as it is inside the pages folder.
  private func resolve(_ url: URL) -> URL? {
    let prefix = "/\(OfflineBundleSchemeHandler.bundleDirectory)/"
    guard let root = root?.standardizedFileURL, url.path.hasPrefix(prefix) else { return nil }
    let file = root.appendingPathComponent(String(url.path.dropFirst(prefix.count))).standardizedFileURL
    guard file.path.hasPrefix(root.path + "/") else { return nil }
    return file
  }

  private func mimeType(of file: URL) -> String {
    let type = UTType(filenameExtension: file.pathExtension)
    let mime = type?.preferredMIMEType ?? "application/octet-stream"
    return type?.conforms(to: .text) == true ? "\(mime); charset=utf-8" : mime
  }

  private func respond(_ task: WKURLSchemeTask, url: URL, status: Int, type: String, body: Data) {
    let headers = ["Content-Type": type, "Content-Length": String(body.count), "Cache-Control": "no-cache"]
    guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)
    else {
      task.didFailWithError(URLError(.cannotParseResponse))
      return
    }
    task.didReceive(response)
    task.didReceive(body)
    task.didFinish()
  }
}
