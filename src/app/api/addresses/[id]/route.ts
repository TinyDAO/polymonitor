import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserIdByWallet } from "@/lib/db/queries";
import { canAccessKanban, isKanbanAdmin } from "@/lib/kanban-auth";
import { db } from "@/lib/db";
import { monitoredAddresses } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";
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

/**
 * Update label and/or Polymarket address on the same monitored row.
 * Snapshots stay on this row (same address_id); no snapshot rows are rewritten.
 */
export async function PATCH(
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
    const [current] = await db
      .select()
      .from(monitoredAddresses)
      .where(eq(monitoredAddresses.id, id));

    if (!current) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    if (!(await canAccessKanban(current.kanbanId, userId))) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    if (!(await isKanbanAdmin(current.kanbanId, userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as {
      address?: string;
      label?: string;
    };

    const hasAddr = body.address !== undefined;
    const hasLabel = body.label !== undefined;

    if (!hasAddr && !hasLabel) {
      return NextResponse.json(
        { error: "Provide address and/or label" },
        { status: 400 }
      );
    }

    let nextAddress = current.address;
    if (hasAddr) {
      const raw = normalizeAddress(String(body.address ?? ""));
      if (!raw || !isValidAddress(raw)) {
        return NextResponse.json(
          { error: "Valid 0x address is required" },
          { status: 400 }
        );
      }
      const proxyWallet = await resolveProxyWallet(raw);
      if (!proxyWallet) {
        return NextResponse.json(
          {
            error:
              "Address not found on Polymarket. Please use the address from a Polymarket profile URL.",
          },
          { status: 400 }
        );
      }
      nextAddress = proxyWallet;
    }

    let nextLabel = current.label;
    if (hasLabel) {
      const trimmed = String(body.label ?? "").trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Label is required" }, { status: 400 });
      }
      nextLabel = trimmed;
    }

    if (nextAddress.toLowerCase() !== current.address.toLowerCase()) {
      const [conflict] = await db
        .select({ id: monitoredAddresses.id })
        .from(monitoredAddresses)
        .where(
          and(
            eq(monitoredAddresses.kanbanId, current.kanbanId),
            eq(monitoredAddresses.address, nextAddress),
            ne(monitoredAddresses.id, id)
          )
        )
        .limit(1);
      if (conflict) {
        return NextResponse.json(
          { error: "Address already exists in this kanban" },
          { status: 409 }
        );
      }
    }

    try {
      const [updated] = await db
        .update(monitoredAddresses)
        .set({
          address: nextAddress,
          label: nextLabel,
        })
        .where(eq(monitoredAddresses.id, id))
        .returning();

      return NextResponse.json(updated!);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "23505") {
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
