package com.sideline.tv

import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.IBinder
import android.view.View
import android.view.WindowManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

class OverlayService : Service() {
  private var windowManager: WindowManager? = null
  private var webView: WebView? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    startOverlayForeground(2, getString(R.string.hud_running))
    val prefs = OverlayPrefs(this)
    if (!PrivateNet.isPrivateIpv4(prefs.host)) {
      stopSelf()
      return
    }
    val size = prefs.size
    val lp = OverlayWindows.params(size.width, size.height, prefs.corner, prefs.opacity.value)
    val view = WebView(this)
    view.setBackgroundColor(Color.TRANSPARENT)
    view.background = null
    view.isVerticalScrollBarEnabled = false
    view.isHorizontalScrollBarEnabled = false
    view.overScrollMode = View.OVER_SCROLL_NEVER
    view.settings.javaScriptEnabled = true
    view.settings.domStorageEnabled = true
    view.settings.allowFileAccess = false
    view.settings.allowContentAccess = false
    view.settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
    view.webViewClient = WebViewClient()
    val url =
      "http://${prefs.host}:${prefs.port}/overlay?tv=1&k=${Uri.encode(prefs.token)}"
    view.loadUrl(url)
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    windowManager?.addView(view, lp)
    webView = view
  }

  override fun onDestroy() {
    webView?.let {
      windowManager?.removeView(it)
      it.destroy()
    }
    webView = null
    super.onDestroy()
  }
}
