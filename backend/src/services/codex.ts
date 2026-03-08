import type { RouteLeg } from "./aggregator";

type PoolsResult = {
  bestOut?: string;
  hops: string[];
  pairs: string[];
};

export async function fetchCodexPools(_tokenIn: string, _tokenOut: string): Promise<PoolsResult | null> {
  try {
    const hops: string[] = [];
    const pairs: string[] = [];
    return { bestOut: undefined, hops, pairs };
  } catch {
    return null;
  }
}
