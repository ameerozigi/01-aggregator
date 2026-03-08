import axios from "axios";
import { fetchCodexPools } from "./codex";

type QuoteSource = "0x" | "1inch" | "kyber" | "codex";

export type QuoteRequest = {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  slippage: number;
};

export type RouteLeg = {
  source: QuoteSource;
  portionBps: number;
  estimatedOut: string;
  hops: string[];
  pairs?: string[];
};

export type QuoteResult = {
  totalOut: string;
  routes: RouteLeg[];
};

async function fetch0x(tokenIn: string, tokenOut: string, amount: string) {
  try {
    const url = `https://api.0x.org/swap/v1/quote?sellToken=${tokenIn}&buyToken=${tokenOut}&sellAmount=${amount}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    return { amountOut: data.buyAmount as string, hops: data.sources?.map((s: any) => s.name) || [] };
  } catch {
    return null;
  }
}

async function fetch1inch(tokenIn: string, tokenOut: string, amount: string) {
  try {
    const chain = 84532;
    const url = `https://api.1inch.dev/swap/v5.2/${chain}/quote?src=${tokenIn}&dst=${tokenOut}&amount=${amount}`;
    const headers: Record<string, string> = {};
    if (process.env.ONEINCH_API_KEY) headers["Authorization"] = `Bearer ${process.env.ONEINCH_API_KEY}`;
    const { data } = await axios.get(url, { headers, timeout: 8000 });
    const hops = Array.isArray(data.protocols) ? data.protocols.flat(2).map((p: any) => p.name) : [];
    return { amountOut: data.toAmount as string, hops };
  } catch {
    return null;
  }
}

async function fetchKyber(tokenIn: string, tokenOut: string, amount: string) {
  try {
    const url = `https://api.kyberswap.com/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amount}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    const best = data.data?.routeSummary;
    const hops = best?.route?.map((r: any) => r.pool || r.dex) || [];
    return best ? { amountOut: best.amountOut as string, hops } : null;
  } catch {
    return null;
  }
}

export async function getBestQuote(req: QuoteRequest): Promise<QuoteResult> {
  const [q0x, q1inch, qKyber, pools] = await Promise.all([
    fetch0x(req.tokenIn, req.tokenOut, req.amount),
    fetch1inch(req.tokenIn, req.tokenOut, req.amount),
    fetchKyber(req.tokenIn, req.tokenOut, req.amount),
    fetchCodexPools(req.tokenIn, req.tokenOut)
  ]);

  const candidates: RouteLeg[] = [];

  if (q0x) candidates.push({ source: "0x", portionBps: 10000, estimatedOut: q0x.amountOut, hops: q0x.hops });
  if (q1inch) candidates.push({ source: "1inch", portionBps: 10000, estimatedOut: q1inch.amountOut, hops: q1inch.hops });
  if (qKyber) candidates.push({ source: "kyber", portionBps: 10000, estimatedOut: qKyber.amountOut, hops: qKyber.hops });

  if (pools && pools.bestOut) {
    candidates.push({
      source: "codex",
      portionBps: 10000,
      estimatedOut: pools.bestOut,
      hops: pools.hops,
      pairs: pools.pairs
    });
  }

  if (candidates.length === 0) return { totalOut: "0", routes: [] };

  candidates.sort((a, b) => BigInt(b.estimatedOut) > BigInt(a.estimatedOut) ? 1 : -1);

  const top = candidates[0];
  const second = candidates[1];

  if (second) {
    const a = BigInt(top.estimatedOut);
    const b = BigInt(second.estimatedOut);
    const total = a + b;
    const pTop = Number((a * BigInt(10000)) / total);
    const pSecond = 10000 - pTop;
    top.portionBps = pTop;
    second.portionBps = pSecond;
    const combined = (a * BigInt(pTop) + b * BigInt(pSecond)) / BigInt(10000);
    return { totalOut: combined.toString(), routes: [top, second] };
  }

  return { totalOut: top.estimatedOut, routes: [top] };
}
