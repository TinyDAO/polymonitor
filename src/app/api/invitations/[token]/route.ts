import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserIdByWallet } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { kanbanInvitations, kanbans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const walletAddress = await requireAuth();
    const userId = await getUserIdByWallet(walletAddress);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await params;
    const [invitation] = await db
      .select({
        kanbanId: kanbanInvitations.kanbanId,
        expiresAt: kanbanInvitations.expiresAt,
        kanbanName: kanbans.name,
      })
      .from(kanbanInvitations)
      .innerJoin(kanbans, eq(kanbanInvitations.kanbanId, kanbans.id))
      .where(eq(kanbanInvitations.token, token));

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }
    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "Invitation expired" },
        { status: 410 }
      );
    }

    return NextResponse.json({
      kanbanId: invitation.kanbanId,
      kanbanName: invitation.kanbanName,
      expiresAt: invitation.expiresAt,
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
