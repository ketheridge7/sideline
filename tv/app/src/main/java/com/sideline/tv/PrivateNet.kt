package com.sideline.tv

object PrivateNet {
  fun isPrivateIpv4(host: String): Boolean {
    val parts = host.trim().split('.')
    if (parts.size != 4) return false
    val nums = parts.map { it.toIntOrNull() ?: return false }
    if (nums.any { it !in 0..255 }) return false
    val a = nums[0]
    val b = nums[1]
    return a == 10 || a == 127 || (a == 192 && b == 168) || (a == 172 && b in 16..31)
  }
}
