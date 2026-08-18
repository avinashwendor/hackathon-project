import type { Metadata } from "next";
import { SCENARIOS } from "@/data/scenarios";
import { Comparison } from "@/components/agent/comparison";
import { PageFrame, Section } from "@/components/layout/page-frame";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { RuleLabel } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "The trap",
  description:
    "The same viewing history, given to a keyword recommender and to Upstream. One serves another Java meme. The other works out what the student is actually doing.",
};

export default function TrapPage() {
  return (
    <PageFrame>
      <SiteHeader />

      <main id="main" className="flex flex-1 flex-col">
        <Section className="pb-8">
          <RuleLabel className="justify-start">Shallow vs Upstream</RuleLabel>
          <h1 className="mt-8 max-w-[18ch] font-display text-[36px] leading-[1.1] font-bold text-balance text-fg sm:text-[46px]">
            Both systems get the same history. Only one of them reads it.
          </h1>
          <p className="mt-5 max-w-[66ch] text-body-lg text-fg-muted">
            The baseline is a real implementation, not a straw man: TF keyword overlap against the
            current reel, boosted by engagement — roughly what a weekend recommender does. It runs
            live, on the same catalog, at the same moment. Nothing here is pre-recorded.
          </p>
        </Section>

        <Section className="pt-0 pb-16">
          <Comparison scenarios={SCENARIOS} />
        </Section>
      </main>

      <SiteFooter />
    </PageFrame>
  );
}
