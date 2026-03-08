import { get0xQuote, get1inchQuote, getKyberQuote } from "./aggregatorService";
import { getPoolsForPair, getQuoteFromPools } from "./codexService";

type Split = {
  dex: string;
  percentage: number;
  expectedOut: string;
};

type Route = {
  provider: string;
  expectedOut: string;
  priceImpact: string;
  splits?: Split[];
  gasEstimate: string;
  route?: any[];
};

function toBig(v: string | number | undefined): bigint {
  if (v === undefined) return 0n;
  const s = String(v);
  if (s.includes(".")) {
    const i = s.split(".")[0];
    return BigInt(i);
  }
  return BigInt(s || "0");
}

function score(expectedOut: string, gasEstimate: string, gasPriceGwei: number): bigint {
  const out = toBig(expectedOut);
  const gas = toBig(gasEstimate);
  const gp = BigInt(Math.floor(gasPriceGwei * 1e9));
  return out - gas * gp;
}

function shouldSplit(scores: bigint[]): boolean {
  if (scores.length < 2) return false;
  const a = scores[0] > 0n ? scores[0] : 0n;
  const b = scores[1] > 0n ? scores[1] : 0n;
  if (a === 0n) return false;
  const diffBp = Number(((a - b) * 10000n) / a);
  return diffBp < 100;
}

function createSplitRoute(a: Route, b: Route, amount: string): Route {
  const halfA = Number(a.expectedOut) * 0.5;
  const halfB = Number(b.expectedOut) * 0.5;
  const total = (halfA + halfB).toString();
  const gas = (Number(a.gasEstimate || "0") + Number(b.gasEstimate || "0")).toString();
  return {
    provider: "split",
    expectedOut: total,
    priceImpact: "0",
    splits: [
      { dex: a.provider, percentage: 50, expectedOut: halfA.toString() },
      { dex: b.provider, percentage: 50, expectedOut: halfB.toString() }
    ],
    gasEstimate: gas
  };
}

export async function findBestRoute(
  tokenIn: string,
  tokenOut: string,
  amount: string,
  slippage: number = 1
): Promise<Route> {
  const [zx, oi, ky, pools] = await Promise.all([
    get0xQuote({ tokenIn, tokenOut, amount, slippage }),
    get1inchQuote({ tokenIn, tokenOut, amount, slippage }),
    getKyberQuote({ tokenIn, tokenOut, amount, slippage }),
    getPoolsForPair(tokenIn, tokenOut)
  ]);
  const codex = await getQuoteFromPools(tokenIn, tokenOut, amount, pools);
  const list: Route[] = [];
  if (zx) list.push({ provider: zx.provider, expectedOut: zx.expectedOut, priceImpact: zx.priceImpact, route: zx.route, gasEstimate: zx.gasEstimate });
  if (oi) list.push({ provider: oi.provider, expectedOut: oi.expectedOut, priceImpact: oi.priceImpact, route: oi.route, gasEstimate: oi.gasEstimate });
  if (ky) list.push({ provider: ky.provider, expectedOut: ky.expectedOut, priceImpact: ky.priceImpact, route: ky.route, gasEstimate: ky.gasEstimate });
  if (codex) list.push({ provider: "codex", expectedOut: codex.expectedOut, priceImpact: "0", route: codex.pools, gasEstimate: "150000" });
  if (list.length === 0) {
    return { provider: "none", expectedOut: "0", priceImpact: "0", gasEstimate: "0" };
  }
  const gasPriceGwei = process.env.GAS_PRICE_GWEI ? Number(process.env.GAS_PRICE_GWEI) : 1;
  const scored = list
    .map((r) => ({ r, s: score(r.expectedOut, r.gasEstimate, gasPriceGwei) }))
    .sort((a, b) => (a.s < b.s ? 1 : -1));
  const best = scored[0].r;
  const scores = scored.map((e) => e.s);
  if (shouldSplit(scores)) {
    return createSplitRoute(scored[0].r, scored[1].r, amount);
  }
  return best;
}
