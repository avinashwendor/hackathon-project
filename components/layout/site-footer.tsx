import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/feed", label: "The feed" },
      { href: "/agent", label: "Agent console" },
      { href: "/library", label: "Library" },
      { href: "/profile", label: "Taste profile" },
    ],
  },
  {
    title: "How it works",
    links: [
      { href: "/trap", label: "Shallow vs Upstream" },
      { href: "/studio", label: "Ingest a reel" },
      { href: "/design-system", label: "Design system" },
      { href: "/api/health", label: "System health" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-5 py-12 sm:px-10 lg:px-16">
      <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
        <div className="max-w-sm">
          <Logo size={22} />
          <p className="mt-4 text-body text-fg-muted">
            The goal was never to stop the scrolling. It was to make the next sixty seconds
            worth something.
          </p>
        </div>

        <div className="flex gap-12 sm:gap-20">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="text-eyebrow text-fg-subtle">{column.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="focus-ring rounded-xs text-body text-fg-muted transition-colors hover:text-primary-500"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-12 border-t border-line pt-6 text-small text-fg-subtle">
        Upstream — built for a college hackathon. Reels, creators and engagement numbers in this
        build are fictional.
      </p>
    </footer>
  );
}
