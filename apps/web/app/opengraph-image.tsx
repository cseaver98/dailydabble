import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(circle at 12% 10%, rgba(255,255,255,0.28) 0, rgba(255,255,255,0) 28%), linear-gradient(135deg, #3a7a37 0%, #2f672d 55%, #225b22 100%)",
          color: "#ffffff",
          padding: "64px 72px",
          fontFamily: '"Plus Jakarta Sans", "Manrope", sans-serif',
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              height: 78,
              width: 78,
              borderRadius: 24,
              background: "rgba(209, 255, 199, 0.18)",
              border: "1px solid rgba(209, 255, 199, 0.32)",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 900,
              letterSpacing: "-0.04em",
            }}
          >
            DD
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 60,
                fontWeight: 900,
                letterSpacing: "-0.05em",
                lineHeight: 1,
              }}
            >
              DailyDabble
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: "rgba(209, 255, 199, 0.92)",
              }}
            >
              The daily trivia game hub
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              maxWidth: 760,
            }}
          >
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                lineHeight: 1.25,
                color: "#f6fff2",
              }}
            >
              Play DailyDabble’s lineup of original daily trivia games in one place.
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "rgba(255,255,255,0.78)",
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
              padding: "18px 28px",
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: "-0.02em",
            }}
          >
            dailydabble.app
          </div>
        </div>
      </div>
    ),
    size,
  );
}
