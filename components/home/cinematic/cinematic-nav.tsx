"use client";

import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const homeSections = ["#story", "#trust", "#paths", "#contact"];

const links = [
  { href: "#story", label: "The Feed" },
  { href: "#trust", label: "How It Works" },
  { href: "#paths", label: "Start Here" },
  { href: "#contact", label: "Get Access" },
];

export function CinematicNav() {
  const [compact, setCompact] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState("");
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (v) => setCompact(v > 70));

  const isCurrent = useCallback(
    (href: string) => href.startsWith("#") && activeAnchor === href,
    [activeAnchor],
  );

  useEffect(() => {
    const sections = homeSections
      .map((id) => document.querySelector(id))
      .filter(Boolean) as Element[];
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveAnchor(`#${entry.target.id}`);
        }),
      { rootMargin: "-35% 0px -55%", threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <motion.header
      className="journey-nav"
      data-compact={compact}
      initial={{ y: -90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="journey-nav__shell">
        <Link href="/" className="journey-nav__brand" aria-label="Upstream home">
          <span className="journey-nav__mark" aria-hidden="true">
            ↑
          </span>
          <span>
            <b>UPSTREAM</b>
            <small>The scroll that takes you somewhere</small>
          </span>
        </Link>

        <nav className="journey-nav__links" aria-label="Main navigation">
          {links.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrent(link.href) ? "page" : undefined}
            >
              <small>{String(index + 1).padStart(2, "0")}</small>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="journey-nav__actions">
          <Link className="journey-nav__cta" href="/signup">
            <span>Create account</span>
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
