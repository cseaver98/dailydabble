import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

const gameDetails = [
  { name: "Verble", file: "verble-mark-v3.png", color: "#7a7200", background: "#fdfadf" },
  { name: "Doodle", file: "doodle-mark-v2.png", color: "#1768a6", background: "#e0f2fe" },
  { name: "Moviedle", file: "moviedle-mark-v2.png", color: "#0f766e", background: "#ccfbf1" },
  { name: "Yeardle", file: "yeardle-mark-v2.png", color: "#5a40cb", background: "#ede9fe" },
  { name: "Sportle", file: "sportle-mark-v2.png", color: "#a45508", background: "#fef3c7" },
  { name: "Equadle", file: "equadle-mark-v2.png", color: "#ba1a1a", background: "#ffe4e6" },
  { name: "Agegaple", file: "agegaple-mark-v3.png", color: "#9e4e6d", background: "#faebf0" },
];

export default async function OpenGraphImage() {
  const [plusJakartaSans, manrope] = await Promise.all([
    readFile(new URL("./opengraph/plus-jakarta-sans-extra-bold.ttf", import.meta.url)),
    readFile(new URL("./opengraph/manrope-bold.ttf", import.meta.url)),
  ]);
  const games = gameDetails.map((game) => ({
    ...game,
    iconSrc: `https://dailydabble.app/${game.file}`,
  }));

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          position: "relative",
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
          background:
            "radial-gradient(circle at 8% 0%, #ffffff 0%, rgba(255,255,255,0) 42%), linear-gradient(180deg, #ffffff 0%, #f5f6f9 100%)",
          color: "#2f672d",
          padding: "52px 64px 58px",
          fontFamily: "Manrope",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 78% 18%, rgba(182, 246, 171, 0.42) 0, rgba(182, 246, 171, 0) 26%), radial-gradient(circle at 8% 88%, rgba(209, 255, 199, 0.58) 0, rgba(209, 255, 199, 0) 30%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "-0.055em",
              lineHeight: 0.95,
              color: "#2f672d",
              fontFamily: "Plus Jakarta Sans",
            }}
          >
            DailyDabble
          </div>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            width: "100%",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          {games.map((game) => (
            <div
              key={game.name}
              style={{
                display: "flex",
                width: 136,
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 88,
                  height: 88,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 24,
                  background: game.background,
                  boxShadow: "0 12px 24px rgba(44, 47, 49, 0.08)",
                }}
              >
                <img alt="" height="68" src={game.iconSrc} width="68" />
              </div>
              <div
                style={{
                  display: "flex",
                  color: game.color,
                  fontFamily: "Plus Jakarta Sans",
                  fontSize: 19,
                  fontWeight: 800,
                  letterSpacing: "-0.025em",
                }}
              >
                {game.name}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 40,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 700,
              lineHeight: 1.18,
              color: "#2c2f31",
              letterSpacing: "-0.02em",
            }}
          >
            Play original daily trivia games in one place.
          </div>

          <div
            style={{
              display: "flex",
              flexShrink: 0,
              borderRadius: 999,
              background: "#d1ffc7",
              color: "#225b22",
              border: "2px solid rgba(47, 103, 45, 0.16)",
              padding: "18px 30px",
              fontSize: 25,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              boxShadow: "0 16px 28px rgba(34, 91, 34, 0.1)",
            }}
          >
            dailydabble.app
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Plus Jakarta Sans",
          data: plusJakartaSans,
          style: "normal",
          weight: 800,
        },
        {
          name: "Manrope",
          data: manrope,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
