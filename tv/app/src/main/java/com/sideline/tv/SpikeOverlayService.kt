package com.sideline.tv

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.view.View
import android.view.WindowManager

class SpikeOverlayService : Service() {
  private var windowManager: WindowManager? = null
  private var view: View? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    startOverlayForeground(1, getString(R.string.spike_running))
    val prefs = OverlayPrefs(this)
    val size = prefs.size
    val lp = OverlayWindows.params(size.width, size.height, prefs.corner, 1f)
    val box = View(this)
    box.setBackgroundResource(R.color.spike)
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    windowManager?.addView(box, lp)
    view = box
  }

  override fun onDestroy() {
    view?.let { windowManager?.removeView(it) }
    view = null
    super.onDestroy()
  }
}
