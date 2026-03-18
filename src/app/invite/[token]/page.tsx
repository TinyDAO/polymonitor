import { getSession } from "@/lib/auth";
import { InvitePageClient } from "./invite-page-client";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const session = await getSession();
  const { token } = await params;

  return (
    <InvitePageClient
      token={token}
      loggedIn={!!session.walletAddress}
    />
  );
}
