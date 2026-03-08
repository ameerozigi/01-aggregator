import { Router } from "express";
import { findBestRoute } from "../services/routingService";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { tokenIn, tokenOut, amount, slippage } = req.body;
    if (!tokenIn || !tokenOut || !amount) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    const route = await findBestRoute(tokenIn, tokenOut, amount, slippage);
    res.json({ success: true, route, timestamp: Date.now() });
  } catch (error) {
    console.error("Quote error:", error);
    res.status(500).json({ error: "Failed to get quote" });
  }
});

export const quoteRouter = router;
export default router;
