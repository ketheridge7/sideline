import { describe, expect, it } from 'vitest'
import { SUPPORT_URL, isAllowedSupportUrl, resolveSupportUrl } from './support'

const LIVE_SUPPORT_URL = 'https://donate.stripe.com/3cI7sL9Ap7mI9KtbXufw401'

describe('support URL', () => {
  it('ships the live donate link', () => {
    expect(SUPPORT_URL).toBe(LIVE_SUPPORT_URL)
    expect(resolveSupportUrl()).toBe(LIVE_SUPPORT_URL)
    expect(resolveSupportUrl('')).toBe(LIVE_SUPPORT_URL)
    expect(resolveSupportUrl('   ')).toBe(LIVE_SUPPORT_URL)
    expect(isAllowedSupportUrl(SUPPORT_URL)).toBe(true)
  })

  it('stays hidden when the link is empty', () => {
    expect(isAllowedSupportUrl('')).toBe(false)
    expect(isAllowedSupportUrl('   ')).toBe(false)
  })

  it('accepts Stripe Payment Link hosts and rejects everything else', () => {
    expect(isAllowedSupportUrl('https://buy.stripe.com/test_example')).toBe(true)
    expect(isAllowedSupportUrl('https://donate.stripe.com/example')).toBe(true)
    expect(isAllowedSupportUrl(LIVE_SUPPORT_URL)).toBe(true)
    expect(isAllowedSupportUrl('https://buy.stripe.com/')).toBe(false)
    expect(isAllowedSupportUrl('https://buy.stripe.com')).toBe(false)
    expect(isAllowedSupportUrl('https://donate.stripe.com/')).toBe(false)
    expect(isAllowedSupportUrl('https://donate.stripe.com')).toBe(false)
    expect(isAllowedSupportUrl('http://buy.stripe.com/test_example')).toBe(false)
    expect(isAllowedSupportUrl('http://donate.stripe.com/3cI7sL9Ap7mI9KtbXufw401')).toBe(false)
    expect(isAllowedSupportUrl('https://example.com/test_example')).toBe(false)
    expect(isAllowedSupportUrl('https://buy.stripe.com.evil.test/test_example')).toBe(false)
    expect(isAllowedSupportUrl('https://donate.stripe.com.evil.test/3cI7sL9Ap7mI9KtbXufw401')).toBe(false)
    expect(isAllowedSupportUrl('not a url')).toBe(false)
  })

  it('uses an allowed override and ignores a bad one', () => {
    expect(resolveSupportUrl('https://buy.stripe.com/test_example')).toBe('https://buy.stripe.com/test_example')
    expect(resolveSupportUrl('https://donate.stripe.com/abc')).toBe('https://donate.stripe.com/abc')
    expect(resolveSupportUrl(LIVE_SUPPORT_URL)).toBe(LIVE_SUPPORT_URL)
    expect(resolveSupportUrl('https://example.com/pay')).toBeNull()
  })
})
