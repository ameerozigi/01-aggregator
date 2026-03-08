import { useState } from "react";
import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getDefaultConfig, RainbowKitProvider, ConnectButton, lightTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import axios from "axios";
import TokenSelector from "./components/TokenSelector";

type Route = {
  provider: string;
  expectedOut: string;
  priceImpact: string;
  splits?: { dex: string; percentage: number; expectedOut: string }[];
  gasEstimate: string;
  route?: any[];
};

const queryClient = new QueryClient();

const config = getDefaultConfig({
  appName: "O1 Aggregator",
  projectId: "demo", // replace with WalletConnect project id if available
  chains: [base],
  transports: {
    [base.id]: http()
  }
});

function AmountInput({ amount, onChange }: { amount: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="text-sm text-white/60">Amount</div>
      <input
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder-white/40"
        placeholder="Amount"
        value={amount}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Slippage({
  slippage,
  setSlippage
}: {
  slippage: number;
  setSlippage: (n: number) => void;
}) {
  const presets = [0.1, 0.5, 1];
  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-500">Slippage</div>
      <div className="flex items-center gap-2">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => setSlippage(p)}
            className={`rounded px-3 py-1 border ${slippage === p ? "bg-gray-100" : ""}`}
          >
            {p}%
          </button>
        ))}
        <input
          className="w-24 rounded border px-2 py-1"
          type="number"
          min={0}
          step="0.1"
          value={slippage}
          onChange={(e) => setSlippage(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

function QuoteCard({ route }: { route?: Route }) {
  if (!route) return null;
  return (
    <div className="rounded border p-4 space-y-2">
      <div className="font-medium">Best Route: {route.provider}</div>
      <div className="text-sm">Expected Out: {route.expectedOut}</div>
      <div className="text-sm">Price Impact: {route.priceImpact}</div>
      {route.splits && (
        <div className="text-sm">
          Splits:
          <ul className="list-disc ml-5">
            {route.splits.map((s, i) => (
              <li key={i}>
                {s.dex} — {s.percentage}% — {s.expectedOut}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AppInner() {
  const [tokenIn, setTokenIn] = useState("");
  const [tokenOut, setTokenOut] = useState("");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(1);
  const [route, setRoute] = useState<Route | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  async function getQuote() {
    if (!tokenIn || !tokenOut || !amount) return;
    setLoading(true);
    try {
      const { data } = await axios.post("http://localhost:4000/quote", {
        tokenIn,
        tokenOut,
        amount,
        slippage
      });
      setRoute(data.route);
    } catch (err) {
      // noop
    } finally {
      setLoading(false);
    }
  }

  async function doSwap() {
    if (!route) return;
    const { data } = await axios.post("http://localhost:4000/transaction", {
      tokenIn,
      tokenOut,
      amount,
      slippage,
      route,
      userAddress: "0x0000000000000000000000000000000000000001"
    });
    console.log("tx:", data);
  }

  return (
    <div className="o1-theme min-h-screen bg-gradient-to-b from-black via-[#0b0f1a] to-black text-white">
      <div className="max-w-xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="text-2xl font-semibold tracking-tight">
            <span className="text-white">O1</span> <span className="text-blue-500">Aggregator</span>
          </div>
          <ConnectButton />
        </div>

        <div className="rounded-2xl p-6 space-y-4 bg-white/5 border border-white/10 shadow-xl backdrop-blur">
          <TokenSelector label="From" value={tokenIn} onChange={setTokenIn} />
          <AmountInput amount={amount} onChange={setAmount} />
          <TokenSelector label="To" value={tokenOut} onChange={setTokenOut} />

          <Slippage slippage={slippage} setSlippage={setSlippage} />

          <div className="flex gap-2">
            <button onClick={getQuote} className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-blue-400 text-white px-4 py-2 hover:opacity-90 transition">
              {loading ? "Getting quote..." : "Get Quote"}
            </button>
            <button onClick={() => setAmount("100")} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10 transition">
              Max
            </button>
          </div>

          <QuoteCard route={route} />

          <button onClick={doSwap} disabled={!route} className="w-full rounded-lg bg-white text-black px-4 py-2 disabled:opacity-50 hover:bg-blue-100 transition">
            Swap
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={lightTheme()}>
          <AppInner />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
