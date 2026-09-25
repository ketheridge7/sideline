import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { WORDMARK_ASPECT } from "@/lib/brand";
import { SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/constants";

export const alt = SITE_TAGLINE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const wordmark = await readFile(join(process.cwd(), "public/wordmark.png"));
  const wordmarkSrc = `data:image/png;base64,${wordmark.toString("base64")}`;
  const wordmarkHeight = 56;
  const wordmarkWidth = Math.round(wordmarkHeight * WORDMARK_ASPECT);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#07080A",
          color: "#F4F6F8",
          padding: "64px 72px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <img src={wordmarkSrc} width={wordmarkWidth} height={wordmarkHeight} alt="" />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 64,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: -1.5,
            }}
          >
            <div style={{ display: "flex" }}>Your fantasy matchup.</div>
            <div style={{ display: "flex" }}>Always on the Sideline</div>
          </div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 24, color: "#94A3B8", maxWidth: 760 }}>
            {SITE_DESCRIPTION}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 18, color: "#A6E6A0" }}>
          <div style={{ display: "flex", marginRight: 28 }}>Personal companion</div>
          <div style={{ display: "flex", marginRight: 28 }}>No betting</div>
          <div style={{ display: "flex" }}>Sleeper + ESPN</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
