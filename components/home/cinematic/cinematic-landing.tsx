import Link from "next/link";
import { AudienceFork } from "./audience-fork";
import { CinematicNav } from "./cinematic-nav";
import { FlightScroll } from "./flight-scroll";
import { JourneyBrief } from "./journey-brief";
import { TrustSection } from "./trust-section";
import "./cinematic.css";

/** TripNine-inspired scroll-scrub landing — canvas hero + glass editorial sections. */
export function CinematicLanding({ frameBase }: { frameBase: string }) {
  return (
    <div className="landing-cinematic">
      <CinematicNav />
      <main id="top">
        <FlightScroll frameBase={frameBase} />
        <AudienceFork />
        <TrustSection />
        <JourneyBrief />
      </main>
      <footer className="footer-v2">
        <div className="footer-v2__mast">
          <div>
            <p className="footer-v2__mark">↑</p>
            <p>
              Scroll-native.
              <br />
              Skill-bound.
            </p>
          </div>
          <h2>
            UP<em>STREAM</em>
          </h2>
        </div>
        <p className="footer-v2__positioning">
          A short-form feed that reads why you watched — not what you watched — and points the next
          sixty seconds somewhere worth going.
        </p>
        <div className="footer-v2__grid">
          <div>
            <small>PRODUCT</small>
            <Link href="/feed">Feed</Link>
            <Link href="/trap">Shallow vs Upstream</Link>
            <Link href="/agent">Agent console</Link>
          </div>
          <div>
            <small>ACCOUNT</small>
            <Link href="/signup">Create account</Link>
            <Link href="/login">Log in</Link>
            <Link href="/about">About</Link>
          </div>
        </div>
        <div className="footer-v2__bottom">
          <span>© {new Date().getFullYear()} UPSTREAM</span>
          <p>The goal was never to stop the scrolling.</p>
          <a href="#top">BACK TO THE FEED ↑</a>
        </div>
      </footer>
    </div>
  );
}
