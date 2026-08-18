import type { Metadata } from "next";
import { CATALOG_REELS } from "@/data/reels";
import { ReelTile } from "@/components/catalog/reel-tile";
import { Logo, LogoMark } from "@/components/brand/logo";
import { PageFrame, Section } from "@/components/layout/page-frame";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge, Card, Chip, Eyebrow, Meter, RuleLabel } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Design system",
  description: "The tokens, type scale and components Upstream is built from.",
};

const PRIMARY = [
  ["Primary 600", "#ea5a0b"],
  ["Primary 500", "#f97316"],
  ["Primary 400", "#fb923c"],
  ["Primary 300", "#fdba74"],
  ["Primary 200", "#fed7aa"],
  ["Primary 100", "#ffeee5"],
];

const SIGNAL = [
  ["Signal 600", "#4338ca"],
  ["Signal 500", "#4f46e5"],
  ["Signal 400", "#818cf8"],
  ["Signal 100", "#eef0fe"],
];

const NEUTRAL = [
  ["Ink 950", "#0a0908"],
  ["Ink 900", "#12100e"],
  ["Neutral 900", "#0f172a"],
  ["Neutral 500", "#64748b"],
  ["Neutral 200", "#e2e8f0"],
  ["Canvas", "#fbf8f5"],
  ["Canvas line", "#f0e7e0"],
  ["White", "#ffffff"],
];

const TYPE_SCALE = [
  ["Display 1", "text-display-1", "Playfair 48/56 bold", "Page titles"],
  ["Display 2", "text-display-2", "Playfair 36/44 bold", "Section titles"],
  ["Heading 1", "text-heading-1", "Inter 28/36 semibold", "Card titles"],
  ["Heading 2", "text-heading-2", "Inter 22/30 semibold", "Sub sections"],
  ["Heading 3", "text-heading-3", "Inter 18/26 medium", "Small titles"],
  ["Body large", "text-body-lg", "Inter 16/24 regular", "Body copy"],
  ["Body", "text-body", "Inter 14/20 regular", "Supporting text"],
  ["Small", "text-small", "Inter 12/16 regular", "Captions, meta"],
  ["Eyebrow", "text-eyebrow", "Inter 11 semibold, tracked", "Section labels"],
  ["Mono", "text-mono-sm", "JetBrains Mono 13/20", "Telemetry, output"],
];

function Swatches({ items, dark = false }: { items: string[][]; dark?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {items.map(([name, hex]) => (
        <div key={name}>
          <div
            className="h-16 rounded-md border border-line"
            style={{ background: hex }}
            aria-hidden
          />
          <p className="mt-2 text-[13px] font-medium text-fg">{name}</p>
          <p className="text-mono-xs text-fg-subtle">{hex}</p>
        </div>
      ))}
      {dark && null}
    </div>
  );
}

