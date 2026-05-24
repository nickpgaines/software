import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared marketing primitives. All marketing surfaces compose with these so
 * spacing, type, and color tokens stay consistent across home / features /
 * pricing. The visual language tracks DESIGN_SYSTEM.md (Inter, black canvas,
 * font-extrabold/black headlines, rounded-2xl cards, accent-tinted CTAs).
 */

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-extrabold tracking-[0.22em] uppercase text-zinc-500">
      {children}
    </div>
  );
}

export function SectionHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-[40px] md:text-[56px] font-black tracking-tight leading-[0.95] text-white",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function SectionSubhead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[16px] md:text-[18px] font-bold text-zinc-400 max-w-2xl leading-relaxed",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function FeatureCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-line rounded-2xl p-8 flex flex-col">
      {children && <div className="mb-6">{children}</div>}
      <h3 className="text-[22px] font-extrabold tracking-tight text-white">
        {title}
      </h3>
      <p className="mt-3 text-[14px] font-bold text-zinc-400 leading-relaxed">
        {description}
      </p>
    </div>
  );
}

export function GetStartedCta({
  size = "default",
  label = "Get Started",
}: {
  size?: "default" | "lg";
  label?: string;
}) {
  return (
    <Button
      asChild
      size={size}
      className={cn(
        "rounded-full font-extrabold tracking-tight shadow-glow-violet",
        size === "lg" ? "h-12 px-8 text-[15px]" : "h-10 px-6 text-[14px]",
      )}
    >
      <Link href="/signup">{label}</Link>
    </Button>
  );
}

export function SecondaryCta({
  href,
  children,
  size = "default",
}: {
  href: string;
  children: React.ReactNode;
  size?: "default" | "lg";
}) {
  return (
    <Button
      asChild
      variant="outline"
      size={size}
      className={cn(
        "rounded-full bg-transparent border-line-strong text-white hover:bg-elevated font-extrabold tracking-tight",
        size === "lg" ? "h-12 px-8 text-[15px]" : "h-10 px-6 text-[14px]",
      )}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function FinalCta() {
  return (
    <section className="px-6 md:px-10 py-24 md:py-32">
      <div className="max-w-app mx-auto">
        <div className="bg-card border border-line rounded-3xl px-8 md:px-16 py-16 md:py-24 text-center">
          <Eyebrow>Get Started</Eyebrow>
          <SectionHeading className="mt-5 mx-auto max-w-3xl">
            Your business deserves a better CRM.
          </SectionHeading>
          <p className="mt-5 text-[16px] md:text-[18px] font-bold text-zinc-400 mx-auto max-w-xl">
            Free trial. No credit card. Cancel any time.
          </p>
          <div className="mt-8 flex items-center justify-center">
            <GetStartedCta size="lg" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function PoweredByStrip() {
  return (
    <section className="px-6 md:px-10 py-12 border-y border-line">
      <div className="max-w-app mx-auto">
        <div className="text-center text-[11px] font-extrabold tracking-[0.22em] uppercase text-zinc-600">
          Powered By
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 md:gap-x-20 gap-y-6">
          <BrandWord>stripe</BrandWord>
          <BrandWord>mapbox</BrandWord>
          <BrandWord>twilio</BrandWord>
          <BrandWord>Google</BrandWord>
          <BrandWord>Meta</BrandWord>
        </div>
      </div>
    </section>
  );
}

function BrandWord({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[24px] md:text-[28px] font-black tracking-tight text-zinc-600 grayscale">
      {children}
    </span>
  );
}
