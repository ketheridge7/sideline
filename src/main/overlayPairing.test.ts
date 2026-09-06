import { describe, expect, it } from 'vitest'
import {
  generatePairingCode,
  normalizePairingCode,
  OverlayPairing,
  PAIRING_CODE_TTL_MS,
  PAIRING_FAILURE_WINDOW_MS,
  PAIRING_MAX_FAILURES,
  pairingHttpStatus
} from './overlayPairing'

describe('generatePairingCode', () => {
  it('returns 6 digits, including leading zeros', () => {
    for (let i = 0; i < 40; i += 1) {
      expect(generatePairingCode()).toMatch(/^\d{6}$/)
    }
  })
})

describe('normalizePairingCode', () => {
  it('accepts spaced or dashed 6-digit input', () => {
    expect(normalizePairingCode('418302')).toBe('418302')
    expect(normalizePairingCode('418 302')).toBe('418302')
    expect(normalizePairingCode('418-302')).toBe('418302')
  })

  it('rejects missing, short, long, or non-digit codes', () => {
    expect(normalizePairingCode(null)).toBeNull()
    expect(normalizePairingCode('')).toBeNull()
    expect(normalizePairingCode('12345')).toBeNull()
    expect(normalizePairingCode('1234567')).toBeNull()
    expect(normalizePairingCode('abcdef')).toBeNull()
  })
})

describe('OverlayPairing', () => {
  it('maps a live code onto the session token', () => {
    const pairing = new OverlayPairing(
      () => 1_000,
      () => '418302'
    )
    expect(pairing.issue('deadbeefcafebabe')).toBe('418302')
    expect(pairing.currentCode()).toBe('418302')
    expect(pairing.resolve('418 302')).toEqual({ ok: true, token: 'deadbeefcafebabe' })
  })

  it('rejects a wrong or malformed code without leaking the token', () => {
    const pairing = new OverlayPairing(
      () => 1_000,
      () => '418302'
    )
    pairing.issue('deadbeefcafebabe')
    expect(pairing.resolve('000000')).toEqual({ ok: false, reason: 'mismatch' })
    expect(pairing.resolve('nope')).toEqual({ ok: false, reason: 'invalid' })
    expect(pairing.resolve('418302')).toEqual({ ok: true, token: 'deadbeefcafebabe' })
  })

  it('rejects an expired code and rotates to a new one for display', () => {
    let now = 1_000
    let nextCode = '111111'
    const pairing = new OverlayPairing(
      () => now,
      () => nextCode
    )
    pairing.issue('token-a')
    expect(pairing.resolve('111111')).toEqual({ ok: true, token: 'token-a' })

    now += PAIRING_CODE_TTL_MS
    expect(pairing.resolve('111111')).toEqual({ ok: false, reason: 'expired' })

    nextCode = '222222'
    expect(pairing.currentCode()).toBe('222222')
    expect(pairing.resolve('111111')).toEqual({ ok: false, reason: 'mismatch' })
    expect(pairing.resolve('222222')).toEqual({ ok: true, token: 'token-a' })
  })

  it('issues a new code for a new token and forgets the old mapping', () => {
    let nextCode = '111111'
    const pairing = new OverlayPairing(
      () => 1_000,
      () => nextCode
    )
    pairing.issue('token-a')
    nextCode = '222222'
    pairing.issue('token-b')
    expect(pairing.resolve('111111')).toEqual({ ok: false, reason: 'mismatch' })
    expect(pairing.resolve('222222')).toEqual({ ok: true, token: 'token-b' })
  })

  it('returns inactive after clear', () => {
    const pairing = new OverlayPairing(
      () => 1_000,
      () => '418302'
    )
    pairing.issue('deadbeefcafebabe')
    pairing.clear()
    expect(pairing.currentCode()).toBeNull()
    expect(pairing.resolve('418302')).toEqual({ ok: false, reason: 'inactive' })
  })

  it('rate-limits repeated bad guesses, then recovers after the window', () => {
    let now = 1_000
    const pairing = new OverlayPairing(
      () => now,
      () => '418302'
    )
    pairing.issue('deadbeefcafebabe')
    for (let i = 0; i < PAIRING_MAX_FAILURES; i += 1) {
      expect(pairing.resolve('000000').ok).toBe(false)
    }
    expect(pairing.resolve('000000')).toEqual({ ok: false, reason: 'rate_limit' })
    expect(pairing.resolve('418302')).toEqual({ ok: false, reason: 'rate_limit' })

    now += PAIRING_FAILURE_WINDOW_MS + 1
    expect(pairing.resolve('418302')).toEqual({ ok: true, token: 'deadbeefcafebabe' })
  })
})

describe('pairingHttpStatus', () => {
  it('maps fail reasons onto 404 or 429', () => {
    expect(pairingHttpStatus('rate_limit')).toBe(429)
    expect(pairingHttpStatus('invalid')).toBe(404)
    expect(pairingHttpStatus('mismatch')).toBe(404)
    expect(pairingHttpStatus('expired')).toBe(404)
    expect(pairingHttpStatus('inactive')).toBe(404)
  })
})
