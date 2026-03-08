import { Router } from "express";
import { ethers } from "ethers";

const router = Router();
const AGGREGATOR_ADDRESS = process.env.AGGREGATOR_ADDRESS;
const AGGREGATOR_ABI = [
  "function swap(address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,address recipient,bytes[] routes) external returns (uint256)"
];

router.post("/", async (req, res) => {
  try {
    const { tokenIn, tokenOut, amount, minAmountOut, userAddress, route, slippage } = req.body || {};
    if (!AGGREGATOR_ADDRESS) return res.status(500).json({ error: "AGGREGATOR_ADDRESS missing" });
    if (!tokenIn || !tokenOut || !amount || !userAddress) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    const iface = new ethers.Interface(AGGREGATOR_ABI);
    const routes = encodeRoute(route);
    if (routes.length === 0) return res.status(400).json({ error: "route encoding failed" });
    const minOut =
      minAmountOut ??
      (typeof slippage === "number"
        ? (
            (BigInt(String(amount)) * BigInt(10000 - Math.floor(Number(slippage) * 100))) /
            BigInt(10000)
          ).toString()
        : "0");
    const data = iface.encodeFunctionData("swap", [tokenIn, tokenOut, amount, minOut, userAddress, routes]);
    res.json({ to: AGGREGATOR_ADDRESS, data, value: "0" });
  } catch (error) {
    console.error("Transaction error:", error);
    res.status(500).json({ error: "Failed to build transaction" });
  }
});

function encodeRoute(route: any): string[] {
  if (!route) return [];
  const portionBps = typeof route.portionBps === "number" ? route.portionBps : 10000;
  const pairs: string[] = Array.isArray(route.pairs) ? route.pairs : [];
  const feeFactors: number[] = Array.isArray(route.feeFactors) ? route.feeFactors : [];
  if (pairs.length === 0) return [];
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = coder.encode(["tuple(uint256,address[],uint24[])"], [[portionBps, pairs, feeFactors]]);
  return [encoded];
}

export const txRouter = router;
export default router;
