/**
 * "At a glance" overview strip — sits above the in-depth FeatureTabs on the
 * marketing home. Where FeatureTabs renders the real, interactive product
 * surfaces, this strip is a quick, NON-interactive teaser of breadth.
 *
 * Each card pairs a flat graphic illustration with a short title + blurb.
 * The art is deliberately simple and aesthetic (one bold motif per card,
 * soft accent glow) rather than a dense UI facsimile — the goal is a clean,
 * digestible overview, not a second feature section. Cards compose the
 * established marketing card aesthetic (`bg-card border border-line
 * rounded-2xl`); the illustrations use only palette colors from
 * DESIGN_SYSTEM.md (white, zinc, green #22c55e, cyan #22d3ee). Server-rendered.
 */

import { Eyebrow, SectionHeading, SectionSubhead } from "./sections";

/* ---------- shared art atoms ------------------------------------------ */

const STAR =
  "M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z";

function Star({
  cx,
  cy,
  size,
  fill = "#ffffff",
  opacity = 1,
}: {
  cx: number;
  cy: number;
  size: number;
  fill?: string;
  opacity?: number;
}) {
  const s = size / 24;
  return (
    <path
      d={STAR}
      fill={fill}
      fillOpacity={opacity}
      transform={`translate(${cx - 12 * s} ${cy - 12 * s}) scale(${s})`}
    />
  );
}

const ART_CLASS = "block h-40 w-full";

/* ---------- flat illustrations ---------------------------------------- */

