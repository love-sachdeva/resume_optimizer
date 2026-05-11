"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <header className="sticky top-0 z-40 border-b border-foreground/15 bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/" className="group flex items-center gap-2" aria-label="ThankYouLove home">
          <span className="relative inline-flex h-7 w-7 items-center justify-center border-2 border-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
            <span className="display text-lg leading-none">T</span>
            <span className="absolute -right-1 -top-1 h-2 w-2 bg-primary group-hover:bg-foreground" />
          </span>
          <span className="mono text-[11px] uppercase tracking-[0.2em]">ThankYouLove / Optimizer</span>
        </Link>

        <nav className="hidden items-center gap-8 mono text-[11px] uppercase tracking-[0.18em] md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "link-underline transition-colors hover:text-primary",
                pathname === item.href ? "text-primary" : "text-foreground/70"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {settings.account.isLoggedIn ? (
            <details className="group relative">
              <summary className="mono flex cursor-pointer list-none items-center gap-2 border-2 border-foreground px-4 py-3 text-[11px] uppercase tracking-[0.18em] transition hover:border-primary hover:text-primary">
                <UserRound className="h-4 w-4" />
                {settings.account.name || "Account"}
              </summary>
              <div className="absolute right-0 top-14 z-50 w-56 border-2 border-foreground bg-background p-2 shadow-soft">
                <Link
                  href="/profile"
                  className="block px-4 py-3 text-sm text-foreground/70 hover:bg-foreground hover:text-background"
                >
                  Open profile
                </Link>
                <button
                  type="button"
                  onClick={() => signOutAccount()}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </details>
          ) : (
            <Link
              href="/account?next=%2Fsettings%3Fnext%3D%252Fupload&reason=login"
              className="mono border-2 border-foreground px-4 py-3 text-[11px] uppercase tracking-[0.18em] transition hover:border-primary hover:text-primary"
            >
              Sign in
            </Link>
          )}
          <Link href="/upload" className="hidden md:block">
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
