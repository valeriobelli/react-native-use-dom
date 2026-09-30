import Foundation
import NitroModules
import UIKit
import WebKit

/// The WebView a DOM component renders into.
///
/// It loads exactly one page and keeps it there: navigating the main frame anywhere outside the
/// page's own origin is refused and reported, and so is opening a window. The page talks to the
/// app through `window.ReactNativeWebView`, which is in place before the page's first script runs.
class HybridRNUseDomWebView: HybridRNUseDomWebViewSpec {
  private let webView: WKWebView
  private let coordinator: Coordinator
  private var needsLoad = false
  private var needsBridgeScript = true

  override init() {
    let configuration = WKWebViewConfiguration()
    configuration.setURLSchemeHandler(OfflineBundleSchemeHandler(), forURLScheme: OfflineBundleSchemeHandler.scheme)
    configuration.allowsInlineMediaPlayback = true
    coordinator = Coordinator()
    configuration.userContentController.add(coordinator, name: Coordinator.messageHandlerName)

    webView = WKWebView(frame: .zero, configuration: configuration)
    // The background of the view around it shows until the page paints, and wherever the page is
    // transparent.
    webView.isOpaque = false
    webView.backgroundColor = .clear
    webView.scrollView.backgroundColor = .clear
    webView.scrollView.contentInsetAdjustmentBehavior = .never
    super.init()

    coordinator.owner = self
    webView.navigationDelegate = coordinator
    webView.uiDelegate = coordinator
  }

  var view: UIView { webView }

  // MARK: Props

  var source: String = "" {
    didSet { if source != oldValue { needsLoad = true } }
  }

  var injectedObjectJson: String = "{}" {
    didSet { if injectedObjectJson != oldValue { needsBridgeScript = true } }
  }

  var scrollEnabled: Bool = true {
    didSet { onMain { $0.webView.scrollView.isScrollEnabled = $0.scrollEnabled } }
  }

  var inspectable: Bool = false {
    didSet {
      onMain { owner in
        if #available(iOS 16.4, *) { owner.webView.isInspectable = owner.inspectable }
      }
    }
  }

  var onMessage: (_ message: String) -> Void = { _ in }
  var onLoadEnd: () -> Void = {}
  var onLoadError: (_ reason: String) -> Void = { _ in }
  var onNavigationBlocked: (_ url: String) -> Void = { _ in }

  func afterUpdate() {
    onMain { owner in
      // The script only runs on the next document, so it goes in before the load that uses it.
      if owner.needsBridgeScript { owner.installBridgeScript() }
      if owner.needsLoad { owner.load() }
    }
  }

  func onDropView() {
    onMain { owner in
      owner.webView.stopLoading()
      owner.webView.configuration.userContentController.removeAllScriptMessageHandlers()
    }
  }

  // MARK: Methods

  func dispatchMessage(eventName: String, payload: String) throws {
    let script = "window.dispatchEvent(new CustomEvent(\(jsString(eventName)), { detail: \(jsString(payload)) }));"
    onMain { $0.webView.evaluateJavaScript(script, completionHandler: nil) }
  }

  func reload() throws {
    onMain { $0.webView.reload() }
  }

  // MARK: Page

  /// The origin of the page being shown, which is the only one the main frame may navigate within.
  fileprivate var pageOrigin: Origin? {
    URL(string: source).flatMap { Origin(url: $0) }
  }

  private func load() {
    needsLoad = false
    guard let url = URL(string: source) else {
      onLoadError("\(source) is not a valid URL.")
      return
    }
    webView.load(URLRequest(url: url))
  }

  private func installBridgeScript() {
    needsBridgeScript = false
    let controller = webView.configuration.userContentController
    controller.removeAllUserScripts()
    let script = """
      (function () {
        var handler = window.webkit.messageHandlers.\(Coordinator.messageHandlerName);
        var injected = \(jsString(injectedObjectJson));
        Object.defineProperty(window, 'ReactNativeWebView', {
          value: Object.freeze({
            postMessage: function (message) { handler.postMessage(String(message)); },
            injectedObjectJson: function () { return injected; },
          }),
        });
      })();
      """
    controller.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
  }

