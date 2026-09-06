import { randomInt, timingSafeEqual } from 'crypto'

export const PAIRING_CODE_LENGTH = 6
export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000
export const PAIRING_MAX_FAILURES = 20
export const PAIRING_FAILURE_WINDOW_MS = 60_000

export const generatePairingCode = (): string =>
  randomInt(0, 1_000_000).toString().padStart(PAIRING_CODE_LENGTH, '0')

export const normalizePairingCode = (raw: string | null | undefined): string | null => {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== PAIRING_CODE_LENGTH) return null
  return digits
}

const codesEqual = (left: string, right: string): boolean => {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export type PairingResolveOk = { ok: true; token: string }
export type PairingFailReason = 'invalid' | 'mismatch' | 'expired' | 'inactive' | 'rate_limit'
export type PairingResolveFail = { ok: false; reason: PairingFailReason }
export type PairingResolveResult = PairingResolveOk | PairingResolveFail

/** Maps a 6-digit LAN pairing code onto the overlay session token. */
export class OverlayPairing {
  private token: string | null = null
  private code: string | null = null
  private expiresAt = 0
  private failCount = 0
  private failWindowStart = 0

  constructor(
    private readonly now: () => number = Date.now,
    private readonly randomCode: () => string = generatePairingCode
  ) {}

  issue(token: string): string {
    this.token = token
    this.failCount = 0
    this.failWindowStart = 0
    return this.rotateCode()
  }

  clear(): void {
    this.token = null
    this.code = null
    this.expiresAt = 0
    this.failCount = 0
    this.failWindowStart = 0
  }

  /** Live code for the Connect UI. Rotates in place when the TTL elapses. */
  currentCode(): string | null {
    if (!this.token || !this.code) return null
    if (this.now() >= this.expiresAt) this.rotateCode()
    return this.code
  }

  resolve(rawCode: string): PairingResolveResult {
    if (!this.token || !this.code) return { ok: false, reason: 'inactive' }
    if (this.rateLimited()) return { ok: false, reason: 'rate_limit' }

    const normalized = normalizePairingCode(rawCode)
    if (!normalized) {
      this.noteFailure()
      return { ok: false, reason: 'invalid' }
    }

    if (this.now() >= this.expiresAt) {
      this.noteFailure()
      return { ok: false, reason: 'expired' }
    }

    if (!codesEqual(normalized, this.code)) {
      this.noteFailure()
      return { ok: false, reason: 'mismatch' }
    }

    this.failCount = 0
    return { ok: true, token: this.token }
  }

  private rotateCode(): string {
    if (!this.token) return ''
    let next = this.randomCode()
    let guard = 0
    while (next === this.code && guard < 8) {
      next = this.randomCode()
      guard += 1
    }
    this.code = next
    this.expiresAt = this.now() + PAIRING_CODE_TTL_MS
    return next
  }

  private rateLimited(): boolean {
    if (this.now() - this.failWindowStart > PAIRING_FAILURE_WINDOW_MS) return false
    return this.failCount >= PAIRING_MAX_FAILURES
  }

  private noteFailure(): void {
    const now = this.now()
    if (now - this.failWindowStart > PAIRING_FAILURE_WINDOW_MS) {
      this.failWindowStart = now
      this.failCount = 1
      return
    }
    this.failCount += 1
  }
}

export const pairingHttpStatus = (reason: PairingFailReason): number => {
  switch (reason) {
    case 'rate_limit':
      return 429
    case 'invalid':
    case 'mismatch':
    case 'expired':
    case 'inactive':
      return 404
    default: {
      const _never: never = reason
      return _never
    }
  }
}
