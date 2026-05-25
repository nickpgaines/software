/**
 * "At a glance" overview strip — sits above the in-depth FeatureTabs on the
 * marketing home. Where FeatureTabs renders the real, interactive product
 * surfaces, this strip is a quick, NON-interactive teaser of breadth: the
 * parts of Forge that don't get a full panel (tap-to-pay, payroll, reviews)
 * plus a fast taste of the ones that do (subscriptions, CRM customization).
 *
 * Every card composes the established marketing card aesthetic
 * (`bg-card border border-line rounded-2xl`) and the dark-canvas tokens from
 * DESIGN_SYSTEM.md — no new tokens, no interactivity, server-rendered. The
 * little visuals inside each card are static facsimiles of real product UI
 * (the "our actual stuff" signal), not stock imagery.
 */

import { PULSE } from "@/components/pulse/theme";
import { Eyebrow, SectionHeading, SectionSubhead } from "./sections";

/* ---------- decorative glyphs ----------------------------------------- */

function Contactless({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M7 8a8 8 0 0 1 0 8" />
      <path d="M11 5a13 13 0 0 1 0 14" />
      <path d="M15 3a18 18 0 0 1 0 18" />
    </svg>
  );
}

function Stars({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-0.5 text-white">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" />
        </svg>
      ))}
    </div>
  );
}

/* ---------- small atoms ----------------------------------------------- */

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-extrabold tracking-tight"
      style={{ background: `${color}1F`, color }}
    >
      {label}
    </span>
  );
}

function StatusDot({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-extrabold tracking-tight"
      style={{ background: `${PULSE.green}1F`, color: PULSE.green }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: PULSE.green }} />
      {label}
    </span>
  );
}

function Avatar({ initial }: { initial: string }) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-black"
      style={{
        background: `${PULSE.cyan}1F`,
        color: PULSE.cyan,
        border: `1px solid ${PULSE.cyan}33`,
      }}
    >
      {initial}
    </div>
  );
}

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
      className={`bg-card border border-line rounded-2xl p-6 flex flex-col ${
        span === "narrow" ? "lg:col-span-2" : "lg:col-span-3"
      }`}
    >
      <div className="rounded-xl bg-elevated border border-line p-4">{children}</div>
      <h3 className="mt-6 text-[18px] font-extrabold tracking-tight text-white">
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
          {/* Tap to pay */}
          <GlanceCard
            span="narrow"
            title="Tap to Pay"
            blurb="Take a card in person with a tap — no reader, no extra hardware. Funds settle straight to your account."
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold text-zinc-500">Charged</div>
                <div className="mt-1 text-[22px] font-black tracking-tight leading-none tabular-nums text-white">
                  $349.00
                </div>
                <div className="mt-2.5">
                  <StatusDot label="Approved" />
                </div>
              </div>
              <Contactless className="h-10 w-10 text-white" />
            </div>
          </GlanceCard>

          {/* CRM customization */}
          <GlanceCard
            span="narrow"
            title="Customizable CRM"
            blurb="Custom fields, tags, and statuses that bend the CRM to exactly how your business runs."
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-zinc-500">Gate code</span>
                <span className="text-[12px] font-bold tabular-nums text-white">#4821</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-zinc-500">Preferred day</span>
                <span className="text-[12px] font-bold text-white">Tue AM</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Chip label="VIP" color={PULSE.violet} />
                <Chip label="Recurring" color={PULSE.green} />
                <Chip label="Net 14" color={PULSE.cyan} />
              </div>
            </div>
          </GlanceCard>

          {/* Payroll */}
          <GlanceCard
            span="narrow"
            title="Built-in Payroll"
            blurb="Commission and hourly pay calculated straight from closed jobs — run it in a click."
          >
            <div className="flex items-center gap-3">
              <Avatar initial="M" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold tracking-tight text-white">
                  Marcus B.
                </div>
                <div className="text-[11px] font-bold text-zinc-500">
                  41 jobs · 12% commission
                </div>
              </div>
              <div className="text-[14px] font-black tabular-nums text-white">$1,420</div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="text-[12px] font-bold text-zinc-500">Total payroll</span>
              <span className="text-[14px] font-black tabular-nums text-white">$8,940</span>
            </div>
          </GlanceCard>

          {/* Subscriptions */}
          <GlanceCard
            span="wide"
            title="Seamless Subscriptions"
            blurb="Recurring plans with a card on file and auto-pay. Predictable revenue, zero chasing."
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold tracking-tight text-white">
                    Monthly Window Plan
                  </div>
                  <div className="text-[11px] font-bold tabular-nums text-zinc-500">
                    Visa •••• 4242 · Auto-pay · Next Jun 1
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[13px] font-black tabular-nums text-white">$89/mo</span>
                  <StatusDot label="Active" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold tracking-tight text-white">
                    Quarterly Exterior Plan
                  </div>
                  <div className="text-[11px] font-bold tabular-nums text-zinc-500">
                    Visa •••• 8821 · Auto-pay · Next Aug 1
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[13px] font-black tabular-nums text-white">$240/qtr</span>
                  <StatusDot label="Active" />
                </div>
              </div>
            </div>
          </GlanceCard>

          {/* Reviews */}
          <GlanceCard
            span="wide"
            title="Reviews on Autopilot"
            blurb="Collect and showcase customer reviews automatically after every completed job."
          >
            <div className="flex items-center gap-5">
              <div className="shrink-0 text-center">
                <div className="text-[34px] font-black tracking-tight leading-none tabular-nums text-white">
                  4.9
                </div>
                <div className="mt-2 flex justify-center">
                  <Stars />
                </div>
                <div className="mt-1.5 text-[11px] font-bold text-zinc-500">128 reviews</div>
              </div>
              <div className="min-w-0 border-l border-line pl-5">
                <Stars />
                <p className="mt-2 text-[12.5px] font-bold leading-snug text-zinc-300">
                  “Best window cleaners we&apos;ve used — booking and paying was
                  effortless.”
                </p>
                <div className="mt-1.5 text-[11px] font-bold text-zinc-500">
                  Olivia R. · Verified customer
                </div>
              </div>
            </div>
          </GlanceCard>
        </div>
      </div>
    </section>
  );
}
