/** Stripe Payment Link. Leave empty until the link exists. Override with SIDELINE_SUPPORT_URL for a capture. */
export const SUPPORT_URL = ''

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

/** Env override wins when it is an allowed Payment Link. Otherwise the committed constant, which is empty. */
export const resolveSupportUrl = (override?: string | null): string | null => {
  const raw = (override?.trim() || SUPPORT_URL).trim()
  return isAllowedSupportUrl(raw) ? raw : null
}
