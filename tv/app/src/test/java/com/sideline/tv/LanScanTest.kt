package com.sideline.tv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LanScanTest {
  @Test
  fun normalizeCodeAcceptsSpacedDigits() {
    assertEquals("418302", LanScan.normalizeCode("418302"))
    assertEquals("418302", LanScan.normalizeCode("418 302"))
    assertNull(LanScan.normalizeCode("12345"))
    assertNull(LanScan.normalizeCode("abcdef"))
  }

  @Test
  fun subnetHostsWalksTheSlash24() {
    val hosts = LanScan.subnetHosts("192.168.1.20")
    assertEquals(254, hosts.size)
    assertEquals("192.168.1.1", hosts.first())
    assertEquals("192.168.1.254", hosts.last())
    assertTrue(hosts.contains("192.168.1.20"))
  }

  @Test
  fun probeTargetsPrefersSavedHostAndDefaultPort() {
    val targets = LanScan.probeTargets(listOf("192.168.1.40"), "192.168.1.20", 7333)
    assertEquals("192.168.1.20" to 7333, targets.first())
    assertTrue(targets.contains("192.168.1.40" to 7333))
    assertFalse(targets.any { it.second != 7333 })
  }

  @Test
  fun parsePairResponseReadsTokenAndPort() {
    val parsed = LanScan.parsePairResponse("""{"token":"deadbeefcafebabe","port":7334}""", 7333)
    assertEquals(7334, parsed?.port)
    assertEquals("deadbeefcafebabe", parsed?.token)
    assertNull(LanScan.parsePairResponse("""{"ok":false}""", 7333))
  }
}

class PrivateNetTest {
  @Test
  fun acceptsRfc1918AndLoopback() {
    assertTrue(PrivateNet.isPrivateIpv4("192.168.1.20"))
    assertTrue(PrivateNet.isPrivateIpv4("10.0.0.5"))
    assertTrue(PrivateNet.isPrivateIpv4("172.16.4.2"))
    assertTrue(PrivateNet.isPrivateIpv4("127.0.0.1"))
    assertFalse(PrivateNet.isPrivateIpv4("8.8.8.8"))
    assertFalse(PrivateNet.isPrivateIpv4("example.local"))
  }
}
