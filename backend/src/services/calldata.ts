import { ethers } from "ethers";

type BuildTxParams = {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  slippage: number;
  route: {
    source: string;
    portionBps: number;
    hops: string[];
    pairs?: string[];
  };
  recipient: string;
};

const ABI = [
  "function swap(address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,address recipient,bytes[] routes)"
];

function encodeRoute(portionBps: number, pairs: string[] = [], feeFactors: number[] = []): string {
  const coder = ethers.AbiCoder.defaultAbiCoder();
  return coder.encode(["tuple(uint256,address[],uint24[])"], [[portionBps, pairs, feeFactors]]);
}

export async function buildAggregatorTx(params: BuildTxParams) {
  const addr = process.env.AGGREGATOR_ADDRESS;
  if (!addr) throw new Error("AGGREGATOR_ADDRESS missing");

  const iface = new ethers.Interface(ABI);
  const minOut = (BigInt(params.amount) * BigInt(10000 - Math.floor(params.slippage * 100))) / BigInt(10000);

  const routes: string[] = [];
  const pairs = params.route.pairs || [];
  routes.push(encodeRoute(params.route.portionBps, pairs, []));

  const data = iface.encodeFunctionData("swap", [
    params.tokenIn,
    params.tokenOut,
    params.amount,
    minOut.toString(),
    params.recipient,
    routes
  ]);

  return {
    to: addr,
    data,
    value: "0x0"
  };
}
