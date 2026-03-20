"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { useCallback } from "react";
import { motion } from "motion/react";
import { Logo } from "@/components/logo";
import { toast } from "sonner";

type InvitePageClientProps = {
  token: string;
  loggedIn: boolean;
};

type Invitation = {
  kanbanId: string;
  kanbanName: string;
  expiresAt: string;
};

export function InvitePageClient({ token, loggedIn }: InvitePageClientProps) {
  const router = useRouter();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<"expired" | "not_found" | null>(
    null
  );

  const fetchInvitation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    setInvitation(null);
    const res = await fetch(`/api/invitations/${token}`);
    if (res.ok) {
      const data = await res.json();
      setInvitation(data);
    } else {
      let err: { error?: string; code?: string } = {};
      try {
        err = await res.json();
      } catch {
        /* ignore */
      }
      if (res.status === 410 || err.code === "expired") {
        setErrorCode("expired");
      } else if (res.status === 404 || err.code === "not_found") {
        setErrorCode("not_found");
      } else {
        setErrorCode(null);
      }
      setError(err.error || "Invitation not found");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchInvitation();
  }, [fetchInvitation]);

  const signIn = useCallback(async () => {
    if (!address) return;
    try {
      const nonceRes = await fetch("/api/auth/nonce");
      const { nonce } = await nonceRes.json();
      const domain = window.location.host;
      const origin = window.location.origin;

      const message = new SiweMessage({
        domain,
        address,
        statement: "Sign in to Polymonitor",
        uri: origin,
        version: "1",
        chainId: 137,
        nonce,
      });

      const signature = await signMessageAsync({
        message: message.prepareMessage(),
      });

      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.prepareMessage(),
          signature,
        }),
      });

      if (res.ok) {
        router.push(`/invite/${token}`);
        router.refresh();
      }
    } catch (err) {
      console.error("Sign in error:", err);
    }
  }, [address, signMessageAsync, router, token]);

  async function handleAccept() {
    setAccepting(true);
    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Joined the board");
        router.push(`/dashboard/kanbans/${data.kanbanId}`);
        router.refresh();
      } else {
        toast.error(data.error || "Failed to join");
      }
    } catch {
      toast.error("Failed to join");
    } finally {
      setAccepting(false);
    }
  }

  async function handleDecline() {
    setDeclining(true);
    try {
      await fetch(`/api/invitations/${token}/decline`, {
        method: "POST",
      });
      toast.success("Invitation declined");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Failed to decline");
    } finally {
      setDeclining(false);
    }
  }

  if (loading) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg-base)]">
        <div className="flex items-center gap-3 text-[var(--text-secondary)]">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent-cyan)] border-t-transparent" />
          Loading...
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg-base)]">
        <div className="relative z-10 flex flex-col items-center gap-12 px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-5 text-center"
          >
            <Logo className="h-10 w-10 shrink-0 text-[var(--text-primary)] sm:h-12 sm:w-12" />
            <h1
              className="font-display text-3xl font-semibold tracking-tight sm:text-4xl"
              style={{ fontFamily: "var(--font-sora)" }}
            >
              <span className="text-[var(--text-primary)]">
                You&apos;ve been invited
              </span>
            </h1>
            <p className="max-w-sm text-[var(--text-secondary)]">
              Sign in to view the invitation and join the board.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <ConnectButton.Custom>
              {({ openConnectModal, mounted, account }) => {
                const connected = mounted && account;
                return (
                  <button
                    onClick={connected ? signIn : openConnectModal}
                    className="group min-w-[180px] rounded-full border border-[var(--border-default)] bg-transparent px-10 py-3.5 text-sm font-medium text-[var(--text-primary)] transition-all duration-300 hover:border-[var(--accent-cyan)] hover:bg-[var(--accent-cyan-dim)]"
                  >
                    Sign in
                  </button>
                );
              }}
            </ConnectButton.Custom>
          </motion.div>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    const title =
      errorCode === "expired"
        ? "邀请链接已过期"
        : errorCode === "not_found"
          ? "邀请无效或已失效"
          : "无法打开邀请";
    const description =
      errorCode === "expired"
        ? "该链接已超过有效期，请让看板管理员重新生成邀请链接。"
        : errorCode === "not_found"
          ? "链接可能已使用、已撤销或不存在，请向管理员索取新的邀请。"
          : error || "请稍后重试或联系管理员。";
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg-base)]">
        <div className="relative z-10 flex max-w-md flex-col items-center gap-6 px-6 text-center">
          <Logo className="h-10 w-10 shrink-0 text-[var(--text-primary)]" />
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              {description}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-[var(--border-default)] px-6 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent-cyan)] hover:bg-[var(--accent-cyan-dim)]"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg-base)]">
      <div className="relative z-10 flex flex-col items-center gap-10 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center sm:min-w-[360px]"
        >
          <Logo className="h-10 w-10 shrink-0 text-[var(--text-primary)]" />
          <div>
            <h1 className="font-display text-xl font-semibold text-[var(--text-primary)]">
              Join board
            </h1>
            <p className="mt-2 text-lg font-medium text-[var(--accent-cyan)]">
              {invitation.kanbanName}
            </p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              You&apos;ve been invited to join this board. Accept to get access.
            </p>
          </div>

          <div className="flex w-full gap-3">
            <button
              onClick={handleDecline}
              disabled={declining || accepting}
              className="flex-1 rounded-lg border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-base)] disabled:opacity-50"
            >
              {declining ? "..." : "Decline"}
            </button>
            <button
              onClick={handleAccept}
              disabled={declining || accepting}
              className="flex-1 rounded-lg border border-[var(--accent-cyan)] bg-[var(--accent-cyan)] px-4 py-2.5 text-sm font-medium text-[var(--bg-base)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {accepting ? "..." : "Accept"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
