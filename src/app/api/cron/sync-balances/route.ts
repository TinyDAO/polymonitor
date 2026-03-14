import { NextRequest, NextResponse } from "next/server";
import { syncAddressBalances } from "@/lib/sync-balances";

function validateCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  const secret = process.env.CRON_SECRET;
  return !!secret && !!token && token === secret;
}

export async function POST(req: NextRequest) {
  if (!validateCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { synced } = await syncAddressBalances();
    return NextResponse.json({ ok: true, synced });
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}
