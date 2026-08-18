import { TOPIC_BY_ID } from "@/data/ontology";
import type { Reel } from "@/lib/types";
import { dislikeReasonLabel } from "@/lib/social/dislike-reasons";

export function topicLabels(reel: Reel, max = 3): string[] {
  return reel.topics
    .map((id) => TOPIC_BY_ID.get(id)?.label ?? id)
    .filter(Boolean)
    .slice(0, max);
}

export function likeFeedbackMessage(reel: Reel): { title: string; body: string } {
  const labels = topicLabels(reel);
  const focus = labels.length ? labels.join(", ") : reel.category;
  return {
    title: "Got it — we'll lean this way",
    body: `Because you liked this, your next reels will focus more on ${focus}.`,
  };
}

export function dislikeFeedbackMessage(
  reel: Reel,
  reason: string,
  detail?: string,
): { title: string; body: string } {
  const labels = topicLabels(reel, 2);
  const topicPhrase = labels.length ? labels.join(" and ") : reel.category;
  const reasonLabel = dislikeReasonLabel(reason).toLowerCase();

  if (reason === "other" && detail) {
    return {
      title: "Feed updated",
      body: `We'll steer away from this and factor in: “${detail}”.`,
    };
  }

  if (reason === "too_basic") {
    return {
      title: "Feed updated",
      body: "We'll show more intermediate and advanced explainers next.",
    };
  }

  if (reason === "too_advanced") {
    return {
      title: "Feed updated",
      body: "We'll prefer beginner-friendly reels that build foundations first.",
    };
  }

  if (reason === "too_much_hype") {
    return {
      title: "Feed updated",
      body: "We'll rank practical, substance-first reels higher for you.",
    };
  }

  return {
    title: "Feed updated",
    body: `Marked as ${reasonLabel}. We'll show less on ${topicPhrase}.`,
  };
}
