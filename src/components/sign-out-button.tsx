"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
    >
      Sign out
    </button>
  );
}
