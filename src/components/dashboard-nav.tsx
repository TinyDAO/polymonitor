"use client";

import Link from "next/link";
import { SignOutButton } from "./sign-out-button";
import { Logo } from "./logo";

export function DashboardNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1920px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight transition-colors hover:text-[var(--accent-cyan)]"
          style={{ fontFamily: "var(--font-sora)" }}
        >
          <Logo className="h-6 w-6 shrink-0" />
          Polymonitor
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Kanbans
          </Link>
          <SignOutButton />
        </div>
      </div>
    </nav>
  );
}
