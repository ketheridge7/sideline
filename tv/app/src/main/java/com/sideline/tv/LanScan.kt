package com.sideline.tv

/** Pure LAN probe helpers for 6-digit pairing. TODO: replace the /24 scan with `_sideline._tcp`. */
object LanScan {
  const val DEFAULT_PORT = 7333

  data class PairResponse(val port: Int, val token: String)

  fun normalizeCode(raw: String): String? {
    val digits = raw.filter { it.isDigit() }
    return digits.takeIf { it.length == 6 }
  }

  fun parsePairResponse(body: String, fallbackPort: Int): PairResponse? {
    val token = Regex(""""token"\s*:\s*"([^"]+)"""").find(body)?.groupValues?.get(1)?.trim().orEmpty()
    if (token.isEmpty()) return null
    val port = Regex(""""port"\s*:\s*(\d+)""").find(body)?.groupValues?.get(1)?.toIntOrNull() ?: fallbackPort
    if (port !in 1..65535) return null
    return PairResponse(port, token)
  }

  fun subnetHosts(ip: String): List<String> {
    if (!PrivateNet.isPrivateIpv4(ip)) return emptyList()
    val parts = ip.trim().split('.')
    val prefix = "${parts[0]}.${parts[1]}.${parts[2]}"
    return (1..254).map { "$prefix.$it" }
  }

  fun probeTargets(
    localIps: List<String>,
    savedHost: String,
    savedPort: Int
  ): List<Pair<String, Int>> {
    val hosts = LinkedHashSet<String>()
    if (PrivateNet.isPrivateIpv4(savedHost)) hosts.add(savedHost.trim())
    for (ip in localIps) {
      if (PrivateNet.isPrivateIpv4(ip) && !ip.startsWith("127.")) {
        hosts.addAll(subnetHosts(ip))
      }
    }
    val ports = LinkedHashSet<Int>()
    if (savedPort in 1..65535) ports.add(savedPort)
    ports.add(DEFAULT_PORT)

    val out = ArrayList<Pair<String, Int>>(hosts.size * ports.size + 1)
    if (PrivateNet.isPrivateIpv4(savedHost)) {
      out.add(savedHost.trim() to savedPort.coerceIn(1, 65535))
    }
    for (port in ports) {
      for (host in hosts) {
        val pair = host to port
        if (pair !in out) out.add(pair)
      }
    }
    return out
  }
}
