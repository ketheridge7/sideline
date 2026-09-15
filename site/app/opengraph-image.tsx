import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/constants";

export const alt = SITE_TAGLINE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
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
          <div
            style={{
              display: "flex",
              width: 18,
              height: 48,
              marginRight: 16,
              background: "linear-gradient(180deg, #7DFFB0 0%, #A6E6A0 42%, #D6F34A 100%)",
            }}
          />
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