export default function DesignSystemPage() {
  const sample = CATALOG_REELS[0];

  return (
    <PageFrame>
      <SiteHeader />

      <main id="main" className="flex flex-1 flex-col">
        <Section className="pb-10">
          <RuleLabel className="justify-start">Design system</RuleLabel>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <LogoMark size={44} className="text-primary-500" />
            <h1 className="font-display text-[36px] leading-[1.1] font-bold text-fg sm:text-[46px]">
              One system, two worlds.
            </h1>
          </div>
          <p className="mt-5 max-w-[66ch] text-body-lg text-fg-muted">
            Paper is where the product reasons — warm canvas, Playfair headings, hairline rules. Ink
            is where the reels play — the same accent on an inverted ground, applied by adding{" "}
            <code className="rounded-xs bg-surface-2 px-1.5 py-0.5 text-mono-xs">.theme-ink</code>{" "}
            to any subtree. Components consume semantic tokens, so both worlds share one set of parts.
          </p>
        </Section>

        <Section bordered>
          <h2 className="text-eyebrow text-fg-subtle">01 · Colour</h2>
          <h3 className="mt-6 text-heading-3 text-fg">Primary — the shared accent</h3>
          <Swatches items={PRIMARY} />
          <h3 className="mt-10 text-heading-3 text-fg">Signal — the agent&apos;s own colour</h3>
          <Swatches items={SIGNAL} />
          <h3 className="mt-10 text-heading-3 text-fg">Ground</h3>
          <Swatches items={NEUTRAL} />
        </Section>

        <Section bordered>
          <h2 className="text-eyebrow text-fg-subtle">02 · Type scale</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Style", "Sample", "Spec", "Use"].map((h) => (
                    <th key={h} className="py-3 pr-6 text-eyebrow text-fg-subtle">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TYPE_SCALE.map(([name, cls, spec, use]) => (
                  <tr key={name} className="border-b border-line">
                    <td className="py-4 pr-6 text-body text-fg-muted">{name}</td>
                    <td className="py-4 pr-6">
                      <span className={cls}>Upstream</span>
                    </td>
                    <td className="py-4 pr-6 text-mono-xs text-fg-subtle">{spec}</td>
                    <td className="py-4 text-body text-fg-muted">{use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section bordered>
          <h2 className="text-eyebrow text-fg-subtle">03 · Controls</h2>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="tertiary">Tertiary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="text">Text</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button size="xl">Extra large</Button>
            <Button size="lg">Large</Button>
            <Button size="md">Medium</Button>
            <Button size="sm">Small</Button>
          </div>
        </Section>

        <Section bordered>
          <h2 className="text-eyebrow text-fg-subtle">04 · Status and meta</h2>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Badge tone="primary">Career</Badge>
            <Badge tone="signal">Inference</Badge>
            <Badge tone="success">High</Badge>
            <Badge tone="warn">Medium</Badge>
            <Badge tone="danger">Hype</Badge>
            <Badge tone="neutral">Beginner</Badge>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Chip tone="primary">breadth detected</Chip>
            <Chip tone="signal">system design</Chip>
            <Chip>garbage collection 0.42</Chip>
          </div>
          <div className="mt-8 max-w-md space-y-4">
            <Meter value={0.82} label="82%" />
            <Meter value={0.46} label="46%" tone="signal" />
            <Meter value={0.19} label="19%" tone="danger" />
          </div>
          <Eyebrow className="mt-8">Section label</Eyebrow>
        </Section>

        <Section bordered>
          <h2 className="text-eyebrow text-fg-subtle">05 · Surfaces</h2>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Card className="gap-2">
              <h3 className="text-heading-3 text-fg">Card, paper</h3>
              <p className="text-body text-fg-muted">
                White surface, hairline border, 16px radius. The default container everywhere on the
                reasoning side.
              </p>
            </Card>
            <div className="theme-ink rounded-lg border border-line bg-surface p-5">
              <h3 className="text-heading-3 text-fg">Card, ink</h3>
              <p className="mt-2 text-body text-fg-muted">
                The same component. Only the tokens changed — one class on the wrapper.
              </p>
              <div className="mt-4 flex gap-2">
                <Badge tone="ink">feed</Badge>
                <Badge tone="ink">confidence High</Badge>
              </div>
            </div>
          </div>
          <div className="mt-5 max-w-2xl">{sample && <ReelTile reel={sample} />}</div>
        </Section>

        <Section bordered>
          <h2 className="text-eyebrow text-fg-subtle">06 · Brand</h2>
          <p className="mt-4 max-w-[62ch] text-body-lg text-fg-muted">
            The mark is a play triangle rotated to point up: the gesture that starts a reel, aimed
            somewhere. The notch keeps it from reading as a plain arrow.
          </p>
          <div className="mt-8 flex flex-wrap items-end gap-10">
            <Logo size={40} />
            <Logo size={26} />
            <LogoMark size={56} className="text-primary-500" />
            <div className="theme-ink rounded-md bg-surface px-6 py-5">
              <Logo size={26} />
            </div>
          </div>
        </Section>
      </main>

      <SiteFooter />
    </PageFrame>
  );
}
