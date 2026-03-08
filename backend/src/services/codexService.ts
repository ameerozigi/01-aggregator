import { Codex } from "@codex-data/sdk";

let sdk: Codex | null = null;
function getSdk(): Codex | null {
  if (!sdk) {
    const key = process.env.CODEX_API_KEY;
    if (!key) {
      return null;
    }
    sdk = new Codex(key);
  }
  return sdk;
}

interface PoolData {
  dex: string;
  pair: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  fee: number;
}

export async function getPoolsForPair(tokenA: string, tokenB: string): Promise<PoolData[]> {
  try {
    const client: any = getSdk();
    if (!client) return [];
    const pools = await client.getPools({
      tokenA,
      tokenB,
      minLiquidity: 1000
    });

    return pools.map((pool: any) => ({
      dex: pool.dex,
      pair: pool.pair,
      token0: pool.token0.address,
      token1: pool.token1.address,
      reserve0: pool.reserve0,
      reserve1: pool.reserve1,
      fee: pool.fee
    }));
  } catch (error) {
    console.error("Codex pool fetch failed:", error);
    return [];
  }
}

export async function getQuoteFromPools(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  pools: PoolData[]
) {
  const bestPools = pools.sort((a, b) => {
    const priceA = calculatePrice(a, tokenIn, tokenOut);
    const priceB = calculatePrice(b, tokenIn, tokenOut);
    return priceB - priceA;
  });

  return {
    pools: bestPools.slice(0, 3),
    expectedOut: calculateOutput(bestPools[0], tokenIn, tokenOut, amountIn)
  };
}

function calculatePrice(pool: PoolData, tokenIn: string, tokenOut: string): number {
  const isToken0In = pool.token0.toLowerCase() === tokenIn.toLowerCase();
  const reserveIn = isToken0In ? pool.reserve0 : pool.reserve1;
  const reserveOut = isToken0In ? pool.reserve1 : pool.reserve0;
  return Number(reserveOut) / Number(reserveIn);
}

function calculateOutput(
  pool: PoolData,
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): string {
  const isToken0In = pool.token0.toLowerCase() === tokenIn.toLowerCase();
  const reserveIn = isToken0In ? pool.reserve0 : pool.reserve1;
  const reserveOut = isToken0In ? pool.reserve1 : pool.reserve0;
  const amountInWithFee = Number(amountIn) * (1 - pool.fee / 10000);
  const numerator = Number(reserveOut) * amountInWithFee;
  const denominator = Number(reserveIn) + amountInWithFee;
  return (numerator / denominator).toString();
}
