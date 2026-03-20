import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kanbanInvitations, kanbans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Public: anyone with the link can check invite status (no auth).
 * Used by /invite/[token] to show expired / invalid before sign-in.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
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
    return NextResponse.json(
      { error: "Invitation not found", code: "not_found" },
      { status: 404 }
    );
  }
  if (new Date(invitation.expiresAt) < new Date()) {
    return NextResponse.json(
      {
        error: "Invitation expired",
        code: "expired",
        expiresAt: invitation.expiresAt,
      },
      { status: 410 }
    );
  }

  return NextResponse.json({
    kanbanId: invitation.kanbanId,
    kanbanName: invitation.kanbanName,
    expiresAt: invitation.expiresAt,
  });
}
