import type { Metadata } from "next";
import {
  Eyebrow,
  FinalCta,
  GetStartedCta,
  PoweredByStrip,
  SectionHeading,
  SectionSubhead,
  SecondaryCta,
} from "@/components/marketing/sections";
import { FeatureTabs } from "@/components/marketing/FeatureTabs";
import { GlanceStrip } from "@/components/marketing/GlanceStrip";
import { PricingSection } from "@/components/marketing/PricingSection";
import { FaqSection } from "@/components/marketing/FaqSection";

export const metadata: Metadata = {
  title: "Forge — The CRM for service businesses that move fast.",
  description:
    "Scheduling, territory mapping, invoicing, payroll, and recurring billing — one app to run your entire service business. Built for the field, designed to scale.",
};

export default function MarketingHome() {
  return (
    <div>
      {/* Hero */}
      <section className="px-6 md:px-10 pt-20 md:pt-28 pb-20 md:pb-28">
        <div className="max-w-app mx-auto text-center">
          <Eyebrow>CRM for service businesses</Eyebrow>
          <h1 className="mt-6 text-[44px] md:text-[80px] lg:text-[96px] font-black tracking-[-0.03em] leading-[0.92] text-white">
            Built to run
            <br />
            your business.
          </h1>
          <p className="mt-8 text-[16px] md:text-[19px] font-bold text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Scheduling, mapping, invoicing, payroll, and recurring billing —
            one platform to run your service business. Designed for crews in
            the field, built to scale with you.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <GetStartedCta size="lg" />
            <SecondaryCta href="#features" size="lg">
              See features
            </SecondaryCta>
          </div>
        </div>
      </section>

      <PoweredByStrip />

      {/* At a glance — quick, non-interactive teaser of breadth */}
      <GlanceStrip />

      {/* Features — tabbed panel */}
      <section
        id="features"
        className="px-6 md:px-10 py-24 md:py-32 scroll-mt-20"
      >
        <div className="max-w-app mx-auto">
          <div className="text-center max-w-3xl mx-auto">
            <Eyebrow>Features</Eyebrow>
            <SectionHeading className="mt-5">
              The whole business,
              <br />
              one app.
            </SectionHeading>
            <SectionSubhead className="mt-6 mx-auto">
              Click any feature to see it in action. Hover the charts, switch
              the ranges, flip between Sales and Tech — the marketing page
              runs the same widgets the dashboard does.
            </SectionSubhead>
          </div>

          <div className="mt-16">
            <FeatureTabs />
          </div>

          <div className="mt-16 flex justify-center">
            <GetStartedCta size="lg" />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="px-6 md:px-10 py-24 md:py-32 scroll-mt-20"
      >
        <div className="max-w-app mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <Eyebrow>Pricing</Eyebrow>
            <SectionHeading className="mt-5">
              Built and priced
              <br />
              for growth.
            </SectionHeading>
            <SectionSubhead className="mt-6 mx-auto">
              Free trial. No credit card required. Cancel any time.
            </SectionSubhead>
          </div>

          <div className="mt-14">
            <PricingSection />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 md:px-10 py-24 md:py-32 scroll-mt-20">
        <div className="max-w-app mx-auto">
          <Eyebrow>FAQ</Eyebrow>
          <SectionHeading className="mt-5 max-w-2xl">
            Everything you need before switching.
          </SectionHeading>
          <SectionSubhead className="mt-6">
            Still have questions? Email{" "}
            <a
              href="mailto:support@forgecrm.io"
              className="text-white underline underline-offset-4"
            >
              support@forgecrm.io
            </a>{" "}
            and we&apos;ll get back to you.
          </SectionSubhead>

          <div className="mt-12">
            <FaqSection />
          </div>
        </div>
      </section>

      <FinalCta />
    </div>
  );
}
