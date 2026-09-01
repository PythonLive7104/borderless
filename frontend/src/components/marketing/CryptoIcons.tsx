const COINS = [
  { s: "₿", n: "Bitcoin", bg: "#f7931a" },
  { s: "Ξ", n: "Ethereum", bg: "#627eea" },
  { s: "₮", n: "Tether", bg: "#26a17b" },
  { s: "$", n: "USDC", bg: "#2775ca" },
  { s: "◈", n: "TON", bg: "#0098ea" },
];
export default function CryptoIcons() {
  return (
    <div className="flex items-center justify-center gap-3">
      {COINS.map((c) => (
        <span key={c.n} title={c.n}
          className="grid h-11 w-11 place-items-center rounded-full text-lg font-bold text-white shadow-soft ring-4 ring-white"
          style={{ background: c.bg }}>{c.s}</span>
      ))}
    </div>
  );
}
