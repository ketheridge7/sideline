/** Live Stripe donate link. SIDELINE_SUPPORT_URL overrides this when that value is an allowed Payment Link. */
export const SUPPORT_URL = 'https://donate.stripe.com/3cI7sL9Ap7mI9KtbXufw401'

const SUPPORT_HOSTS = new Set(['buy.stripe.com', 'donate.stripe.com'])

/** A hosted Stripe Payment Link. Rejects the bare host, other origins, and non-https URLs. */
export const isAllowedSupportUrl = (url: unknown): url is string => {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2000) return false
  try {
    const parsed = new URL(url)
    const path = parsed.pathname.replace(/\/+$/, '')
    return parsed.protocol === 'https:' && SUPPORT_HOSTS.has(parsed.hostname) && path.length > 1
  } catch {
    return false
  }
}

/** Env override wins when it is an allowed Payment Link. An empty override keeps the committed link. A disallowed override hides the control. */
export const resolveSupportUrl = (override?: string | null): string | null => {
  const raw = (override?.trim() || SUPPORT_URL).trim()
  return isAllowedSupportUrl(raw) ? raw : null
}
