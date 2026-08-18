import type { Metadata } from "next";
import { SCENARIOS } from "@/data/scenarios";
import { ALL_REELS } from "@/data/reels";
import { AgentConsole } from "@/components/agent/agent-console";
import { PageFrame, Section } from "@/components/layout/page-frame";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { RuleLabel } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Agent console",
  description:
    "Watch the recommendation agent read a viewing history, climb from surface topic to motivation, refuse the hype and pick one reel.",
};

export default function AgentPage() {
  const reelsById = Object.fromEntries(ALL_REELS.map((reel) => [reel.id, reel]));

  return (
    <PageFrame>
      <SiteHeader />

      <main id="main" className="flex flex-1 flex-col">
        <Section className="pb-8">
          <RuleLabel className="justify-start">Agent console</RuleLabel>
          <h1 className="mt-8 max-w-[20ch] font-display text-[36px] leading-[1.1] font-bold text-balance text-fg sm:text-[46px]">
            Every recommendation, with its working shown.
          </h1>
          <p className="mt-5 max-w-[64ch] text-body-lg text-fg-muted">
            Pick a viewing history and watch the pipeline run live: what the behaviour said, how far
            the agent climbed from the surface topic, which candidates the guardrails refused, and
            why one reel survived.
          </p>
        </Section>

        <Section className="pt-0 pb-16">
          <AgentConsole scenarios={SCENARIOS} reelsById={reelsById} />
        </Section>
      </main>

      <SiteFooter />
    </PageFrame>
  );
}
