import { ImageResponse } from "next/og";

// Social share card for worldcuproulette.com (OG + Twitter).
export const alt =
  "World Cup Roulette — Spin the Wheel. Get Your Team. Win It All!";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          background: "#10150e",
          backgroundImage:
            "radial-gradient(circle at 20% 0%, rgba(130,219,111,0.25), transparent 55%), radial-gradient(circle at 85% 100%, rgba(255,225,109,0.2), transparent 55%)",
          color: "#dfe4d8",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "2px solid rgba(130,219,111,0.4)",
            borderRadius: 999,
            padding: "10px 28px",
            color: "#82db6f",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 6,
          }}
        >
          WORLD CUP 2026 · 48 NATIONS
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 110,
            fontWeight: 800,
            fontStyle: "italic",
            letterSpacing: -3,
            color: "#82db6f",
          }}
        >
          WORLD CUP ROULETTE
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 44,
            fontWeight: 700,
            color: "#ffe16d",
            letterSpacing: 2,
          }}
        >
          SPIN THE WHEEL · GET YOUR TEAM · WIN IT ALL
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#bfcab7",
            marginTop: 6,
          }}
        >
          The random-team World Cup pool — no skill, pure luck.
        </div>
      </div>
    ),
    size,
  );
}
