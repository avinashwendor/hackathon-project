"use client";

import dynamic from "next/dynamic";
import { AppShell } from "@/components/app/app-shell";

const MonacoCodeEditor = dynamic(() => import("@/components/MonacoCodeEditor"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-line bg-surface p-8 text-center text-fg-muted">
      Loading practice lab…
    </div>
  ),
});

const SAMPLE_LAB = {
  title: "Rewrite one resume bullet",
  initialCode: `// Task: turn a vague resume bullet into a measurable outcome.
// Example input bullet is below. Return a stronger version.

function improveBullet(bullet) {
  // TODO: add metric, scope, and verb
  return bullet;
}

const input = "Worked on backend APIs for the team";
console.log(JSON.stringify(improveBullet(input)));
`,
  solutionCode: `function improveBullet(bullet) {
  return bullet
    .replace(/^Worked on/i, "Shipped")
    .concat(" — cut p95 latency 18% across 3 services");
}

const input = "Worked on backend APIs for the team";
console.log(JSON.stringify(improveBullet(input)));
`,
  testCases: [
    {
      input: 'improveBullet("Built features")',
      expectedOutput: "Built features",
      description: "Returns a string (starter — replace with your metric)",
    },
    {
      input: 'typeof improveBullet("x")',
      expectedOutput: "string",
      description: "Function returns a string",
    },
  ],
};

export function LabExperience() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-8">
        <header className="mb-6 max-w-2xl">
          <p className="text-small font-medium uppercase tracking-wider text-primary-600">Practice lab</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-fg">Code while the feed runs</h1>
          <p className="mt-3 text-[15px] leading-7 text-fg-muted">
            Same Monaco workspace pattern as AuMinds: multi-file editor, stdout console, live HTML preview,
            and test cases. Use this after the agent recommends a career or DSA reel.
          </p>
        </header>
        <MonacoCodeEditor
          title={SAMPLE_LAB.title}
          language="javascript"
          initialCode={SAMPLE_LAB.initialCode}
          solutionCode={SAMPLE_LAB.solutionCode}
          testCases={SAMPLE_LAB.testCases}
        />
      </div>
    </AppShell>
  );
}
