import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getUserIdByWallet,
  getKanbanMembersWithCreator,
} from "@/lib/db/queries";
import { isKanbanAdmin } from "@/lib/kanban-auth";
import { db } from "@/lib/db";
import { kanbans, kanbanMembers } from "@/lib/db/schema";
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
    if (!(await isKanbanAdmin(id, userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const members = await getKanbanMembersWithCreator(id);
    return NextResponse.json(members);
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const walletAddress = await requireAuth();
    const userId = await getUserIdByWallet(walletAddress);
    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id: kanbanId } = await params;
    if (!(await isKanbanAdmin(kanbanId, userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetUserId = req.nextUrl.searchParams.get("userId");
    if (!targetUserId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const [kanban] = await db
      .select({ userId: kanbans.userId })
      .from(kanbans)
      .where(eq(kanbans.id, kanbanId));
    if (!kanban || kanban.userId === targetUserId) {
      return NextResponse.json(
        { error: "Cannot remove the board creator" },
        { status: 400 }
      );
    }

    const result = await db
      .delete(kanbanMembers)
      .where(
        and(
          eq(kanbanMembers.kanbanId, kanbanId),
          eq(kanbanMembers.userId, targetUserId)
        )
      )
      .returning({ userId: kanbanMembers.userId });

    if (result.length === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
