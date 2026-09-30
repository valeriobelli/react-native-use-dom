import Foundation
import UniformTypeIdentifiers
import WebKit

/// Serves the pages release builds embed, from the app bundle, on an origin of their own.
///
/// WebKit answers `http` and `https` itself and refuses a handler for them, so the pages live on a
/// scheme of their own: `use-dom://localhost/dom.bundle/<file>` is `<app>/dom.bundle/<file>`.
final class OfflineBundleSchemeHandler: NSObject, WKURLSchemeHandler {
  static let scheme = "use-dom"
  private static let bundleDirectory = "dom.bundle"

  private let root = Bundle.main.resourceURL?
    .appendingPathComponent(OfflineBundleSchemeHandler.bundleDirectory, isDirectory: true)
    .standardizedFileURL

  func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    guard let url = task.request.url else {
      task.didFailWithError(URLError(.badURL))
      return
    }
    guard let file = resolve(url), let data = try? Data(contentsOf: file) else {
      respond(task, url: url, status: 404, type: "text/plain; charset=utf-8", body: Data("Not found".utf8))
      return
    }
    respond(task, url: url, status: 200, type: mimeType(of: file), body: data)
  }

  func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
    // Every response is written synchronously in `start`, so there is never one left to stop.
  }

  /// The file a URL names, as long as it is inside the bundle's pages folder.
  private func resolve(_ url: URL) -> URL? {
    let prefix = "/\(OfflineBundleSchemeHandler.bundleDirectory)/"
    guard let root, url.path.hasPrefix(prefix) else { return nil }
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
