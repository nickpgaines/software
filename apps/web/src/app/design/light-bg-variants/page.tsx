// Preview: 4 light-mode page-bg gray variations.
// View at /design/light-bg-variants (toggle the app to light mode first).

const VARIANTS = [
  { hex: "#f5f5f7", label: "1. Current (in production)" },
  { hex: "#f7f7f9", label: "2. A little lighter" },
  { hex: "#f9f9fb", label: "3. Lighter still" },
  { hex: "#fbfbfd", label: "4. Lightest" },
];

export default function LightBgVariantsPage() {
  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", padding: "32px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#0a0a0a",
            marginBottom: 6,
          }}
        >
          Light-mode page-bg variations
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "#52525b",
            fontWeight: 600,
            marginBottom: 24,
          }}
        >
          Each row mimics the dashboard chrome: white sidebar on the left,
          white widget on the right, page background in between. Compare the
          gray values for the page background.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {VARIANTS.map((v) => (
            <Mock key={v.hex} hex={v.hex} label={v.label} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Mock({ hex, label }: { hex: string; label: string }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#0a0a0a",
            letterSpacing: "-0.01em",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#71717a",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          {hex}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          height: 220,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid #e4e4e7",
          background: hex,
        }}
      >
        {/* Sidebar */}
        <div
          style={{
            width: 180,
            background: "#ffffff",
            borderRight: "1px solid #e4e4e7",
            padding: "16px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#0a0a0a",
              marginBottom: 8,
            }}
          >
            Nick360
          </div>
          {["Dashboard", "Schedule", "Map", "Leads", "Messages"].map((n, i) => (
            <div
              key={n}
              style={{
                fontSize: 12.5,
                fontWeight: i === 0 ? 800 : 700,
                color: i === 0 ? "#0a0a0a" : "#71717a",
                padding: "6px 8px",
                borderRadius: 8,
                background: i === 0 ? "#ebebef" : "transparent",
              }}
            >
              {n}
            </div>
          ))}
        </div>

        {/* Page area with a widget */}
        <div style={{ flex: 1, padding: 20 }}>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e4e4e7",
              borderRadius: 16,
              padding: 16,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.18em",
                color: "#71717a",
                textTransform: "uppercase",
              }}
            >
              Revenue · This month
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                letterSpacing: "-0.025em",
                color: "#0a0a0a",
                lineHeight: 1,
              }}
            >
              $1,098
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#52525b",
                marginTop: 4,
              }}
            >
              Sample widget on page bg {hex}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
