import { db } from "@/lib/db";
import { monitoredAddresses, addressSnapshots } from "@/lib/db/schema";
import { getPositionValue } from "@/lib/polymarket";
import { getUsdcBalance } from "@/lib/polygon";
import { inArray } from "drizzle-orm";

function toEthAddress(addr: string): `0x${string}` {
  const a = addr.trim();
  return (a.startsWith("0x") ? a : `0x${a}`) as `0x${string}`;
}

export async function syncAddressBalances(addressIds?: string[]): Promise<{
  synced: number;
  errors?: string[];
}> {
  const addresses = addressIds
    ? await db
        .select()
        .from(monitoredAddresses)
        .where(inArray(monitoredAddresses.id, addressIds))
    : await db.select().from(monitoredAddresses);

  const errors: string[] = [];

  for (const addr of addresses) {
    try {
      const ethAddr = toEthAddress(addr.address);
      const [polymarketValue, usdcBalance] = await Promise.all([
        getPositionValue(addr.address),
        getUsdcBalance(ethAddr),
      ]);

      const totalValue = polymarketValue + usdcBalance;

      await db.insert(addressSnapshots).values({
        addressId: addr.id,
        polymarketValue: polymarketValue.toString(),
        usdcBalance: usdcBalance.toString(),
        totalValue: totalValue.toString(),
      });
    } catch (err) {
      const msg = `${addr.address.slice(0, 10)}...: ${(err as Error).message}`;
      errors.push(msg);
      console.error(`Failed to sync address ${addr.id}:`, err);
    }
  }

  return {
    synced: addresses.length - errors.length,
    ...(errors.length > 0 && { errors }),
  };
}
