"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

const MERIDIANS = [0, 30, 60, 90, 120, 150];
const PARALLELS = [-46, 0, 46];
const LOUVERS = Array.from({ length: 9 }, (_, i) => i);
const RING = 2 * Math.PI * 92;

export function LoadingExperience({ progress, ready }: { progress: number; ready: boolean }) {
  useEffect(() => {
    document.body.classList.toggle("is-loading", !ready);
    return () => document.body.classList.remove("is-loading");
  }, [ready]);

  const value = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <AnimatePresence>
      {!ready && (
        <motion.div
          className="tn-loader"
          exit={{ transition: { duration: 0.9 } }}
          aria-live="polite"
          aria-label="Preparing the Upstream experience"
        >
          <div className="tn-loader__louvers" aria-hidden="true">
            {LOUVERS.map((index) => (
              <motion.i
                key={index}
                initial={{ rotateX: 0 }}
                exit={{ rotateX: -94 }}
                transition={{
                  duration: 0.72,
                  delay: 0.26 + index * 0.055,
                  ease: [0.76, 0, 0.24, 1],
                }}
              />
            ))}
          </div>

          <motion.div
            className="tn-loader__stage"
            exit={{ opacity: 0, scale: 1.14, filter: "blur(6px)" }}
            transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="tn-loader__globe" aria-hidden="true">
              <div className="tn-loader__sphere">
                {MERIDIANS.map((angle) => (
                  <i
                    key={`m${angle}`}
                    className="tn-loader__meridian"
                    style={{ transform: `rotateY(${angle}deg)` }}
                  />
                ))}
                {PARALLELS.map((offset) => (
                  <i
                    key={`p${offset}`}
                    className="tn-loader__parallel"
                    style={{
                      transform: `rotateX(90deg) translateZ(${offset}px) scale(${Math.sqrt(
                        Math.max(0, 1 - (offset / 78) ** 2),
                      ).toFixed(3)})`,
                    }}
                  />
                ))}
                <i className="tn-loader__route">
                  <b />
                </i>
              </div>
              <span className="tn-loader__core" />
            </div>

            <svg className="tn-loader__ring" viewBox="0 0 200 200" aria-hidden="true">
              <circle className="tn-loader__ring-track" cx="100" cy="100" r="92" />
              <circle
                className="tn-loader__ring-fill"
                cx="100"
                cy="100"
                r="92"
                strokeDasharray={RING}
                strokeDashoffset={RING * (1 - value / 100)}
              />
            </svg>

            <div className="tn-loader__readout">
              <strong>
                {String(value).padStart(2, "0")}
                <em>%</em>
              </strong>
            </div>
          </motion.div>

          <motion.p
            className="tn-loader__caption"
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.4 }}
          >
            <span>UPSTREAM</span>
            <i />
            <span>LOADING YOUR FEED</span>
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
