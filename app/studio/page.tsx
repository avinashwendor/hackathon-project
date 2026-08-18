import type { Metadata } from "next";
import { StudioForm } from "@/components/catalog/studio-form";
import { PageFrame, Section } from "@/components/layout/page-frame";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { RuleLabel } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Studio",
  description:
    "Add a reel to the catalog: direct-to-storage upload, automatic embedding, vector indexing, and the hype filter checking your copy as you write it.",
};

export default function StudioPage() {
  return (
    <PageFrame>
      <SiteHeader />

      <main id="main" className="flex flex-1 flex-col">
        <Section className="pb-8">
          <RuleLabel className="justify-start">Studio</RuleLabel>
          <h1 className="mt-8 max-w-[20ch] font-display text-[36px] leading-[1.1] font-bold text-balance text-fg sm:text-[46px]">
            Put a reel in, and it becomes recommendable.
          </h1>
          <p className="mt-5 max-w-[66ch] text-body-lg text-fg-muted">
            The file goes straight from your browser to object storage on a presigned URL. The text
            is embedded and written into the vector index in the same request, so the agent can
            retrieve it a second later. The hype filter reads your copy while you type.
          </p>
        </Section>

        <Section className="pt-0 pb-16">
          <StudioForm />
        </Section>
      </main>

      <SiteFooter />
    </PageFrame>
  );
}
