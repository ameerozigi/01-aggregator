function isAddress(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

export function validateQuoteInput(body: any) {
  const { tokenIn, tokenOut, amount, slippage } = body || {};
  if (!isAddress(tokenIn) || !isAddress(tokenOut)) throw new Error("invalid token addresses");
  if (!amount || String(amount).length === 0) throw new Error("invalid amount");
  const s = Number(slippage);
  if (Number.isNaN(s) || s < 0 || s > 1) throw new Error("invalid slippage");
  return { tokenIn, tokenOut, amount: String(amount), slippage: s };
}

export function validateTxInput(body: any) {
  const { tokenIn, tokenOut, amount, slippage, route, userAddress } = body || {};
  const q = validateQuoteInput({ tokenIn, tokenOut, amount, slippage });
  if (!route || typeof route.portionBps !== "number") throw new Error("invalid route");
  if (!isAddress(userAddress)) throw new Error("invalid user address");
  return { ...q, route, userAddress };
}
