package com.sideline.tv

import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.view.Gravity
import android.view.WindowManager

enum class OverlayCorner {
  TOP_LEFT,
  TOP_RIGHT,
  BOTTOM_LEFT,
  BOTTOM_RIGHT
}

enum class OverlaySize(val width: Int, val height: Int) {
  COMPACT(480, 320),
  DEFAULT(560, 420),
  LARGE(720, 540)
}

enum class OverlayOpacity(val value: Float) {
  DIM(0.7f),
  NORMAL(0.9f),
  SOLID(1.0f)
}

object OverlayWindows {
  private const val TITLE_SAFE_PX = 48

  fun params(
    width: Int,
    height: Int,
    corner: OverlayCorner,
    opacity: Float
  ): WindowManager.LayoutParams {
    val type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    val flags =
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
    val lp = WindowManager.LayoutParams(width, height, type, flags, PixelFormat.TRANSLUCENT)
    lp.gravity = gravity(corner)
    lp.x = TITLE_SAFE_PX
    lp.y = TITLE_SAFE_PX
    lp.alpha = opacity
    if (Build.VERSION.SDK_INT >= 28) {
      lp.layoutInDisplayCutoutMode =
        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
    }
    return lp
  }

  fun gravity(corner: OverlayCorner): Int =
    when (corner) {
      OverlayCorner.TOP_LEFT -> Gravity.TOP or Gravity.START
      OverlayCorner.TOP_RIGHT -> Gravity.TOP or Gravity.END
      OverlayCorner.BOTTOM_LEFT -> Gravity.BOTTOM or Gravity.START
      OverlayCorner.BOTTOM_RIGHT -> Gravity.BOTTOM or Gravity.END
    }
}

class OverlayPrefs(context: Context) {
  private val prefs = context.getSharedPreferences("sideline", Context.MODE_PRIVATE)

  var host: String
    get() = prefs.getString("host", "") ?: ""
    set(value) {
      prefs.edit().putString("host", value.trim()).apply()
    }

  var port: Int
    get() = prefs.getInt("port", 7333)
    set(value) {
      prefs.edit().putInt("port", value).apply()
    }

  var token: String
    get() = prefs.getString("token", "") ?: ""
    set(value) {
      prefs.edit().putString("token", value.trim()).apply()
    }

  var corner: OverlayCorner
    get() = OverlayCorner.entries.getOrElse(prefs.getInt("corner", 1)) { OverlayCorner.TOP_RIGHT }
    set(value) {
      prefs.edit().putInt("corner", value.ordinal).apply()
    }

  var size: OverlaySize
    get() = OverlaySize.entries.getOrElse(prefs.getInt("size", 1)) { OverlaySize.DEFAULT }
    set(value) {
      prefs.edit().putInt("size", value.ordinal).apply()
    }

  var opacity: OverlayOpacity
    get() = OverlayOpacity.entries.getOrElse(prefs.getInt("opacity", 1)) { OverlayOpacity.NORMAL }
    set(value) {
      prefs.edit().putInt("opacity", value.ordinal).apply()
    }
}
