import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserIdByWallet, getKanbanWithAddresses, getSnapshotsForAddresses } from "@/lib/db/queries";
import { canAccessKanban } from "@/lib/kanban-auth";

export async function GET(
  req: NextRequest,
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

    const days = parseInt(req.nextUrl.searchParams.get("days") ?? "365", 10);
    const limitDays = Math.min(Math.max(days, 1), 365);
    const aggregated =
      req.nextUrl.searchParams.get("aggregated") !== "false";

    const addressIds = kanban.addresses.map((a) => a.id);
    const snapshots = await getSnapshotsForAddresses(addressIds, limitDays, {
      aggregated,
    });

    return NextResponse.json(snapshots);
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
