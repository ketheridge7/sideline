package com.sideline.tv

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat

internal fun Service.startOverlayForeground(id: Int, text: String) {
  val channelId = "sideline-overlay"
  val mgr = getSystemService(NotificationManager::class.java)
  if (mgr.getNotificationChannel(channelId) == null) {
    mgr.createNotificationChannel(
      NotificationChannel(channelId, getString(R.string.channel_name), NotificationManager.IMPORTANCE_LOW)
    )
  }
  val notification: Notification =
    NotificationCompat.Builder(this, channelId)
      .setContentTitle(getString(R.string.app_name))
      .setContentText(text)
      .setSmallIcon(R.drawable.ic_launcher)
      .setOngoing(true)
      .build()
  if (Build.VERSION.SDK_INT >= 34) {
    startForeground(id, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
  } else {
    startForeground(id, notification)
  }
}
