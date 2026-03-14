"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

export function LoginPage() {
  const { address, isConnected } = useAccount();
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

  useEffect(() => {
    if (isConnected && address) {
      signIn();
    }
  }, [isConnected, address, signIn]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-md space-y-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Polymonitor</h1>
        <p className="text-zinc-400">
          Monitor your Polymarket account balances and positions. Sign in with
          your Ethereum wallet.
        </p>
        <div className="flex justify-center">
          <ConnectButton />
        </div>
      </div>
    </div>
  );
}
