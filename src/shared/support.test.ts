import { describe, expect, it } from 'vitest'
import { SUPPORT_URL, isAllowedSupportUrl, resolveSupportUrl } from './support'

describe('support URL', () => {
  it('ships with an empty link so the control stays hidden', () => {
    expect(SUPPORT_URL).toBe('')
    expect(resolveSupportUrl()).toBeNull()
    expect(resolveSupportUrl('')).toBeNull()
    expect(resolveSupportUrl('   ')).toBeNull()
  })

  it('accepts Stripe Payment Link hosts and rejects everything else', () => {
    expect(isAllowedSupportUrl('https://buy.stripe.com/test_example')).toBe(true)
    expect(isAllowedSupportUrl('https://donate.stripe.com/example')).toBe(true)
    expect(isAllowedSupportUrl('https://buy.stripe.com/')).toBe(false)
    expect(isAllowedSupportUrl('https://buy.stripe.com')).toBe(false)
    expect(isAllowedSupportUrl('http://buy.stripe.com/test_example')).toBe(false)
    expect(isAllowedSupportUrl('https://example.com/test_example')).toBe(false)
    expect(isAllowedSupportUrl('https://buy.stripe.com.evil.test/test_example')).toBe(false)
    expect(isAllowedSupportUrl('not a url')).toBe(false)
  })

  it('uses an allowed override and ignores a bad one', () => {
    expect(resolveSupportUrl('https://buy.stripe.com/test_example')).toBe('https://buy.stripe.com/test_example')
    expect(resolveSupportUrl('https://donate.stripe.com/abc')).toBe('https://donate.stripe.com/abc')
    expect(resolveSupportUrl('https://example.com/pay')).toBeNull()
  })
})
