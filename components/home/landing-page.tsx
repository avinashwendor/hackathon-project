import { CinematicLanding } from "@/components/home/cinematic/cinematic-landing";
import { resolveLandingScrollFrameBase } from "@/lib/media";

/** Public home — TripNine-style scroll-scrub hero when logged out. */
export function LandingPage() {
  return <CinematicLanding frameBase={resolveLandingScrollFrameBase()} />;
}
