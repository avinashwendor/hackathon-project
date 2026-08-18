"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Brain, Eye, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Stat = {
  value: number;
  suffix: string;
  decimals?: number;
  label: string;
  kicker: string;
  copy: string;
  note: string;
  icon: LucideIcon;
};

const stats: Stat[] = [
  {
    value: 6,
    suffix: "",
    label: "Pipeline stages",
    kicker: "Transparent reasoning",
    copy: "Every run returns its stages, rejected candidates, and the evidence it leaned on.",
    note: "Nothing is a black box",
    icon: Brain,
  },
  {
    value: 100,
    suffix: "%",
    label: "Hype blocked",
    kicker: "Before ranking",
    copy: "Listicles and outcome promises never reach the shortlist — the guardrail runs first.",
    note: "Engagement is not the goal",
    icon: ShieldCheck,
  },
  {
    value: 60,
    suffix: "s",
    label: "Worth your time",
    kicker: "The unit of value",
    copy: "Each recommendation should leave you able to do something you couldn't sixty seconds ago.",
    note: "Skill, not vibes",
    icon: Sparkles,
  },
  {
    value: 0,
    suffix: "",
    label: "Keyword overlap",
    kicker: "Why over what",
    copy: "Upstream reads motivation underneath the feed — not the surface word that happened to appear.",
    note: "The laptop reel gives the game away",
    icon: Eye,
  },
];

function Count({ stat, run }: { stat: Stat; run: boolean }) {
  const [value, setValue] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!run) return;
    if (reduced) {
      setValue(stat.value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1300);
      setValue(stat.value * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, reduced, stat.value]);

  return (
    <>
      {stat.decimals ? value.toFixed(1) : Math.floor(value).toLocaleString("en-IN")}
      {stat.suffix}
    </>
  );
}

export function TrustSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.18 });
  const [active, setActive] = useState(0);
  const selected = stats[active];
  const Icon = selected.icon;

  return (
    <section id="trust" ref={ref} className="standard-v2">
      <div className="standard-v2__orb" aria-hidden="true" />
      <div className="standard-v2__head">
        <span>01 / THE UPSTREAM STANDARD</span>
        <h2>
          The scroll is
          <br />
          already <em>yours.</em>
        </h2>
        <p>We don&apos;t try to stop it. We make the current run somewhere.</p>
      </div>
      <div className="standard-v2__experience">
        <AnimatePresence mode="wait">
          <motion.aside
            key={active}
            className="standard-v2__feature"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="standard-v2__feature-top">
              <span>UP / {String(active + 1).padStart(2, "0")}</span>
              <Icon />
            </div>
            <strong>
              <Count stat={selected} run={inView} />
            </strong>
            <small>{selected.kicker}</small>
            <h3>{selected.label}</h3>
            <p>{selected.copy}</p>
            <i>{selected.note}</i>
          </motion.aside>
        </AnimatePresence>
        <div className="standard-v2__list">
          {stats.map((stat, index) => {
            const RowIcon = stat.icon;
            return (
              <button
                key={stat.label}
                type="button"
                className={active === index ? "is-active" : ""}
                onPointerEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onClick={() => setActive(index)}
                aria-pressed={active === index}
              >
                <span>0{index + 1}</span>
                <div>
                  <small>{stat.kicker}</small>
                  <b>{stat.label}</b>
                </div>
                <RowIcon />
                <i>↗</i>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
