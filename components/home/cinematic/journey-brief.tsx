"use client";

import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function JourneyBrief() {
  return (
    <section id="contact" className="journey-brief">
      <motion.div
        className="journey-brief__inner"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <span>READY WHEN YOU ARE</span>
        <h2>
          They&apos;re going to scroll
          <br />
          <em>either way.</em>
        </h2>
        <p>
          Create an account, watch a few reels, and see what Upstream infers underneath your feed.
          Your watch history stays on your account — readable and deletable from Profile.
        </p>
        <div className="journey-brief__actions">
          <Link href="/signup" className="journey-brief__primary">
            Create an account <ArrowUpRight size={18} />
          </Link>
          <Link href="/about" className="journey-brief__secondary">
            Read the full story
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
