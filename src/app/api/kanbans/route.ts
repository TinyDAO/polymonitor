import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserIdByWallet, getKanbansForUser } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { kanbans } from "@/lib/db/schema";

export async function GET() {
  try {
    const walletAddress = await requireAuth();
    const userId = await getUserIdByWallet(walletAddress);
    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const list = await getKanbansForUser(userId);
    return NextResponse.json(list);
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const walletAddress = await requireAuth();
    const userId = await getUserIdByWallet(walletAddress);
    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const name = body?.name?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const [kanban] = await db
      .insert(kanbans)
      .values({ userId, name })
      .returning();

    return NextResponse.json(kanban);
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
