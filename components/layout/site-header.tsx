"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useViewer } from "@/components/auth/use-viewer";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/feed", label: "Feed" },
  { href: "/agent", label: "Agent" },
  { href: "/code-editor", label: "Code editor" },
  { href: "/lab", label: "Lab" },
  { href: "/trap", label: "The trap" },
  { href: "/library", label: "Library" },
  { href: "/profile", label: "Profile" },
];

export function SiteHeader({ className }: { className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { viewer } = useViewer();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl backdrop-saturate-150",
        className,
      )}
    >
      <div className="flex h-16 items-center gap-6 px-5 sm:h-20 sm:px-10 lg:px-16">
        <Link href="/" className="focus-ring rounded-sm" aria-label="Upstream home">
          <Logo size={24} />
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring rounded-sm px-3 py-2 text-[14px] font-medium transition-colors",
                  active ? "text-primary-500" : "text-fg-muted hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          {viewer.signedIn ? (
            <Link href="/feed" className={buttonClasses({ size: "md" })}>
              Open feed
            </Link>
          ) : (
            <>
              <Link href="/login" className="focus-ring rounded-sm text-[14px] font-medium text-fg-muted transition-colors hover:text-fg">
                Log in
              </Link>
              <Link href="/signup" className={buttonClasses({ size: "md" })}>
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="focus-ring ml-auto rounded-sm p-2 text-fg md:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-line px-5 py-3 md:hidden" aria-label="Main">
          {[
            ...NAV,
            { href: "/code-editor", label: "Code editor" },
            { href: "/lab", label: "Lab" },
            { href: "/studio", label: "Studio" },
            ...(viewer.signedIn
              ? []
              : [
                  { href: "/login", label: "Log in" },
                  { href: "/signup", label: "Sign up" },
                ]),
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="focus-ring block rounded-sm px-2 py-3 text-[15px] font-medium text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
