import { eq, inArray, desc, or, asc } from "drizzle-orm";
import { db } from "./index";
import {
  users,
  kanbans,
  monitoredAddresses,
  addressSnapshots,
  kanbanMembers,
} from "./schema";

export async function getUserIdByWallet(walletAddress: string) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.walletAddress, walletAddress.toLowerCase()));
  return user?.id;
}

export async function getKanbanWithAddresses(kanbanId: string) {
  const [kanban] = await db
    .select()
    .from(kanbans)
    .where(eq(kanbans.id, kanbanId));
  if (!kanban) return null;

  const addrs = await db
    .select()
    .from(monitoredAddresses)
    .where(eq(monitoredAddresses.kanbanId, kanbanId));

  return { ...kanban, addresses: addrs };
}

export async function getKanbansForUser(userId: string) {
  const memberKanbanIds = await db
    .select({ kanbanId: kanbanMembers.kanbanId })
    .from(kanbanMembers)
    .where(eq(kanbanMembers.userId, userId));
  const ids = memberKanbanIds.map((m) => m.kanbanId);

  const rows = await db
    .select()
    .from(kanbans)
    .where(
      ids.length > 0
        ? or(eq(kanbans.userId, userId), inArray(kanbans.id, ids))
        : eq(kanbans.userId, userId)
    )
    .orderBy(asc(kanbans.createdAt));
  return rows;
}

export async function getKanbanMembers(kanbanId: string) {
  const rows = await db
    .select({
      userId: kanbanMembers.userId,
      role: kanbanMembers.role,
      walletAddress: users.walletAddress,
    })
    .from(kanbanMembers)
    .innerJoin(users, eq(users.id, kanbanMembers.userId))
    .where(eq(kanbanMembers.kanbanId, kanbanId));
  return rows;
}

export async function getKanbanMembersWithCreator(kanbanId: string) {
  const [kanban] = await db
    .select({ userId: kanbans.userId })
    .from(kanbans)
    .where(eq(kanbans.id, kanbanId));
  if (!kanban) return [];

  const [creatorUser] = await db
    .select({ id: users.id, walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, kanban.userId));
  if (!creatorUser) return [];

  const members = await getKanbanMembers(kanbanId);
  const creatorRow = {
    userId: creatorUser.id,
    role: "admin" as const,
    walletAddress: creatorUser.walletAddress,
  };
  const memberIds = new Set(members.map((m) => m.userId));
  if (memberIds.has(creatorRow.userId)) {
    return members.map((m) =>
      m.userId === creatorRow.userId ? { ...m, role: "admin" as const } : m
    );
  }
  return [creatorRow, ...members];
}

function toHourKey(d: Date): string {
  return d.toISOString().slice(0, 13);
}

/**
 * Get snapshots for chart. When aggregated=true, returns at most one snapshot
 * per address per hour (the latest), reducing noise from manual syncs.
 */
export async function getSnapshotsForAddresses(
  addressIds: string[],
  limitDays = 30,
  options?: { aggregated?: boolean }
) {
  if (addressIds.length === 0) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - limitDays);

  const snapshots = await db
    .select()
    .from(addressSnapshots)
    .where(inArray(addressSnapshots.addressId, addressIds))
    .orderBy(desc(addressSnapshots.createdAt))
    .limit(5000);

  const filtered = snapshots.filter((s) => new Date(s.createdAt) >= cutoff);

  if (options?.aggregated) {
    const seen = new Set<string>();
    return filtered.filter((s) => {
      const key = `${s.addressId}-${toHourKey(new Date(s.createdAt))}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return filtered;
}