function TapToPayArt() {
  return (
    <svg className={ART_CLASS} viewBox="0 0 360 160" fill="none" aria-hidden>
      <defs>
        <linearGradient id="tp-card" x1="84" y1="44" x2="84" y2="128" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e4e4e7" />
        </linearGradient>
        <filter id="tp-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="24" />
        </filter>
      </defs>
      <circle cx="168" cy="82" r="58" fill="#22d3ee" fillOpacity="0.16" filter="url(#tp-glow)" />
      <g transform="rotate(-6 165 86)">
        <rect x="84" y="44" width="150" height="84" rx="16" fill="url(#tp-card)" />
        <rect x="102" y="62" width="24" height="18" rx="4" fill="#a1a1aa" />
        <rect x="102" y="96" width="72" height="8" rx="4" fill="#71717a" fillOpacity="0.5" />
        <rect x="102" y="110" width="44" height="8" rx="4" fill="#71717a" fillOpacity="0.3" />
      </g>
      <g stroke="#ffffff" strokeWidth="7" strokeLinecap="round">
        <path d="M252 64 A22 22 0 0 1 252 108" />
        <path d="M264 56 A34 34 0 0 1 264 116" />
        <path d="M276 48 A46 46 0 0 1 276 124" />
      </g>
      <circle cx="214" cy="52" r="15" fill="#22c55e" />
      <path d="M207 52l5 5 9-10" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrmArt() {
  return (
    <svg className={ART_CLASS} viewBox="0 0 360 160" fill="none" aria-hidden>
      <defs>
        <filter id="crm-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="26" />
        </filter>
      </defs>
      <circle cx="180" cy="80" r="60" fill="#ffffff" fillOpacity="0.08" filter="url(#crm-glow)" />
      <rect x="92" y="32" width="176" height="96" rx="14" fill="#0f0f12" stroke="#2a2a32" strokeWidth="1.5" />
      {/* row 1 — field with toggle on */}
      <rect x="110" y="50" width="52" height="8" rx="4" fill="#a1a1aa" fillOpacity="0.6" />
      <rect x="214" y="46" width="38" height="16" rx="8" fill="#22c55e" />
      <circle cx="244" cy="54" r="6" fill="#ffffff" />
      {/* row 2 — field with toggle off */}
      <rect x="110" y="76" width="64" height="8" rx="4" fill="#71717a" fillOpacity="0.6" />
      <rect x="214" y="72" width="38" height="16" rx="8" fill="#2a2a32" />
      <circle cx="224" cy="80" r="6" fill="#a1a1aa" />
      {/* row 3 — custom tags */}
      <rect x="110" y="100" width="36" height="14" rx="7" fill="#ffffff" fillOpacity="0.24" />
      <rect x="152" y="100" width="36" height="14" rx="7" fill="#22c55e" fillOpacity="0.38" />
      <rect x="194" y="100" width="36" height="14" rx="7" fill="#22d3ee" fillOpacity="0.38" />
    </svg>
  );
}

function PayrollArt() {
  return (
    <svg className={ART_CLASS} viewBox="0 0 360 160" fill="none" aria-hidden>
      <defs>
        <filter id="pay-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="26" />
        </filter>
      </defs>
      <circle cx="180" cy="92" r="56" fill="#22c55e" fillOpacity="0.16" filter="url(#pay-glow)" />
      {/* coin stack */}
      <ellipse cx="180" cy="116" rx="48" ry="14" fill="#52525b" />
      <rect x="132" y="104" width="96" height="12" fill="#52525b" />
      <ellipse cx="180" cy="104" rx="48" ry="14" fill="#71717a" />
      <rect x="132" y="88" width="96" height="12" fill="#52525b" />
      <ellipse cx="180" cy="88" rx="48" ry="14" fill="#71717a" />
      <rect x="132" y="72" width="96" height="12" fill="#52525b" />
      <ellipse cx="180" cy="72" rx="48" ry="14" fill="#ffffff" />
      <text x="180" y="79" textAnchor="middle" fontSize="20" fontWeight={900} fill="#22c55e">
        $
      </text>
      {/* growth marker */}
      <circle cx="256" cy="54" r="15" fill="#22c55e" fillOpacity="0.18" />
      <path d="M256 61v-13M250 54l6-6 6 6" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SubscriptionsArt() {
  return (
    <svg className={ART_CLASS} viewBox="0 0 560 160" fill="none" aria-hidden>
      <defs>
        <linearGradient id="sub-card" x1="235" y1="52" x2="235" y2="108" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e4e4e7" />
        </linearGradient>
        <filter id="sub-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="30" />
        </filter>
      </defs>
      <circle cx="280" cy="80" r="68" fill="#22d3ee" fillOpacity="0.14" filter="url(#sub-glow)" />
      {/* recurring ghost cards — faded duplicates of the center card */}
      <g opacity="0.4">
        <rect x="118" y="60" width="82" height="44" rx="10" fill="#ffffff" fillOpacity="0.1" />
        <rect x="130" y="70" width="15" height="11" rx="3" fill="#71717a" />
        <rect x="130" y="90" width="42" height="5" rx="2.5" fill="#71717a" fillOpacity="0.6" />
      </g>
      <g opacity="0.4">
        <rect x="360" y="60" width="82" height="44" rx="10" fill="#ffffff" fillOpacity="0.1" />
        <rect x="372" y="70" width="15" height="11" rx="3" fill="#71717a" />
        <rect x="372" y="90" width="42" height="5" rx="2.5" fill="#71717a" fillOpacity="0.6" />
      </g>
      {/* refresh arrows */}
      <g stroke="#22d3ee" strokeWidth="6" strokeLinecap="round">
        <path d="M232 38A64 64 0 0 1 340 58" />
        <path d="M328 122A64 64 0 0 1 220 102" />
      </g>
      <path d="M340 58l-13-3 4-12z" fill="#22d3ee" />
      <path d="M220 102l13 3-4 12z" fill="#22d3ee" />
      {/* center card */}
      <rect x="235" y="52" width="90" height="56" rx="12" fill="url(#sub-card)" />
      <rect x="248" y="64" width="18" height="13" rx="3" fill="#a1a1aa" />
      <rect x="248" y="92" width="52" height="6" rx="3" fill="#71717a" fillOpacity="0.5" />
    </svg>
  );
}

function ReviewsArt() {
  return (
    <svg className={ART_CLASS} viewBox="0 0 560 160" fill="none" aria-hidden>
      <defs>
        <filter id="rev-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="30" />
        </filter>
      </defs>
      <circle cx="280" cy="76" r="70" fill="#ffffff" fillOpacity="0.09" filter="url(#rev-glow)" />
      {/* side bubble — review text */}
      <rect x="70" y="58" width="92" height="48" rx="14" fill="#0f0f12" stroke="#2a2a32" strokeWidth="1.5" />
      <rect x="84" y="72" width="64" height="6" rx="3" fill="#a1a1aa" fillOpacity="0.45" />
      <rect x="84" y="84" width="46" height="6" rx="3" fill="#a1a1aa" fillOpacity="0.3" />
      {/* main bubble — 5 stars */}
      <path d="M224 100l-2 20 20-18z" fill="#0f0f12" />
      <rect x="190" y="38" width="180" height="64" rx="18" fill="#0f0f12" stroke="#2a2a32" strokeWidth="1.5" />
      <Star cx={220} cy={70} size={22} />
      <Star cx={250} cy={70} size={22} />
      <Star cx={280} cy={70} size={22} />
      <Star cx={310} cy={70} size={22} />
      <Star cx={340} cy={70} size={22} />
      {/* side bubble — mini stars */}
      <rect x="398" y="58" width="92" height="48" rx="14" fill="#0f0f12" stroke="#2a2a32" strokeWidth="1.5" />
      <Star cx={410} cy={82} size={12} opacity={0.85} />
      <Star cx={427} cy={82} size={12} opacity={0.85} />
      <Star cx={444} cy={82} size={12} opacity={0.85} />
      <Star cx={461} cy={82} size={12} opacity={0.85} />
      <Star cx={478} cy={82} size={12} opacity={0.85} />
    </svg>
  );
}

/* ---------- card ------------------------------------------------------- */

function GlanceCard({
  title,
  blurb,
  span,
  children,
}: {
  title: string;
  blurb: string;
  span: "narrow" | "wide";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-card border border-line rounded-2xl p-5 flex flex-col ${
        span === "narrow" ? "lg:col-span-2" : "lg:col-span-3"
      }`}
    >
      <div className="rounded-xl bg-elevated border border-line overflow-hidden">
        {children}
      </div>
      <h3 className="mt-5 text-[18px] font-extrabold tracking-tight text-white">
        {title}
      </h3>
      <p className="mt-2 text-[13px] font-bold text-zinc-400 leading-relaxed">
        {blurb}
      </p>
    </div>
  );
}

/* ---------- section ---------------------------------------------------- */

export function GlanceStrip() {
  return (
    <section className="px-6 md:px-10 py-24 md:py-32">
      <div className="max-w-app mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          <Eyebrow>At a glance</Eyebrow>
          <SectionHeading className="mt-5">
            More built in
            <br />
            than you&apos;d expect.
          </SectionHeading>
          <SectionSubhead className="mt-6 mx-auto">
            Tap-to-pay, recurring plans, payroll, and reviews — plus a CRM that
            bends to how you actually work. A quick look at what else ships in
            the box.
          </SectionSubhead>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
          <GlanceCard
            span="narrow"
            title="Tap to Pay"
            blurb="Take a card in person with a tap — no reader, no extra hardware. Funds settle straight to your account."
          >
            <TapToPayArt />
          </GlanceCard>

          <GlanceCard
            span="narrow"
            title="Customizable CRM"
            blurb="Custom fields, tags, and statuses that bend the CRM to exactly how your business runs."
          >
            <CrmArt />
          </GlanceCard>

          <GlanceCard
            span="narrow"
            title="Built-in Payroll"
            blurb="Commission and hourly pay calculated straight from closed jobs — run it in a click."
          >
            <PayrollArt />
          </GlanceCard>

          <GlanceCard
            span="wide"
            title="Seamless Subscriptions"
            blurb="Recurring plans with a card on file and auto-pay. Predictable revenue, zero chasing."
          >
            <SubscriptionsArt />
          </GlanceCard>

          <GlanceCard
            span="wide"
            title="Reviews on Autopilot"
            blurb="Collect and showcase customer reviews automatically after every completed job."
          >
            <ReviewsArt />
          </GlanceCard>
        </div>
      </div>
    </section>
  );
}
