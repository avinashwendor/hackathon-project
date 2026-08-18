/** Why a viewer disliked a reel — drives mutes and feed adjustments. */
export const DISLIKE_REASONS = [
  {
    id: "not_relevant",
    label: "Not relevant to what I'm learning",
    description: "We'll mute these topics and steer away.",
  },
  {
    id: "too_basic",
    label: "Too basic for my level",
    description: "We'll prefer intermediate and advanced explainers.",
  },
  {
    id: "too_advanced",
    label: "Too advanced right now",
    description: "We'll prefer beginner-friendly reels.",
  },
  {
    id: "too_much_hype",
    label: "Too much hype, not enough substance",
    description: "We'll rank practical explainers higher.",
  },
  {
    id: "wrong_topic",
    label: "Wrong topic entirely",
    description: "We'll mute this reel's topics.",
  },
  {
    id: "already_know",
    label: "I already know this",
    description: "We'll skip similar surface-level reels.",
  },
  {
    id: "other",
    label: "Something else",
    description: "Tell us briefly — we use it to refine your feed.",
  },
] as const;

export type DislikeReasonId = (typeof DISLIKE_REASONS)[number]["id"];

export const DISLIKE_REASON_IDS = new Set(DISLIKE_REASONS.map((r) => r.id));

export function dislikeReasonLabel(id: string): string {
  return DISLIKE_REASONS.find((r) => r.id === id)?.label ?? id;
}
