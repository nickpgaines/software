"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

// Picks the smallest "nice" chart-top >= value so 5 ticks (0, 25%, 50%,
// 75%, 100%) cover the data tightly. Steps come from
// {1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10} × 10^n so e.g. 1098 → 1200 and
// 5425 → 6000 instead of jumping to 2000 / 10000. Matches `niceCeil` in
// `pulse/widgets.tsx` so the dashboard chart and the reports bar chart
// share the same y-axis rounding behaviour.
function niceChartTop(value: number) {
  if (value <= 0) return 1;
  const intervals = 4;
  const rawStep = value / intervals;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const niceMultipliers = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  let chosen = 10;
  for (const m of niceMultipliers) {
    if (m >= norm) {
      chosen = m;
      break;
    }
  }
  return chosen * mag * intervals;
}

function fiveTicks(top: number) {
  return [0, top * 0.25, top * 0.5, top * 0.75, top];
}

/**
 * Pure presentation bar chart used by the Reports → Top Salespeople /
 * Top Technicians cards. Lives in its own file so other surfaces (the
 * marketing site, future widget compositions) can import it without
 * pulling in the full ReportsClient module.
 */
export function RevenueBarChart({
  data,
  color,
  averageDollars,
  tooltipLabel = "Revenue",
}: {
  data: { name: string; revenue_cents: number }[];
  color: string;
  averageDollars?: number;
  tooltipLabel?: string;
}) {
  const chartData = data.map((d) => ({
    name: d.name,
    revenue: d.revenue_cents / 100,
  }));
  const maxRevenue = Math.max(
    0,
    ...chartData.map((d) => d.revenue),
    typeof averageDollars === "number" ? averageDollars : 0,
  );
  const yTop = niceChartTop(maxRevenue || 1);
  const yTicks = fiveTicks(yTop);
  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1f1f24" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#a1a1aa", fontSize: 11, fontWeight: 700 }}
            tickLine={false}
            axisLine={{ stroke: "#1f1f24" }}
            interval={0}
          />
          <YAxis
            tick={{ fill: "#a1a1aa", fontSize: 11, fontWeight: 700 }}
            tickLine={false}
            axisLine={{ stroke: "#1f1f24" }}
            tickFormatter={(v: number) =>
              v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}`
            }
            domain={[0, yTop]}
            ticks={yTicks}
            width={48}
          />
          <RTooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#0f0f12",
              border: "1px solid #1f1f24",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              color: "#fafafa",
            }}
            labelStyle={{ color: "#fafafa", fontWeight: 800 }}
            itemStyle={{ color: "#fafafa" }}
            formatter={(v) => {
              const n = typeof v === "number" ? v : Number(v) || 0;
              return [
                `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                tooltipLabel,
              ];
            }}
          />
          <Bar dataKey="revenue" fill={color} radius={[6, 6, 0, 0]} />
          {typeof averageDollars === "number" && averageDollars > 0 && (
            <ReferenceLine
              y={averageDollars}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: `Team avg $${averageDollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                position: "insideTopRight",
                fill: "#f59e0b",
                fontSize: 11,
                fontWeight: 800,
              }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
