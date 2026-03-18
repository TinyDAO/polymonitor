import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserIdByWallet } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { kanbanInvitations, kanbanMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const walletAddress = await requireAuth();
    const userId = await getUserIdByWallet(walletAddress);
    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { token } = await params;
    const [invitation] = await db
      .select()
      .from(kanbanInvitations)
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

    try {
      await db
        .insert(kanbanMembers)
        .values({
          kanbanId: invitation.kanbanId,
          userId,
          role: "member",
        })
        .onConflictDoNothing({
          target: [kanbanMembers.kanbanId, kanbanMembers.userId],
        });
    } catch (e: unknown) {
      const msg = (e as { code?: string })?.code;
      if (msg === "23505") {
        return NextResponse.json(
          { error: "Already a member" },
          { status: 409 }
        );
      }
      throw e;
    }

    await db.delete(kanbanInvitations).where(eq(kanbanInvitations.token, token));

    return NextResponse.json({
      ok: true,
      kanbanId: invitation.kanbanId,
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
