import type { Metadata } from "next";
import { CATALOG_REELS } from "@/data/reels";
import { LibraryBrowser } from "@/components/catalog/library-browser";
import { PageFrame, Section } from "@/components/layout/page-frame";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { RuleLabel } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Library",
  description:
    "Every technical reel Upstream can recommend, searchable in plain English through the same vector index the agent uses.",
};

export default function LibraryPage() {
  return (
    <PageFrame>
      <SiteHeader />

      <main id="main" className="flex flex-1 flex-col">
        <Section className="pb-8">
          <RuleLabel className="justify-start">The library</RuleLabel>
          <h1 className="mt-8 max-w-[20ch] font-display text-[36px] leading-[1.1] font-bold text-balance text-fg sm:text-[46px]">
            Search it the way you would ask a friend.
          </h1>
          <p className="mt-5 max-w-[64ch] text-body-lg text-fg-muted">
            This is the same vector index the agent retrieves from, exposed directly. Describe a
            problem in your own words — no keyword needs to match — and watch what comes back, with
            the cosine score printed under each result.
          </p>
        </Section>

        <Section className="pt-0 pb-16">
          <LibraryBrowser reels={CATALOG_REELS} />
        </Section>
      </main>

      <SiteFooter />
    </PageFrame>
  );
}
