import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserIdByWallet } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { kanbans, monitoredAddresses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
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
    const [addr] = await db
      .select({
        id: monitoredAddresses.id,
        kanbanId: monitoredAddresses.kanbanId,
      })
      .from(monitoredAddresses)
      .innerJoin(kanbans, eq(monitoredAddresses.kanbanId, kanbans.id))
      .where(
        and(
          eq(monitoredAddresses.id, id),
          eq(kanbans.userId, userId)
        )
      );

    if (!addr) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    await db.delete(monitoredAddresses).where(eq(monitoredAddresses.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
