package com.margelo.nitro.usedom

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.annotation.Keep
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import org.json.JSONObject

/**
 * The WebView a DOM component renders into.
 *
 * It loads exactly one page and keeps it there: navigating the main frame anywhere outside the
 * page's own origin is refused and reported, and so is opening a window. The page talks to the app
 * through `window.ReactNativeWebView`, which is in place before the page's first script runs.
 */
@DoNotStrip
@Keep
class HybridRNUseDomWebView(val context: ThemedReactContext) : HybridRNUseDomWebViewSpec() {
  private val webView = DomWebView(context)
  private val mainHandler = Handler(Looper.getMainLooper())
  private val assetLoader = WebViewAssetLoader.Builder()
    .setDomain(OFFLINE_HOST)
    .addPathHandler("/$OFFLINE_BUNDLE_DIR/", WebViewAssetLoader.AssetsPathHandler(context).let { assets ->
      WebViewAssetLoader.PathHandler { path -> assets.handle("$OFFLINE_BUNDLE_DIR/$path") }
    })
    .build()

  private var needsLoad = false
  private var needsBridge = true
  private var bridgeOrigin: String? = null
  private var bridgeScript: ScriptHandler? = null
  private var loadFailed = false
  private var dropped = false

  /** Read by the fallback bridge from the WebView's own thread. */
  @Volatile private var currentInjectedObjectJson = "{}"

  init {
    webView.webViewClient = Client()
    webView.webChromeClient = WebChromeClient()
  }

  override val view: View get() = webView

  // Props

  override var source: String = ""
    set(value) {
      if (field != value) needsLoad = true
      field = value
    }

  override var injectedObjectJson: String = "{}"
    set(value) {
      if (field != value) needsBridge = true
      field = value
      currentInjectedObjectJson = value
    }

  override var scrollEnabled: Boolean = true
    set(value) {
      field = value
      webView.scrollEnabled = value
    }

  override var inspectable: Boolean = false
    set(value) {
      field = value
      // Debugging is a process-wide switch: turning it off here would turn it off for every WebView
      // in the app, so it is only ever turned on.
      if (value) WebView.setWebContentsDebuggingEnabled(true)
    }

  override var onMessage: (message: String) -> Unit = {}
  override var onLoadEnd: () -> Unit = {}
  override var onLoadError: (reason: String) -> Unit = {}
  override var onNavigationBlocked: (url: String) -> Unit = {}

  override fun afterUpdate() {
    onMain {
      // The page reads the bridge while it loads, so the bridge goes in before the load that uses it.
      val origin = originOf(source)
      if (needsBridge || origin != bridgeOrigin) installBridge(origin)
      if (needsLoad) load()
    }
  }

  override fun onDropView() {
    onMain {
      dropped = true
      webView.stopLoading()
      webView.destroy()
    }
  }

  // Methods

  override fun dispatchMessage(eventName: String, payload: String) {
    val script = "window.dispatchEvent(new CustomEvent(${JSONObject.quote(eventName)}, { detail: ${JSONObject.quote(payload)} }));"
    onMain { webView.evaluateJavascript(script, null) }
  }

  override fun reload() {
    onMain { webView.reload() }
  }

  // Page

  private fun load() {
    needsLoad = false
    webView.loadUrl(source)
  }

