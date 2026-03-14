const DATA_API_BASE = "https://data-api.polymarket.com";
const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

export interface PolymarketValueResponse {
  user: string;
  value: number;
}

/**
 * Resolve address to proxy wallet. Polymarket stores positions/USDC in proxy wallet.
 * Profile URL may show EOA - we need proxy wallet for value/balance queries.
 * Returns null if no Polymarket profile found (invalid/unknown address).
 */
export async function resolveProxyWallet(
  address: string
): Promise<string | null> {
  const normalized = address.trim().toLowerCase();
  try {
    const res = await fetch(
      `${GAMMA_API_BASE}/public-profile?address=${encodeURIComponent(normalized)}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { proxyWallet?: string };
    const proxy = data.proxyWallet?.toLowerCase();
    return proxy ?? normalized;
  } catch {
    return null;
  }
}

export async function getPositionValue(address: string): Promise<number> {
  const res = await fetch(
    `${DATA_API_BASE}/value?user=${encodeURIComponent(address)}`
  );
  if (!res.ok) {
    throw new Error(`Polymarket API error: ${res.status}`);
  }
  const data: PolymarketValueResponse[] = await res.json();
  return data[0]?.value ?? 0;
}
