import { RELEASE_API_URL } from "@/lib/constants";

export type ReleaseInfo = {
  version: string;
  installerBytes: number | null;
};

export function formatInstallerSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (!Number.isFinite(mb) || mb < 1) return "the installer";
  return `about ${Math.round(mb)} MB`;
}

type ReleaseAsset = { name?: string; size?: number };
type ReleasePayload = { tag_name?: string; assets?: ReleaseAsset[] };

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
    const version = body.tag_name?.replace(/^v/, "").trim() ?? "";
    if (!version) return null;
    const exe = body.assets?.find((asset) => asset.name === "Sideline-Setup.exe");
    const installerBytes = typeof exe?.size === "number" ? exe.size : null;
    return { version, installerBytes };
  } catch {
    return null;
  }
}
