import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserIdByWallet } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { kanbans, monitoredAddresses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { syncAddressBalances } from "@/lib/sync-balances";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const walletAddress = await requireAuth();
    const userId = await getUserIdByWallet(walletAddress);
    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const [kanban] = await db
      .select()
      .from(kanbans)
      .where(and(eq(kanbans.id, id), eq(kanbans.userId, userId)));

    if (!kanban) {
      return NextResponse.json({ error: "Kanban not found" }, { status: 404 });
    }

    const addresses = await db
      .select({ id: monitoredAddresses.id })
      .from(monitoredAddresses)
      .where(eq(monitoredAddresses.kanbanId, id));

    const addressIds = addresses.map((a) => a.id);
    if (addressIds.length === 0) {
      return NextResponse.json({ ok: true, synced: 0 });
    }

    const result = await syncAddressBalances(addressIds);
    return NextResponse.json({
      ok: true,
      synced: result.synced,
      ...(result.errors?.length && { errors: result.errors }),
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Sync error:", err);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}
