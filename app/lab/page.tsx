import type { Metadata } from "next";
import { LabExperience } from "@/components/lab/lab-experience";

export const metadata: Metadata = {
  title: "Code lab",
  description: "Monaco IDE with run, preview, and test cases — practice while you scroll.",
};

export default function LabPage() {
  return <LabExperience />;
}
