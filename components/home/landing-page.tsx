import Link from "next/link";
import { ArrowRight, ArrowUpRight, Play, Sparkles } from "lucide-react";
import { CATALOG_REELS, FEED_REELS } from "@/data/reels";
import { CATEGORIES } from "@/lib/types";
import { BarDecoration } from "@/components/home/decoration";
import { HypeWall } from "@/components/home/hype-wall";
import { Ladder } from "@/components/home/ladder";
import { OutputSpecimen } from "@/components/home/output-specimen";
import { PipelineDiagram } from "@/components/home/pipeline-diagram";
import { PageFrame, Section } from "@/components/layout/page-frame";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonClasses } from "@/components/ui/button";
import { Eyebrow, RuleLabel } from "@/components/ui/primitives";

const STATS = [
  { value: String(CATALOG_REELS.length), label: "technical reels indexed" },
  { value: String(CATEGORIES.length), label: "categories, beginner to advanced" },
  { value: String(FEED_REELS.length), label: "sample feed inputs" },
  { value: "0", label: "hype reels ever recommended" },
];

/** Public marketing landing — hero, trap demo, pipeline, signup CTA. */
export function LandingPage() {
  return (
    <PageFrame>
      <SiteHeader />

      <main className="flex flex-1 flex-col">
        <Section className="flex flex-col items-center pt-14 pb-14 text-center lg:pt-20">
          <Eyebrow>
            <Sparkles className="size-3.5" strokeWidth={2.4} aria-hidden />
            Scroll-native learning
          </Eyebrow>

          <h1 className="mt-9 max-w-[15ch] font-display text-[42px] leading-[1.08] font-bold text-balance text-fg sm:text-[58px] lg:text-[68px]">
            Your scroll already knows. It just isn&apos;t listening.
          </h1>

          <p className="mt-7 max-w-[54ch] text-[17px] leading-8 text-balance text-fg-muted sm:text-[18px]">
            Upstream reads <em className="font-display italic text-fg">why</em> you watched — not
            what you watched — and points the next sixty seconds at something that leaves you able
            to do a thing you couldn&apos;t before.
          </p>

          <div className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <Link href="/signup" className={buttonClasses({ size: "xl", className: "w-full sm:w-auto" })}>
              <Play className="size-4.5 fill-current" strokeWidth={0} aria-hidden />
              Create an account
            </Link>
            <Link
              href="/trap"
              className={buttonClasses({ variant: "tertiary", size: "xl", className: "w-full sm:w-auto" })}
            >
              Watch a shallow system fail
              <ArrowRight className="size-4.5" strokeWidth={2} aria-hidden />
            </Link>
          </div>

          <OutputSpecimen className="mt-14 w-full max-w-3xl text-left" />

          <p className="mt-5 max-w-[58ch] text-small text-fg-subtle">
            Real output from the trap scenario. The student watched a Java meme. The agent did not
            recommend another Java meme.
          </p>
        </Section>

        <div className="grid grid-cols-2 gap-px border-y border-line bg-line lg:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-bg px-5 py-7 text-center sm:px-8">
              <p className="font-display text-[34px] leading-none font-bold text-fg sm:text-[40px]">
                {stat.value}
              </p>
              <p className="mt-2 text-small text-fg-muted">{stat.label}</p>
            </div>
          ))}
        </div>

        <Section>
          <RuleLabel>The problem the brief names</RuleLabel>

          <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <h2 className="font-display text-[32px] leading-[1.14] font-bold text-balance text-fg sm:text-[38px]">
                A student watches four reels. A shallow system sees one word.
              </h2>
              <p className="mt-6 text-body-lg text-fg-muted">
                A Java meme. A software-engineer day-in-the-life. A coding interview joke. A laptop
                comparison. Keyword overlap ranks <span className="font-medium text-fg">“Java”</span>{" "}
                highest and serves another Java meme — more of the same joke, no new capability.
              </p>
              <p className="mt-4 text-body-lg text-fg-muted">
                But the laptop reel contains no Java at all. It is the reel that gives the game away:
                nobody researches a development machine for a punchline. The four reels are not about
                a language. They are about a person deciding who they are going to be.
              </p>

              <Link
                href="/trap"
                className="focus-ring mt-8 inline-flex items-center gap-2 rounded-xs text-[15px] font-medium text-primary-500 transition-colors hover:text-primary-600"
              >
                Run both recommenders side by side
                <ArrowUpRight className="size-4" strokeWidth={2} aria-hidden />
              </Link>
            </div>

            <Ladder />
          </div>
        </Section>

        <Section bordered>
          <RuleLabel>How it actually works</RuleLabel>
          <h2 className="mt-10 max-w-[22ch] font-display text-[32px] leading-[1.14] font-bold text-balance text-fg sm:text-[38px]">
            Six stages, and every one of them shows its working.
          </h2>
          <p className="mt-5 max-w-[62ch] text-body-lg text-fg-muted">
            A recommendation you cannot interrogate is just another black box — which is the thing
            this is meant to be an answer to. Every run returns its stages, its rejected candidates
            and the evidence it leaned on.
          </p>
          <PipelineDiagram className="mt-10" />
        </Section>

        <Section bordered>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16">
            <div>
              <RuleLabel className="justify-start">The second trap</RuleLabel>
              <h2 className="mt-10 max-w-[20ch] font-display text-[32px] leading-[1.14] font-bold text-balance text-fg sm:text-[38px]">
                Never recommend “10 AI tools that will get you a job”.
              </h2>
              <p className="mt-6 text-body-lg text-fg-muted">
                Hype wins every engagement metric there is. It is watched longer, saved more and
                shared harder than anything that teaches. So the guardrail runs deliberately against
                popularity, and it runs <em className="font-display italic">before</em> ranking —
                a reel that trips it never reaches the shortlist at all.
              </p>
              <p className="mt-4 text-body-lg text-fg-muted">
                High engagement on hype means a student is anxious about their career. The honest
                response is to serve the thing that actually reduces that anxiety.
              </p>
            </div>
            <HypeWall />
          </div>
        </Section>

        <Section bordered className="text-center">
          <h2 className="mx-auto max-w-[18ch] font-display text-[34px] leading-[1.1] font-bold text-balance text-fg sm:text-[44px]">
            The goal was never to stop the scrolling.
          </h2>
          <p className="mx-auto mt-6 max-w-[52ch] text-body-lg text-fg-muted">
            They are going to scroll either way. Upstream just makes the current run somewhere.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className={buttonClasses({ size: "lg" })}>
              Create an account
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
            </Link>
            <Link href="/login" className={buttonClasses({ variant: "tertiary", size: "lg" })}>
              Log in
            </Link>
          </div>
        </Section>

        <BarDecoration className="mt-auto" />
      </main>

      <SiteFooter />
    </PageFrame>
  );
}
