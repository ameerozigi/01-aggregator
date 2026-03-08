import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const O1_URL = process.env.O1_URL || "http://localhost:4000/quote";
const RELAY_URL = process.env.RELAY_URL || "https://api.0x.org/swap/v1/quote";
const ZEROX_API_KEY = process.env.ZEROX_API_KEY || "";
const BASE_CHAIN_ID = 8453;

async function getO1Quote(testCase) {
  try {
    const { data } = await axios.post(O1_URL, {
      tokenIn: testCase.from,
      tokenOut: testCase.to,
      amount: testCase.amount,
      slippage: testCase.slippage ?? 1
    });
    return data;
  } catch (e) {
    return null;
  }
}

async function getRelayQuote(testCase) {
  try {
    if (RELAY_URL.includes("0x.org")) {
      const { data } = await axios.get(RELAY_URL, {
        params: {
          sellToken: testCase.from,
          buyToken: testCase.to,
          sellAmount: testCase.amount,
          chainId: BASE_CHAIN_ID
        },
        headers: ZEROX_API_KEY ? { "0x-api-key": ZEROX_API_KEY } : {}
      });
      return {
        expectedOut: String(data.buyAmount ?? "0"),
        priceImpact: String(data.estimatedPriceImpact ?? "0"),
        route: data.sources || [],
        gasEstimate: String(data.gas ?? "0")
      };
    }
    const { data } = await axios.get(RELAY_URL, {
      params: {
        fromTokenAddress: testCase.from,
        toTokenAddress: testCase.to,
        amount: testCase.amount
      }
    });
    return {
      expectedOut: String(data.toTokenAmount ?? "0"),
      priceImpact: String(data.estimatedPriceImpact ?? "0"),
      route: data.protocols || [],
      gasEstimate: String(data.estimatedGas ?? "0")
    };
  } catch (e) {
    return null;
  }
}

async function compareWithRelay(testCase) {
  const o1Quote = await getO1Quote(testCase);
  const relayQuote = await getRelayQuote(testCase);
  if (!o1Quote || !relayQuote) {
    console.log(`${testCase.from}->${testCase.to}: unable to fetch one or both quotes`);
    return { better: false, improvement: "0.00" };
  }
  const o1Out = Number(o1Quote.route?.expectedOut ?? o1Quote.expectedOut ?? 0);
  const relayOut = Number(relayQuote.expectedOut ?? 0);
  const better = o1Out > relayOut;
  const improvement = relayOut > 0 ? (((o1Out - relayOut) / relayOut) * 100).toFixed(2) : "0.00";
  console.log(`${testCase.from}->${testCase.to}: O1 ${better ? "✅" : "❌"} ${improvement}%`);
  return { better, improvement };
}

async function main() {
  const ETH = "0x4200000000000000000000000000000000000006";
  const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const cbETH = "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22";

  const tests = [
    { from: ETH, to: USDC, amount: "1000000000000000000", slippage: 1 }, // 1 ETH
    { from: USDC, to: ETH, amount: "1000000", slippage: 1 }, // 1 USDC
    { from: ETH, to: cbETH, amount: "500000000000000000", slippage: 1 } // 0.5 ETH
  ];

  for (const t of tests) {
    await compareWithRelay(t);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
