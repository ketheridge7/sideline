package com.sideline.tv

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.Spinner
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class SetupActivity : AppCompatActivity() {
  private lateinit var prefs: OverlayPrefs
  private var spikeOn = false
  private var hudOn = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_setup)
    prefs = OverlayPrefs(this)

    val host = findViewById<EditText>(R.id.host)
    val port = findViewById<EditText>(R.id.port)
    val token = findViewById<EditText>(R.id.token)
    val corner = findViewById<Spinner>(R.id.corner)
    val size = findViewById<Spinner>(R.id.size)
    val opacity = findViewById<Spinner>(R.id.opacity)
    val status = findViewById<TextView>(R.id.status)
    val permission = findViewById<Button>(R.id.permission)
    val test = findViewById<Button>(R.id.test)
    val hud = findViewById<Button>(R.id.hud)

    host.setText(prefs.host)
    port.setText(prefs.port.toString())
    token.setText(prefs.token)

    corner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, OverlayCorner.entries.map { it.name.replace('_', ' ') })
    size.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, OverlaySize.entries.map { it.name })
    opacity.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, OverlayOpacity.entries.map { it.name })
    corner.setSelection(prefs.corner.ordinal)
    size.setSelection(prefs.size.ordinal)
    opacity.setSelection(prefs.opacity.ordinal)

    permission.setOnClickListener { requestOverlayPermission(status) }
    test.setOnClickListener {
      persist(host, port, token, corner, size, opacity)
      if (!Settings.canDrawOverlays(this)) {
        status.setText(R.string.need_permission)
        return@setOnClickListener
      }
      if (hudOn) {
        stopService(Intent(this, OverlayService::class.java))
        hudOn = false
        hud.setText(R.string.start_hud)
      }
      if (spikeOn) {
        stopService(Intent(this, SpikeOverlayService::class.java))
        spikeOn = false
        test.setText(R.string.test_overlay)
      } else {
        ContextCompat.startForegroundService(this, Intent(this, SpikeOverlayService::class.java))
        spikeOn = true
        test.setText(R.string.hide_test)
        status.text = getString(R.string.spike_running)
      }
    }
    hud.setOnClickListener {
      persist(host, port, token, corner, size, opacity)
      if (!Settings.canDrawOverlays(this)) {
        status.setText(R.string.need_permission)
        return@setOnClickListener
      }
      if (!PrivateNet.isPrivateIpv4(prefs.host)) {
        status.setText(R.string.bad_host)
        return@setOnClickListener
      }
      if (spikeOn) {
        stopService(Intent(this, SpikeOverlayService::class.java))
        spikeOn = false
        test.setText(R.string.test_overlay)
      }
      if (hudOn) {
        stopService(Intent(this, OverlayService::class.java))
        hudOn = false
        hud.setText(R.string.start_hud)
      } else {
        ContextCompat.startForegroundService(this, Intent(this, OverlayService::class.java))
        hudOn = true
        hud.setText(R.string.stop_hud)
        status.text = getString(R.string.hud_running)
      }
    }
  }

  private fun persist(
    host: EditText,
    port: EditText,
    token: EditText,
    corner: Spinner,
    size: Spinner,
    opacity: Spinner
  ) {
    prefs.host = host.text.toString()
    prefs.port = port.text.toString().toIntOrNull()?.coerceIn(1, 65535) ?: 7333
    prefs.token = token.text.toString()
    prefs.corner = OverlayCorner.entries.getOrElse(corner.selectedItemPosition) { OverlayCorner.TOP_RIGHT }
    prefs.size = OverlaySize.entries.getOrElse(size.selectedItemPosition) { OverlaySize.DEFAULT }
    prefs.opacity = OverlayOpacity.entries.getOrElse(opacity.selectedItemPosition) { OverlayOpacity.NORMAL }
  }

  private fun requestOverlayPermission(status: TextView) {
    if (Settings.canDrawOverlays(this)) {
      status.setText(R.string.permission_on)
      return
    }
    try {
      startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
    } catch (_: ActivityNotFoundException) {
      status.setText(R.string.permission_manual)
    }
  }
}
