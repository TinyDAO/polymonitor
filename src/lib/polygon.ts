import { createPublicClient, http, parseAbi } from "viem";
import { polygon } from "viem/chains";

// Polymarket uses USDC.e (Bridged USDC) as collateral - https://docs.polymarket.com/resources/contract-addresses
const USDC_E_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;
// Native USDC on Polygon (some users may hold this)
const USDC_NATIVE_ADDRESS = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" as const;

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

async function getTokenBalance(
  client: ReturnType<typeof createPublicClient>,
  tokenAddress: `0x${string}`,
  ownerAddress: `0x${string}`
): Promise<number> {
  const [balance, decimals] = await Promise.all([
    client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [ownerAddress],
    }),
    client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "decimals",
    }),
  ]);
  return Number(balance) / 10 ** Number(decimals);
}

const POLYGON_RPC_URLS = [
  process.env.POLYGON_RPC_URL,
  "https://polygon-rpc.com",
  "https://rpc.ankr.com/polygon",
  "https://polygon-bor-rpc.publicnode.com",
].filter(Boolean) as string[];

export async function getUsdcBalance(address: `0x${string}`): Promise<number> {
  let lastError: Error | null = null;
  for (const rpcUrl of POLYGON_RPC_URLS) {
    try {
      const client = createPublicClient({
        chain: polygon,
        transport: http(rpcUrl, { timeout: 15_000 }),
      });

      const [usdcE, usdcNative] = await Promise.all([
        getTokenBalance(client, USDC_E_ADDRESS, address),
        getTokenBalance(client, USDC_NATIVE_ADDRESS, address),
      ]);

      return usdcE + usdcNative;
    } catch (err) {
      lastError = err as Error;
      continue;
    }
  }
  throw lastError ?? new Error("All Polygon RPCs failed");

}

