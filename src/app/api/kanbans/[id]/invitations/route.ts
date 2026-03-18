import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserIdByWallet } from "@/lib/db/queries";
import { isKanbanAdmin } from "@/lib/kanban-auth";
import { db } from "@/lib/db";
import { kanbanInvitations } from "@/lib/db/schema";
import { randomBytes } from "crypto";

export async function POST(
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

    const body = await req.json().catch(() => ({}));
    const expiresInHours = Math.min(
      Math.max(Number(body?.expiresInHours) || 24, 1),
      168
    );
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    const token = randomBytes(32).toString("hex");
    await db.insert(kanbanInvitations).values({
      token,
      kanbanId,
      expiresAt,
    });

    const url = `${req.nextUrl.origin}/invite/${token}`;
    return NextResponse.json({ token, url, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
