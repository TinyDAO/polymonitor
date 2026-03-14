import { NextRequest, NextResponse } from "next/server";
import { getPositionValue, resolveProxyWallet } from "@/lib/polymarket";
import { getUsdcBalance } from "@/lib/polygon";

/**
 * Debug endpoint: test balance fetch for an address.
 * GET /api/debug/balance?address=0x...
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address?.trim()) {
    return NextResponse.json(
      { error: "Missing address param" },
      { status: 400 }
    );
  }

  try {
    const proxyWallet = await resolveProxyWallet(address);
    if (!proxyWallet) {
      return NextResponse.json(
        { error: "Address not found on Polymarket" },
        { status: 400 }
      );
    }

    const [polymarketValue, usdcBalance] = await Promise.all([
      getPositionValue(proxyWallet),
      getUsdcBalance(proxyWallet as `0x${string}`),
    ]);

    return NextResponse.json({
      address,
      proxyWallet,
      polymarketValue,
      usdcBalance,
      totalValue: polymarketValue + usdcBalance,
    });
  } catch (err) {
    console.error("Debug balance error:", err);
    return NextResponse.json(
      {
        error: (err as Error).message,
        stack: (err as Error).stack,
      },
      { status: 500 }
    );
  }
}
