import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/constants";

export const alt = SITE_TAGLINE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const icon = await readFile(join(process.cwd(), "public/icon.png"));
  const iconSrc = `data:image/png;base64,${icon.toString("base64")}`;

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
          <img
            src={iconSrc}
            width={56}
            height={56}
            alt=""
            style={{ borderRadius: 12, marginRight: 16 }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: 6,
                textTransform: "uppercase",
              }}
            >
              Sideline
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 6,
                height: 3,
                width: 148,
                background: "#B6FF3B",
              }}
            />
          </div>
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
            <div style={{ display: "flex" }}>Your fantasy tape.</div>
            <div style={{ display: "flex" }}>Always on the sideline.</div>
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
