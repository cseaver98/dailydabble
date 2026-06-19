import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function OpenGraphImage() {
  const [plusJakartaSans, manrope] = await Promise.all([
    readFile(new URL("./opengraph/plus-jakarta-sans-extra-bold.ttf", import.meta.url)),
    readFile(new URL("./opengraph/manrope-bold.ttf", import.meta.url)),
  ]);

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
          background:
            "radial-gradient(circle at 8% 0%, #ffffff 0%, rgba(255,255,255,0) 42%), linear-gradient(180deg, #ffffff 0%, #f5f6f9 100%)",
          color: "#2f672d",
          padding: "64px 72px",
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
            gap: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              height: 116,
              width: 116,
              borderRadius: 28,
              background: "#ffffff",
              border: "3px solid rgba(47, 103, 45, 0.78)",
              boxShadow: "0 18px 36px rgba(34, 91, 34, 0.14)",
              alignItems: "center",
              justifyContent: "center",
              color: "#2f672d",
              fontFamily: "Plus Jakarta Sans",
              fontSize: 68,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            DD
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
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
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#225b22",
                letterSpacing: "-0.01em",
              }}
            >
              The daily trivia game hub
            </div>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 40,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              maxWidth: 760,
            }}
          >
            <div
              style={{
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
                fontSize: 23,
                fontWeight: 700,
                color: "#2f672d",
              }}
            >
              Verble, Doodle, Moviedle, Yeardle, Sportle, Equadle, and Agegaple
            </div>
          </div>

          <div
            style={{
              display: "flex",
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
