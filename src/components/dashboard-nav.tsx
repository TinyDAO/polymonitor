"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SignOutButton } from "./sign-out-button";

export function DashboardNav() {
  return (
    <nav className="border-b border-zinc-800 bg-zinc-900/50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/dashboard" className="text-xl font-semibold">
          Polymonitor
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-zinc-100"
          >
            Kanbans
          </Link>
          <SignOutButton />
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
}
