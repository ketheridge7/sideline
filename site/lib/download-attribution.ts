/** Dispatched after the /download pageview is handed to Web Analytics. */
export const DOWNLOAD_PAGEVIEW_EVENT = "sideline-download-pageview";

/**
 * Hobby Web Analytics lists Pages by path and drops query strings.
 * The UTM breakdown needs the paid Web Analytics Plus add-on, so each
 * marketing visit is also reported as `/download/<source>/<medium>/<campaign>`.
 * The original query string stays on the event for that add-on.
 */
export function attributedDownloadUrl(eventUrl: string): string {
  let url: URL;
  try {
    url = new URL(eventUrl);
  } catch {
    return eventUrl;
  }
  if (downloadPathname(url) !== "/download") return eventUrl;

  const source = campaignSegment(url.searchParams.get("utm_source"));
  const medium = campaignSegment(url.searchParams.get("utm_medium"));
  const campaign = campaignSegment(url.searchParams.get("utm_campaign"));
  if (!source && !medium && !campaign) return eventUrl;

  url.pathname = `/download/${source ?? "_"}/${medium ?? "_"}/${campaign ?? "_"}`;
  return url.toString();
}

export function isBareDownloadPage(eventUrl: string): boolean {
  try {
    return downloadPathname(new URL(eventUrl)) === "/download";
  } catch {
    return false;
  }
}

function downloadPathname(url: URL): string {
  return url.pathname.replace(/\/+$/, "") || "/";
}

function campaignSegment(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (!/^[a-z0-9][a-z0-9._-]{0,47}$/.test(cleaned)) return null;
  return cleaned;
}
