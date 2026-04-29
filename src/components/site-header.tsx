"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, LogOut, UserRound } from "lucide-react";

import { signOutAccount, useAppSettings } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/upload", label: "Analyze" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
  { href: "/profiles", label: "Saved profiles" }
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const settings = useAppSettings();

  useEffect(() => {
    document
      .querySelectorAll<HTMLAnchorElement>('header a[href^="/"][target="_blank"]')
      .forEach((anchor) => anchor.removeAttribute("target"));
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 px-4 pt-4 lg:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-black/10 bg-white/75 px-5 py-3 shadow-soft backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-3" suppressHydrationWarning>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-bone shadow-soft">
            TL
          </div>
          <div>
            <p className="font-display text-xl font-semibold tracking-tight">ThankYouLove</p>
            <p className="text-[11px] uppercase tracking-[0.22em] text-black/42">
              Resume Optimizer
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full bg-black/[0.03] p-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              suppressHydrationWarning
              className={cn(
                "rounded-full px-4 py-2 text-sm transition",
                pathname === item.href
                  ? "bg-white font-medium text-black shadow-sm"
                  : "text-black/60 hover:text-black"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {settings.account.isLoggedIn ? (
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-black/10 bg-white/72 px-4 py-2 text-sm text-black/65 transition hover:text-black">
                <UserRound className="h-4 w-4" />
                {settings.account.name || "Account"}
              </summary>
              <div className="absolute right-0 top-12 z-50 w-56 rounded-[24px] border border-black/10 bg-white p-2 shadow-soft">
                <Link
                  href="/profile"
                  className="block rounded-2xl px-4 py-3 text-sm text-black/70 hover:bg-black/[0.04]"
                >
                  Open profile
                </Link>
                <button
                  type="button"
                  onClick={() => signOutAccount()}
                  className="flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </details>
          ) : (
            <Link
              href="/profile?next=%2Fsettings%3Fnext%3D%252Fupload&reason=login"
              suppressHydrationWarning
              className="rounded-full border border-black/10 bg-white/72 px-4 py-2 text-sm text-black/65"
            >
              Sign in
            </Link>
          )}
          <Link href="/upload" className="hidden md:block" suppressHydrationWarning>
            <Button variant="secondary">
              Start now
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
