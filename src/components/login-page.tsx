"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Logo } from "./logo";

export function LoginPage() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const router = useRouter();

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
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      console.error("Sign in error:", err);
    }
  }, [address, signMessageAsync, router]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg-base)]">
      <div className="relative z-10 flex flex-col items-center gap-16 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-5 text-center"
        >
          <Logo className="h-10 w-10 shrink-0 text-[var(--text-primary)] sm:h-12 sm:w-12" />
          <h1
            className="font-display text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl"
            style={{ fontFamily: "var(--font-sora)" }}
          >
            <span className="text-[var(--text-primary)]">Polymonitor</span>
          </h1>
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
