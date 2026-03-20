import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserIdByWallet } from "@/lib/db/queries";
import { canAccessKanban, isKanbanAdmin } from "@/lib/kanban-auth";
import { db } from "@/lib/db";
import { monitoredAddresses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
      .where(eq(monitoredAddresses.id, id));

    if (!addr) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    if (!(await canAccessKanban(addr.kanbanId, userId))) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    if (!(await isKanbanAdmin(addr.kanbanId, userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
