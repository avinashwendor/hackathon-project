"use client";

import dynamic from "next/dynamic";

const BrowserCodeEditor = dynamic(() => import("@/components/BrowserCodeEditor"), {
  ssr: false,
  loading: () => (
    <main className="grid min-h-screen place-items-center bg-[#0B0F17] text-white">
      <p className="font-mono text-sm text-[#919EAB]">Loading browser IDE…</p>
    </main>
  ),
});

export default function CodeEditorPage() {
  return <BrowserCodeEditor />;
}
