import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserIdByWallet, getKanbanWithAddresses } from "@/lib/db/queries";
import { canAccessKanban } from "@/lib/kanban-auth";
import { db } from "@/lib/db";
import { kanbans } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
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
    const kanban = await getKanbanWithAddresses(id);
    if (!kanban || !(await canAccessKanban(id, userId))) {
      return NextResponse.json({ error: "Kanban not found" }, { status: 404 });
    }

    return NextResponse.json(kanban);
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

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
    const [kanban] = await db
      .select()
      .from(kanbans)
      .where(and(eq(kanbans.id, id), eq(kanbans.userId, userId)));

    if (!kanban) {
      return NextResponse.json({ error: "Kanban not found" }, { status: 404 });
    }

    await db.delete(kanbans).where(eq(kanbans.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
