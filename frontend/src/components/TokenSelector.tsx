import { useMemo, useState } from "react";
import { TOKENS } from "../data/tokens";

type Token = {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
};

export default function TokenSelector({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (addr: string) => void;
}) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const q = query.toLowerCase();
    return TOKENS.filter(
      (t: Token) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="space-y-2">
      <div className="text-sm text-white/60">{label}</div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder-white/40"
            placeholder="Search token or paste address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg bg-black/80 backdrop-blur border border-white/10">
            {list.map((t) => (
              <button
                key={t.address + t.symbol}
                className="flex w-full items-center gap-3 px-3 py-2 hover:bg-white/10 text-left"
                onClick={() => {
                  onChange(t.address);
                  setQuery(t.symbol);
                }}
              >
                {t.logoURI ? (
                  <img src={t.logoURI} alt={t.symbol} className="h-6 w-6 rounded-full" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-blue-600" />
                )}
                <div className="flex-1">
                  <div className="text-white">{t.symbol}</div>
                  <div className="text-xs text-white/50">{t.name}</div>
                </div>
                <div className="text-[10px] text-white/40">{t.address.slice(0, 6)}…{t.address.slice(-4)}</div>
              </button>
            ))}
            {list.length === 0 && (
              <div className="px-3 py-2 text-sm text-white/60">No matches</div>
            )}
          </div>
        </div>
        <input
          className="w-[50%] rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder-white/40"
          placeholder="0x… address"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
