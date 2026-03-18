import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserIdByWallet } from "@/lib/db/queries";
import { canAccessKanban } from "@/lib/kanban-auth";
import { db } from "@/lib/db";
import { monitoredAddresses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveProxyWallet } from "@/lib/polymarket";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function isValidAddress(addr: string): boolean {
  const normalized = addr.trim().toLowerCase();
  return ETH_ADDRESS_REGEX.test(normalized) || /^[a-fA-F0-9]{40}$/.test(normalized);
}

function normalizeAddress(addr: string): string {
  const a = addr.trim();
  return a.startsWith("0x") ? a.toLowerCase() : `0x${a.toLowerCase()}`;
}

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
    if (!(await canAccessKanban(id, userId))) {
      return NextResponse.json({ error: "Kanban not found" }, { status: 404 });
    }

    const addresses = await db
      .select()
      .from(monitoredAddresses)
      .where(eq(monitoredAddresses.kanbanId, id));

    return NextResponse.json(addresses);
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

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

    const { id } = await params;
    if (!(await canAccessKanban(id, userId))) {
      return NextResponse.json({ error: "Kanban not found" }, { status: 404 });
    }

    const body = await req.json();
    const address = normalizeAddress(body?.address ?? "");
    const label = body?.label?.trim() ?? "";

    if (!address || !isValidAddress(address)) {
      return NextResponse.json(
        { error: "Valid 0x address is required" },
        { status: 400 }
      );
    }
    if (!label) {
      return NextResponse.json(
        { error: "Label is required" },
        { status: 400 }
      );
    }

    const proxyWallet = await resolveProxyWallet(address);
    if (!proxyWallet) {
      return NextResponse.json(
        { error: "Address not found on Polymarket. Please use the address from a Polymarket profile URL." },
        { status: 400 }
      );
    }

    try {
      const [addr] = await db
        .insert(monitoredAddresses)
        .values({ kanbanId: id, address: proxyWallet, label })
        .returning();

      return NextResponse.json(addr!);
    } catch (e: unknown) {
      const msg = (e as { code?: string })?.code;
      if (msg === "23505") {
        return NextResponse.json(
          { error: "Address already exists in this kanban" },
          { status: 409 }
        );
      }
      throw e;
    }
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
