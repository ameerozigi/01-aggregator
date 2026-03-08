import axios, { AxiosInstance } from "axios";

const ZEROX_API_KEY = process.env.ZEROX_API_KEY || "";
const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY || "";
const KYBER_API_KEY = process.env.KYBER_API_KEY || "";

const BASE_CHAIN_ID = 8453;

export interface QuoteRequest {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  slippage?: number;
}

export interface QuoteResponse {
  provider: string;
  expectedOut: string;
  priceImpact: string;
  route: any[];
  gasEstimate: string;
}

function createClient(baseURL: string, headers: Record<string, string>): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 10000,
    headers
  });
}

const zeroXClient = createClient("https://api.0x.org", {
  ...(ZEROX_API_KEY ? { "0x-api-key": ZEROX_API_KEY } : {})
});

const oneInchClient = createClient(`https://api.1inch.io/v5.0/${BASE_CHAIN_ID}`, {
  ...(ONEINCH_API_KEY ? { Authorization: `Bearer ${ONEINCH_API_KEY}` } : {})
});

const kyberClient = createClient("https://api.kyberswap.com", {
  ...(KYBER_API_KEY ? { "X-API-Key": KYBER_API_KEY } : {})
});

export async function get0xQuote(params: QuoteRequest): Promise<QuoteResponse | null> {
  try {
    const { data } = await zeroXClient.get("/swap/v1/quote", {
      params: {
        sellToken: params.tokenIn,
        buyToken: params.tokenOut,
        sellAmount: params.amount,
        chainId: BASE_CHAIN_ID,
        ...(params.slippage !== undefined ? { slippagePercentage: params.slippage } : {})
      }
    });
    return {
      provider: "0x",
      expectedOut: String(data.buyAmount ?? "0"),
      priceImpact: String(data.estimatedPriceImpact ?? "0"),
      route: Array.isArray(data.orders) ? data.orders : data.sources || [],
      gasEstimate: String(data.gas ?? "0")
    };
  } catch {
    return null;
  }
}

export async function get1inchQuote(params: QuoteRequest): Promise<QuoteResponse | null> {
  try {
    const { data } = await oneInchClient.get("/quote", {
      params: {
        fromTokenAddress: params.tokenIn,
        toTokenAddress: params.tokenOut,
        amount: params.amount
      }
    });
    return {
      provider: "1inch",
      expectedOut: String(data.toTokenAmount ?? "0"),
      priceImpact: String(data.estimatedPriceImpact ?? "0"),
      route: Array.isArray(data.protocols) ? data.protocols : [],
      gasEstimate: String(data.estimatedGas ?? "0")
    };
  } catch {
    return null;
  }
}

export async function getKyberQuote(params: QuoteRequest): Promise<QuoteResponse | null> {
  try {
    const { data } = await kyberClient.get("/api/quote", {
      params: {
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amount,
        chainId: BASE_CHAIN_ID
      }
    });
    return {
      provider: "kyber",
      expectedOut: String(data.amountOut ?? "0"),
      priceImpact: String(data.priceImpact ?? "0"),
      route: Array.isArray(data.route) ? data.route : [],
      gasEstimate: String(data.gasEstimate ?? "0")
    };
  } catch {
    return null;
  }
}
