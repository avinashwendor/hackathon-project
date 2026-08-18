"use client";

import { motion } from "motion/react";
import { ArrowUpRight, Compass, Play } from "lucide-react";
import Link from "next/link";

const paths = [
  {
    href: "/signup",
    icon: Play,
    kicker: "Ready to scroll",
    title: "Create an account",
    copy: "Sign up, scroll reels, and let Upstream infer what you are actually trying to learn from your watch history.",
    action: "Get started",
  },
  {
    href: "/trap",
    icon: Compass,
    kicker: "Skeptical by nature",
    title: "See the trap",
    copy: "Run the same viewing history through a keyword recommender and through Upstream — side by side, with evidence.",
    action: "Compare recommenders",
  },
];

export function AudienceFork() {
  return (
    <section id="paths" className="audience-fork" aria-label="Choose how to start">
      <div className="audience-fork__head">
        <span>HOW DO YOU WANT IN?</span>
        <p>
          Upstream is a scroll-native learning feed — for <em>curious students</em> and{" "}
          <em>skeptical reviewers</em> alike. Pick your entry point.
        </p>
      </div>
      <div className="audience-fork__paths">
        {paths.map((path, index) => {
          const Icon = path.icon;
          return (
            <motion.div
              key={path.href}
              initial={{ opacity: 0, y: 34 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link href={path.href} className="audience-fork__card">
                <Icon aria-hidden="true" />
                <small>{path.kicker}</small>
                <h3>{path.title}</h3>
                <p>{path.copy}</p>
                <b>
                  {path.action} <ArrowUpRight size={16} />
                </b>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
