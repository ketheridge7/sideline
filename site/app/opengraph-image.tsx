import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION } from "@/lib/constants";

export const alt = "Sideline — live Sleeper and ESPN matchups on a second screen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const [barlow, condensed, hud] = await Promise.all([
    readFile(join(process.cwd(), "app/fonts/Barlow-SemiBold.ttf")),
    readFile(join(process.cwd(), "app/fonts/BarlowCondensed-Bold.ttf")),
    readFile(join(process.cwd(), "public/images/frost-hud.jpg")),
  ]);
  const hudSrc = `data:image/jpeg;base64,${hud.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#07080A",
          color: "#F4F6F8",
          fontFamily: "Barlow",
        }}
      >
        <div
          style={{
            width: 560,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 48px 48px 56px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontFamily: "Barlow Condensed",
              fontSize: 28,
              letterSpacing: 3,
              color: "#F4F7F2",
            }}
          >
            <div
              style={{
                width: 18,
                height: 28,
                background: "#B6FF3B",
                marginRight: 12,
                transform: "skewX(-12deg)",
              }}
            />
            SIDELINE
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 52, fontWeight: 600, lineHeight: 1.05, letterSpacing: -1 }}>
              Your fantasy matchup.
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 52,
                fontWeight: 600,
                lineHeight: 1.05,
                letterSpacing: -1,
                marginTop: 4,
              }}
            >
              Always on the Sideline
            </div>
            <div style={{ display: "flex", marginTop: 18, fontSize: 22, color: "#94A3B8", lineHeight: 1.35 }}>
              {SITE_DESCRIPTION}
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 18, color: "#B6FF3B" }}>
            <div style={{ display: "flex", marginRight: 22 }}>No betting</div>
            <div style={{ display: "flex" }}>Sleeper + ESPN</div>
          </div>
        </div>
        <div style={{ width: 640, height: "100%", display: "flex", alignItems: "center", paddingRight: 36 }}>
          <img
            src={hudSrc}
            width={604}
            height={340}
            alt=""
            style={{
              width: 604,
              height: 340,
              objectFit: "cover",
              borderRadius: 12,
              border: "1px solid #1E232B",
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Barlow", data: barlow, weight: 600, style: "normal" },
        { name: "Barlow Condensed", data: condensed, weight: 700, style: "normal" },
      ],
    },
  );
}
