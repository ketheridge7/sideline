export const INSTALLER_NAME = "Sideline-Setup.exe";
export const DOWNLOAD_URL = `https://github.com/ketheridge7/sideline/releases/latest/download/${INSTALLER_NAME}`;
export const RELEASES_URL = "https://github.com/ketheridge7/sideline/releases";
export const REPO_URL = "https://github.com/ketheridge7/sideline";
export const ISSUES_URL = "https://github.com/ketheridge7/sideline/issues";
export const RELEASE_API_URL = "https://api.github.com/repos/ketheridge7/sideline/releases/latest";
/**
 * Stripe Payment Link for Support Sideline (footer, and the line under the download button).
 * A non-empty NEXT_PUBLIC_SUPPORT_URL overrides the live link.
 * supportHref hides every Support control when the value is empty or not an https Stripe Payment Link.
 */
const LIVE_SUPPORT_URL = "https://donate.stripe.com/3cI7sL9Ap7mI9KtbXufw401";

export const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL?.trim() || LIVE_SUPPORT_URL;
export const SITE_NAME = "Sideline";
export const SITE_TAGLINE = "Your fantasy matchup. Always on the Sideline";
export const SITE_DESCRIPTION =
  "A Windows companion for live Sleeper and ESPN fantasy matchups. Second screen, or a HUD on the game you're already watching. No betting.";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sideline-three.vercel.app";

export const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/#download", label: "Download" },
] as const;

const SUPPORT_HOSTS = new Set(["buy.stripe.com", "donate.stripe.com"]);

/** Hosted Stripe Payment Link, or null when unset or not on an allowed host. */
export function supportHref(raw: string = SUPPORT_URL): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const path = url.pathname.replace(/\/+$/, "");
    if (url.protocol !== "https:") return null;
    if (!SUPPORT_HOSTS.has(url.hostname)) return null;
    if (path.length <= 1) return null;
    return url.toString();
  } catch {
    return null;
  }
}
