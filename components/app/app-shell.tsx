"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Clapperboard,
  Code2,
  Compass,
  Home,
  PlusSquare,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { useViewer } from "@/components/auth/use-viewer";
import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  match?: (path: string) => boolean;
};

const NAV: NavItem[] = [
  { href: "/feed", label: "Home", icon: Home, match: (p) => p === "/feed" },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/reels", label: "Reels", icon: Clapperboard },
  { href: "/agent", label: "For you", icon: Sparkles, match: (p) => p === "/agent" || p.startsWith("/agent/") },
  { href: "/code-editor", label: "Code", icon: Code2, match: (p) => p === "/code-editor" || p.startsWith("/code-editor/") || p === "/lab" },
  { href: "/studio", label: "Create", icon: PlusSquare },
  { href: "/profile", label: "Profile", icon: User, match: (p) => p === "/profile" || p.startsWith("/profile/") },
];

const MOBILE_NAV: NavItem[] = [
  { href: "/feed", label: "Home", icon: Home, match: (p) => p === "/feed" },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/studio", label: "Create", icon: PlusSquare, match: (p) => p === "/studio" },
  { href: "/reels", label: "Reels", icon: Clapperboard },
  { href: "/agent", label: "For you", icon: Sparkles, match: (p) => p === "/agent" || p.startsWith("/agent/") },
  { href: "/profile", label: "Profile", icon: User, match: (p) => p === "/profile" || p.startsWith("/profile/") },
];

export function AppShell({
  children,
  variant = "feed",
}: {
  children: ReactNode;
  variant?: "feed" | "reels";
}) {
  const pathname = usePathname();
  const { viewer } = useViewer();
  const isReels = variant === "reels";

  return (
    <div className="theme-ig min-h-dvh bg-bg text-fg">
      <aside className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-bg px-3 py-6 lg:flex lg:w-[72px] xl:w-[244px]">
        <Link href="/feed" className="focus-ring mb-10 flex h-12 items-center px-3" aria-label="Home">
          <Wordmark size={28} className="hidden xl:inline" />
          <span className="font-script text-[28px] xl:hidden" aria-hidden>
            U
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
          {NAV.map((item) => {
            const active = item.match ? item.match(pathname) : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring group flex items-center gap-4 rounded-lg px-3 py-3 text-[16px] transition-colors hover:bg-white/8",
                  active ? "font-bold text-fg" : "font-normal text-fg",
                )}
              >
                <Icon
                  className="size-6 shrink-0"
                  strokeWidth={active ? 2.6 : 1.8}
                  aria-hidden
                />
                <span className="hidden xl:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {viewer.account && (
          <Link
            href="/profile"
            className="focus-ring mt-auto hidden items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/8 xl:flex"
          >
            <Avatar name={viewer.account.name} hue={24} size={28} />
            <span className="truncate text-[14px] font-medium">{viewer.account.name}</span>
          </Link>
        )}
      </aside>

      <main
        id="main"
        className={cn(
          "min-h-dvh",
          isReels ? "lg:pl-[72px] xl:pl-[244px]" : "pb-[52px] lg:pb-0 lg:pl-[72px] xl:pl-[244px]",
        )}
      >
        {children}
      </main>

      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex h-[52px] items-center justify-around border-t border-line bg-bg lg:hidden",
          isReels && "bg-black/80 backdrop-blur-xl",
        )}
        aria-label="Main"
      >
        {MOBILE_NAV.map((item) => {
          const active = item.match ? item.match(pathname) : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className="flex size-11 items-center justify-center text-fg"
            >
              <Icon className="size-6" strokeWidth={active ? 2.6 : 1.8} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