  /// Props arrive on the main thread from React, but methods can be called from the JS thread.
  private func onMain(_ body: @escaping (HybridRNUseDomWebView) -> Void) {
    if Thread.isMainThread {
      body(self)
    } else {
      DispatchQueue.main.async { [weak self] in
        if let self { body(self) }
      }
    }
  }
}

/// A string as a JavaScript literal. JSON strings are valid JavaScript, and encoding one never fails.
private func jsString(_ value: String) -> String {
  let data = try! JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed])
  return String(decoding: data, as: UTF8.self)
}

/// The part of a URL that decides whether two pages are the same site, as the web defines it.
private struct Origin: Equatable {
  let scheme: String
  let host: String
  let port: Int?

  init?(url: URL) {
    guard let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased() else { return nil }
    self.scheme = scheme
    self.host = host
    port = url.port ?? Origin.defaultPorts[scheme]
  }

  init(frame: WKSecurityOrigin) {
    scheme = frame.protocol.lowercased()
    host = frame.host.lowercased()
    port = frame.port == 0 ? Origin.defaultPorts[scheme] : frame.port
  }

  private static let defaultPorts = ["http": 80, "https": 443]
}

/// The WebKit delegates. A separate object, because WebKit needs an `NSObject` and holds its
/// message handlers strongly: it keeps only a weak reference to the view it works for.
private final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
  static let messageHandlerName = "reactNativeUseDom"

  weak var owner: HybridRNUseDomWebView?
  /// Whether the current load already failed, so that it does not also report having loaded.
  private var loadFailed = false

  func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    guard let owner, message.frameInfo.isMainFrame,
      Origin(frame: message.frameInfo.securityOrigin) == owner.pageOrigin,
      let body = message.body as? String
    else { return }
    owner.onMessage(body)
  }

  func webView(
    _ webView: WKWebView,
    decidePolicyFor action: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
  ) {
    guard let owner else { return decisionHandler(.cancel) }
    // A frame other than the page itself, such as an embedded video, may go where it likes.
    let isMainFrame = action.targetFrame?.isMainFrame ?? true
    guard isMainFrame, let url = action.request.url else { return decisionHandler(.allow) }

    if action.targetFrame != nil, Origin(url: url) == owner.pageOrigin {
      decisionHandler(.allow)
    } else {
      decisionHandler(.cancel)
      owner.onNavigationBlocked(url.absoluteString)
    }
  }

  func webView(
    _ webView: WKWebView,
    decidePolicyFor response: WKNavigationResponse,
    decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
  ) {
    // The page is still shown, since a development server explains its errors in the page.
    if response.isForMainFrame, let http = response.response as? HTTPURLResponse, http.statusCode >= 400 {
      loadFailed = true
      owner?.onLoadError("Loading \(http.url?.absoluteString ?? "the page") failed with HTTP \(http.statusCode).")
    }
    decisionHandler(.allow)
  }

  func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
    loadFailed = false
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    if !loadFailed { owner?.onLoadEnd() }
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    report(error)
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    report(error)
  }

  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    // The system reclaims a WebView's process under memory pressure, which leaves it blank.
    webView.reload()
  }

  func webView(
    _ webView: WKWebView,
    createWebViewWith configuration: WKWebViewConfiguration,
    for action: WKNavigationAction,
    windowFeatures: WKWindowFeatures
  ) -> WKWebView? {
    if let url = action.request.url { owner?.onNavigationBlocked(url.absoluteString) }
    return nil
  }

  private func report(_ error: Error) {
    let error = error as NSError
    // A load replaced by another, or one this delegate refused, is not a failure of the page. 102 is
    // WebKit's "frame load interrupted", which a refused navigation also raises.
    let isCancellation = error.domain == NSURLErrorDomain && error.code == NSURLErrorCancelled
    let isPolicyChange = error.domain == "WebKitErrorDomain" && error.code == 102
    if isCancellation || isPolicyChange { return }
    loadFailed = true
    owner?.onLoadError(error.localizedDescription)
  }
}
