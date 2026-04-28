import { createPublicClient, http, parseAbi } from "viem";
import { polygon } from "viem/chains";

// Polymarket usd
const USDC_E_ADDRESS = "0xc011a7e12a19f7b1f670d46f03b03f3342e82dfb" as const;
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

      const [usdcE] = await Promise.all([
        getTokenBalance(client, USDC_E_ADDRESS, address),
      ]);

      return usdcE ;
    } catch (err) {
      lastError = err as Error;
      continue;
    }
  }
  throw lastError ?? new Error("All Polygon RPCs failed");

}

