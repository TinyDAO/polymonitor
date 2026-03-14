import { eq, inArray, desc } from "drizzle-orm";
import { db } from "./index";
import { users, kanbans, monitoredAddresses, addressSnapshots } from "./schema";

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