  /**
   * Where the WebView supports it, the bridge only exists for the page's own origin, in the main
   * frame. Older WebViews get it through a JavaScript interface, which every frame can see.
   */
  @SuppressLint("JavascriptInterface", "AddJavascriptInterface")
  private fun installBridge(origin: String?) {
    needsBridge = false
    if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) ||
      !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
    ) {
      if (bridgeOrigin == null) webView.addJavascriptInterface(FallbackBridge(), BRIDGE_GLOBAL)
      bridgeOrigin = origin ?: ""
      return
    }
    if (origin == null) return

    bridgeScript?.remove()
    if (bridgeOrigin != null) WebViewCompat.removeWebMessageListener(webView, LISTENER_GLOBAL)
    val rules = setOf(origin)
    WebViewCompat.addWebMessageListener(webView, LISTENER_GLOBAL, rules) { _, message, sourceOrigin, isMainFrame, _ ->
      val data = message.data
      if (isMainFrame && data != null && sourceOrigin.toString() == bridgeOrigin) onMessage(data)
    }
    bridgeScript = WebViewCompat.addDocumentStartJavaScript(webView, bridgeScript(injectedObjectJson), rules)
    bridgeOrigin = origin
  }

  private fun bridgeScript(injected: String): String = """
    (function () {
      var listener = window.$LISTENER_GLOBAL;
      var injected = ${JSONObject.quote(injected)};
      if (window.top !== window) return;
      Object.defineProperty(window, '$BRIDGE_GLOBAL', {
        value: Object.freeze({
          postMessage: function (message) { listener.postMessage(String(message)); },
          injectedObjectJson: function () { return injected; },
        }),
      });
    })();
  """.trimIndent()

  private inner class FallbackBridge {
    @JavascriptInterface
    fun postMessage(message: String) {
      onMessage(message)
    }

    @JavascriptInterface
    fun injectedObjectJson(): String = currentInjectedObjectJson
  }

  /** Props arrive on the UI thread from React, but methods can be called from the JS thread. */
  private fun onMain(body: () -> Unit) {
    // A destroyed WebView must not be used again, and calls can still arrive from JS after it is.
    val guarded = { if (!dropped) body() }
    if (Looper.myLooper() == Looper.getMainLooper()) guarded() else mainHandler.post(guarded)
  }

  private inner class Client : WebViewClient() {
    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
      // A frame other than the page itself, such as an embedded video, may go where it likes.
      if (!request.isForMainFrame) return false
      if (originOf(request.url.toString()) == originOf(source)) return false
      onNavigationBlocked(request.url.toString())
      return true
    }

    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
      assetLoader.shouldInterceptRequest(request.url)

    override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
      loadFailed = false
    }

    override fun onPageFinished(view: WebView, url: String?) {
      if (!loadFailed) onLoadEnd()
    }

    override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
      if (!request.isForMainFrame) return
      loadFailed = true
      onLoadError("${error.description} (${request.url})")
    }

    override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
      // The page is still shown, since a development server explains its errors in the page.
      if (!request.isForMainFrame) return
      loadFailed = true
      onLoadError("Loading ${request.url} failed with HTTP ${response.statusCode}.")
    }

    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
      // The WebView cannot be used again once its renderer is gone. Reporting it, rather than
      // letting the app crash, is what returning true asks for.
      onLoadError(if (detail.didCrash()) "The page's renderer crashed." else "The system stopped the page's renderer.")
      return true
    }
  }

  private companion object {
    const val OFFLINE_HOST = "use-dom.localhost"
    const val OFFLINE_BUNDLE_DIR = "dom.bundle"
    const val BRIDGE_GLOBAL = "ReactNativeWebView"
    const val LISTENER_GLOBAL = "__reactNativeUseDom"

    /** The origin of a URL as web message rules spell it: `scheme://host[:port]`. */
    fun originOf(url: String): String? {
      val uri = Uri.parse(url)
      val scheme = uri.scheme ?: return null
      val host = uri.host ?: return null
      return if (uri.port == -1) "$scheme://$host" else "$scheme://$host:${uri.port}"
    }
  }
}

/** A WebView that shares drags with the native scroll view around it. */
@SuppressLint("SetJavaScriptEnabled", "ViewConstructor")
private class DomWebView(context: Context) : WebView(context) {
  var scrollEnabled = true
    set(value) {
      field = value
      isVerticalScrollBarEnabled = value
      isHorizontalScrollBarEnabled = value
    }

  init {
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = true
    settings.allowFileAccess = false
    settings.allowContentAccess = false
    // Without multiple windows, `window.open` and `target="_blank"` navigate this WebView instead,
    // which is where navigation away from the page is refused and reported.
    settings.setSupportMultipleWindows(false)
    settings.mediaPlaybackRequiresUserGesture = false
    // The background of the view around it shows until the page paints, and wherever the page is
    // transparent.
    setBackgroundColor(0)
  }

  @SuppressLint("ClickableViewAccessibility")
  override fun onTouchEvent(event: MotionEvent): Boolean {
    // While the page can still scroll, it keeps the drag instead of the scroll view around it.
    if (scrollEnabled && event.actionMasked == MotionEvent.ACTION_MOVE) {
      val canScroll = canScrollVertically(1) || canScrollVertically(-1) ||
        canScrollHorizontally(1) || canScrollHorizontally(-1)
      parent?.requestDisallowInterceptTouchEvent(canScroll)
    }
    return super.onTouchEvent(event)
  }

  override fun onScrollChanged(l: Int, t: Int, oldl: Int, oldt: Int) {
    super.onScrollChanged(l, t, oldl, oldt)
    if (!scrollEnabled) scrollTo(0, 0)
  }
}
