import type { Metadata, Viewport } from "next";
import { Grand_Hotel, Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], display: "swap" });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap" });
const grandHotel = Grand_Hotel({
  weight: "400",
  variable: "--font-grand-hotel",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Upstream — the scroll that takes you somewhere",
    template: "%s · Upstream",
  },
  description:
    "Upstream reads why you watched, not what you watched. It infers the interest underneath your feed and points it at technical content worth your next sixty seconds.",
  openGraph: {
    title: "Upstream",
    description: "The recommendation agent that reads why you watched, not what you watched.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#fbf8f5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${jetbrains.variable} ${grandHotel.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* First tab stop on every page — the feed is a long scroller and
            keyboard users should not have to walk it to reach the content. */}
        <a
          href="#main"
          className="focus-ring sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[200] focus:rounded-md focus:bg-primary-500 focus:px-4 focus:py-2.5 focus:text-[14px] focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
