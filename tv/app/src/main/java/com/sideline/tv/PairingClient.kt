package com.sideline.tv

import android.content.Context
import android.net.ConnectivityManager
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ExecutorCompletionService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

data class PairingTarget(val host: String, val port: Int, val token: String)

sealed class PairingFind {
  data class Found(val target: PairingTarget) : PairingFind()
  data object RateLimited : PairingFind()
  data object NotFound : PairingFind()
  data object BadCode : PairingFind()
}

object PairingClient {
  private const val CONNECT_MS = 400
  private const val READ_MS = 400
  private const val POOL = 24

  fun localPrivateIpv4s(context: Context): List<String> {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val out = LinkedHashSet<String>()
    for (network in cm.allNetworks) {
      val props = cm.getLinkProperties(network) ?: continue
      for (addr in props.linkAddresses) {
        val host = addr.address.hostAddress ?: continue
        val ip = host.substringBefore('%')
        if (PrivateNet.isPrivateIpv4(ip) && !ip.startsWith("127.")) out.add(ip)
      }
    }
    return out.toList()
  }

  fun findOverlay(
    context: Context,
    rawCode: String,
    savedHost: String,
    savedPort: Int
  ): PairingFind {
    val code = LanScan.normalizeCode(rawCode) ?: return PairingFind.BadCode
    val targets = LanScan.probeTargets(localPrivateIpv4s(context), savedHost, savedPort)
    if (targets.isEmpty()) return PairingFind.NotFound

    val pool = Executors.newFixedThreadPool(POOL)
    val cs = ExecutorCompletionService<ProbeHit>(pool)
    val cancel = AtomicBoolean(false)
    try {
      for (target in targets) {
        cs.submit {
          if (cancel.get()) ProbeHit.Skip else probe(target.first, target.second, code)
        }
      }
      var remaining = targets.size
      while (remaining > 0) {
        val hit = cs.take().get()
        remaining -= 1
        when (hit) {
          is ProbeHit.Ok -> {
            cancel.set(true)
            return PairingFind.Found(hit.target)
          }
          ProbeHit.RateLimited -> {
            cancel.set(true)
            return PairingFind.RateLimited
          }
          ProbeHit.Miss, ProbeHit.Skip -> Unit
        }
      }
      return PairingFind.NotFound
    } finally {
      cancel.set(true)
      pool.shutdownNow()
      pool.awaitTermination(500, TimeUnit.MILLISECONDS)
    }
  }

  private sealed class ProbeHit {
    data class Ok(val target: PairingTarget) : ProbeHit()
    data object RateLimited : ProbeHit()
    data object Miss : ProbeHit()
    data object Skip : ProbeHit()
  }

  private fun probe(host: String, port: Int, code: String): ProbeHit {
    if (!PrivateNet.isPrivateIpv4(host)) return ProbeHit.Miss
    val conn = URL("http://$host:$port/pair?code=$code").openConnection() as HttpURLConnection
    conn.connectTimeout = CONNECT_MS
    conn.readTimeout = READ_MS
    conn.instanceFollowRedirects = false
    conn.requestMethod = "GET"
    conn.useCaches = false
    try {
      val status = conn.responseCode
      if (status == 429) return ProbeHit.RateLimited
      if (status != 200) return ProbeHit.Miss
      val body = conn.inputStream.bufferedReader().use { it.readText() }
      val parsed = LanScan.parsePairResponse(body, port) ?: return ProbeHit.Miss
      return ProbeHit.Ok(PairingTarget(host, parsed.port, parsed.token))
    } catch (_: Exception) {
      return ProbeHit.Miss
    } finally {
      conn.disconnect()
    }
  }
}
