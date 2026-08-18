"use client";

import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { ArrowUpRight, Brain, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { landingScrollFrameUrl, LANDING_SCROLL_FRAME_COUNT } from "@/lib/media";
import { LoadingExperience } from "./loading-experience";

const TOTAL_FRAMES = LANDING_SCROLL_FRAME_COUNT;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function FlightScroll({ frameBase }: { frameBase: string }) {
  const containerRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const targetFrameRef = useRef(0);
  const currentFrameRef = useRef(0);
  const lastDrawnFrameRef = useRef(-1);
  const rafRef = useRef(0);
  const resizeRafRef = useRef(0);
  const animationRunningRef = useRef(false);
  const startRenderRef = useRef<() => void>(() => undefined);

  const [loadProgress, setLoadProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const smoothScrollProgress = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 32,
    mass: 0.22,
    restDelta: 0.0005,
  });
  const textProgress = reduced ? scrollYProgress : smoothScrollProgress;

  useEffect(() => {
    let loadedCount = 0;
    const images: HTMLImageElement[] = [];

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = landingScrollFrameUrl(frameBase, i);

      const checkComplete = () => {
        loadedCount += 1;
        setLoadProgress((loadedCount / TOTAL_FRAMES) * 100);
        if (loadedCount === TOTAL_FRAMES) setReady(true);
      };

      img.onload = checkComplete;
      img.onerror = checkComplete;
      images.push(img);
    }

    imagesRef.current = images;

    return () => {
      images.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    };
  }, [frameBase]);

  const drawFrame = useCallback((frameIndex: number, force = false) => {
    const canvas = canvasRef.current;
    if (!canvas || (!force && lastDrawnFrameRef.current === frameIndex)) return;

    const ctx = canvasContextRef.current ?? canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    canvasContextRef.current = ctx;

    const img = imagesRef.current[frameIndex];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const width = img.naturalWidth * scale;
    const height = img.naturalHeight * scale;

    ctx.drawImage(img, (canvas.width - width) * 0.5, (canvas.height - height) * 0.5, width, height);
    lastDrawnFrameRef.current = frameIndex;
  }, []);

  useEffect(() => {
    if (!ready) return;
    let disposed = false;

    const initialPos = clamp(scrollYProgress.get()) * (TOTAL_FRAMES - 1);
    targetFrameRef.current = initialPos;
    currentFrameRef.current = initialPos;
    drawFrame(Math.round(initialPos), true);

    const renderLoop = () => {
      if (disposed) return;
      const delta = targetFrameRef.current - currentFrameRef.current;

      if (Math.abs(delta) <= 0.01) {
        currentFrameRef.current = targetFrameRef.current;
        drawFrame(Math.round(currentFrameRef.current));
        animationRunningRef.current = false;
        rafRef.current = 0;
        return;
      }

      currentFrameRef.current += delta * 0.28;
      drawFrame(Math.round(clamp(currentFrameRef.current, 0, TOTAL_FRAMES - 1)));
      rafRef.current = requestAnimationFrame(renderLoop);
    };

    startRenderRef.current = () => {
      if (animationRunningRef.current) return;
      animationRunningRef.current = true;
      rafRef.current = requestAnimationFrame(renderLoop);
    };

    return () => {
      disposed = true;
      startRenderRef.current = () => undefined;
      animationRunningRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [ready, drawFrame, scrollYProgress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      resizeRafRef.current = 0;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(canvas.clientWidth * dpr);
      const height = Math.round(canvas.clientHeight * dpr);
      if (!width || !height || (canvas.width === width && canvas.height === height)) return;

      canvas.width = width;
      canvas.height = height;
      lastDrawnFrameRef.current = -1;
      drawFrame(Math.round(currentFrameRef.current), true);
    };

    const scheduleResize = () => {
      if (!resizeRafRef.current) resizeRafRef.current = requestAnimationFrame(resizeCanvas);
    };

    resizeCanvas();
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(canvas);
    window.addEventListener("resize", scheduleResize, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleResize);
      cancelAnimationFrame(resizeRafRef.current);
    };
  }, [drawFrame]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (!ready || reduced) return;
    targetFrameRef.current = clamp(latest) * (TOTAL_FRAMES - 1);
    startRenderRef.current();
  });

  const heroOpacity = useTransform(textProgress, [0, 0.018, 0.18], [1, 1, 0]);
  const heroScale = useTransform(textProgress, [0, 0.18], reduced ? [1, 1] : [1, 0.965]);
  const heroY = useTransform(textProgress, [0, 0.18], reduced ? [0, 0] : [0, -56]);

  const scene2Opacity = useTransform(textProgress, [0.21, 0.28, 0.54, 0.61], [0, 1, 1, 0]);
  const scene2X = useTransform(
    textProgress,
    [0.21, 0.28, 0.54, 0.61],
    reduced ? [0, 0, 0, 0] : [-42, 0, 0, -24],
  );

  const scene3Opacity = useTransform(textProgress, [0.61, 0.68, 0.93, 0.99], [0, 1, 1, 0]);
  const scene3X = useTransform(
    textProgress,
    [0.61, 0.68, 0.93, 0.99],
    reduced ? [0, 0, 0, 0] : [42, 0, 0, 24],
  );

  return (
    <>
      <LoadingExperience progress={loadProgress} ready={ready} />
      <section ref={containerRef} id="story" className="flight-scroll">
        <div className="flight-stage">
          <canvas ref={canvasRef} className="flight-canvas" />
          <div className="flight-vignette" />

          <motion.div
            className="hero-window-overlay"
            style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
          >
            <div className="hero-window-content">
              <h1>
                Scroll Like You Always Do
                <br />
                <em>Arrive Somewhere New</em>
              </h1>
              <p>
                Upstream reads why you watched — not what you watched — and points the next sixty
                seconds at something that leaves you able to do a thing you couldn&apos;t before.
              </p>
              <Link href="/signup" className="hero-pill-btn">
                Start scrolling smarter <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </motion.div>

          <motion.div
            className="story-scene-overlay scene-left-aligned"
            style={{ opacity: scene2Opacity, x: scene2X }}
          >
            <div className="editorial-side-card">
              <span className="editorial-accent-line" />
              <div className="editorial-text-wrap">
                <small className="scene-tag">01 — BEYOND KEYWORDS</small>
                <h2>
                  Every Signal.
                  <br />
                  <em>Actually Read.</em>
                </h2>
                <p>
                  Watch time, saves, replays, skips — Upstream climbs an abstraction ladder before
                  it recommends anything.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="story-scene-overlay scene-right-aligned"
            style={{ opacity: scene3Opacity, x: scene3X }}
          >
            <div className="editorial-side-card right">
              <span className="editorial-accent-line" />
              <div className="editorial-text-wrap">
                <small className="scene-tag">02 — LEAVE WITH A SKILL</small>
                <h2>
                  Not Another
                  <br />
                  <em>Java Meme.</em>
                </h2>
                <p>
                  A shallow system sees one word. Upstream sees a person deciding who they are going
                  to be — and serves the reel that teaches.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="floating-glass-card bottom-left-card"
            style={{ opacity: heroOpacity }}
          >
            <div className="card-icon-badge">
              <Brain size={18} />
            </div>
            <div className="card-text">
              <h3>Intent, Not Tags</h3>
              <p>
                Surface → domain → motivation. The agent shows its working at every stage so you can
                trust the next recommendation.
              </p>
            </div>
          </motion.div>

          <motion.div
            className="floating-glass-card bottom-right-card"
            style={{ opacity: heroOpacity }}
          >
            <div className="card-icon-badge">
              <Sparkles size={18} />
            </div>
            <div className="card-text">
              <h3>Hype Guardrail Built In</h3>
              <p>
                &ldquo;10 AI tools that will get you a job&rdquo; never reaches the shortlist. High
                engagement on anxiety gets an honest answer instead.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
