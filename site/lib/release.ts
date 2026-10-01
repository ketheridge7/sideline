import { INSTALLER_NAME, RELEASE_API_URL } from "@/lib/constants";

export type ReleaseInfo = {
  version: string;
  installerBytes: number | null;
  /** Lowercase hex SHA-256 of Sideline-Setup.exe, or null when the release has no digest. */
  installerSha256: string | null;
};

export function formatInstallerSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (!Number.isFinite(mb) || mb < 1) return "the installer";
  return `about ${Math.round(mb)} MB`;
}

type ReleaseAsset = { name?: string; size?: number; digest?: unknown };
type ReleasePayload = { tag_name?: string; assets?: ReleaseAsset[] };

const SHA256_DIGEST = /^sha256:([a-f0-9]{64})$/i;

/** GitHub release assets expose `digest` as `sha256:<hex>`. Anything else is ignored. */
export function parseSha256Digest(digest: unknown): string | null {
  if (typeof digest !== "string") return null;
  const match = SHA256_DIGEST.exec(digest.trim());
  return match ? match[1].toLowerCase() : null;
}

export function releaseInfoFromPayload(body: ReleasePayload): ReleaseInfo | null {
  const version = body.tag_name?.replace(/^v/, "").trim() ?? "";
  if (!version) return null;
  const exe = body.assets?.find((asset) => asset.name === INSTALLER_NAME);
  const installerBytes = typeof exe?.size === "number" ? exe.size : null;
  const installerSha256 = parseSha256Digest(exe?.digest);
  return { version, installerBytes, installerSha256 };
}

/** Latest GitHub release. Null when the API is unreachable so the page still builds. */
export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const response = await fetch(RELEASE_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "sideline-site",
      },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as ReleasePayload;
    return releaseInfoFromPayload(body);
  } catch {
    return null;
  }
}
