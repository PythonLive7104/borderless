import { useEffect, useRef, useState } from "react";
import { KB } from "../../data/knowledge";

// Tawk.to live-chat embed URL, e.g. https://embed.tawk.to/<propertyId>/<widgetId>
const TAWK_SRC = ((import.meta as any).env?.VITE_TAWK_SRC as string | undefined) || "";

function openTawk() {
  const w = window as any;
  if (!TAWK_SRC) { window.open("mailto:support@trynobot.com?subject=Support%20request", "_blank"); return; }
  if (w.Tawk_API?.maximize) { w.Tawk_API.maximize(); return; }
  w.Tawk_API = w.Tawk_API || {};
  w.Tawk_LoadStart = new Date();
  const s = document.createElement("script");
  s.async = true; s.src = TAWK_SRC; s.charset = "UTF-8"; s.setAttribute("crossorigin", "*");
  s.onload = () => {
    const t = setInterval(() => { if (w.Tawk_API?.maximize) { w.Tawk_API.maximize(); clearInterval(t); } }, 300);
    setTimeout(() => clearInterval(t), 8000);
  };
  document.body.appendChild(s);
}

const STOP = new Set(["the", "a", "an", "is", "are", "do", "does", "how", "what", "i", "to", "my", "of", "on", "in", "and", "can", "for", "me", "you", "it"]);
function tokenize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9/ ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
}
// Return the best KB answer, or null when nothing is confident enough.
function findAnswer(question: string): string | null {
  const words = tokenize(question);
  if (words.length === 0) return null;
  let best = { score: 0, a: "" };
  for (const e of KB) {
    const hay = new Set([...e.keywords, ...tokenize(e.q)]);
    let score = 0;
    for (const w of words) if (hay.has(w)) score += 1;
    if (score > best.score) best = { score, a: e.a };
  }
  return best.score >= 1 ? best.a : null;
}

type Msg = { from: "bot" | "user"; text: string; human?: boolean };
const SUGGESTIONS = [
  "How do I install the tracker?",
  "How do I actually block bots?",
  "What do the actions mean?",
  "How do I block an IP?",
  "What are the plans?",
];

export default function HelpChat() {
  const [open, setOpen] = useState(false);
  const [tawkActive, setTawkActive] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "bot", text: "Hi! I'm the TryNoBot assistant. Ask me anything about using the app — or tap a suggestion below." },
  ]);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { scroller.current?.scrollTo(0, scroller.current.scrollHeight); }, [msgs, open]);

  // Escalate to Tawk: close our widget and hide our bubble so the two chats
  // don't stack in the same corner (Tawk becomes the active chat).
  function talkToHuman() { openTawk(); setOpen(false); setTawkActive(true); }

  // If Tawk is the active chat, get out of its way entirely.
  if (tawkActive) return null;

  function ask(text: string) {
    const q = text.trim();
    if (!q) return;
    const answer = findAnswer(q);
    setMsgs((m) => [
      ...m,
      { from: "user", text: q },
      answer
        ? { from: "bot", text: answer }
        : { from: "bot", text: "I don't have an answer for that one yet. You can connect with our support team for help.", human: true },
    ]);
    setInput("");
  }

  return (
    <>
      {/* launcher */}
      <button onClick={() => setOpen((o) => !o)} aria-label="Help"
        className="fixed bottom-5 right-5 z-[90] grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-[0_12px_30px_-8px_rgba(37,99,235,.7)] transition hover:bg-brand-600">
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-[90] flex h-[30rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,.35)]">
          <div className="flex items-center gap-2 border-b border-line bg-bg-soft px-4 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand/10 text-brand">?</span>
            <div className="flex-1"><div className="text-sm font-bold">Help & answers</div><div className="text-[11px] text-fg-dim">Ask about anything in TryNoBot</div></div>
            <button onClick={talkToHuman} title="Chat with a support agent"
              className="flex items-center gap-1 rounded-full border border-brand/30 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand/5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> Talk to a human
            </button>
          </div>

          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === "user" ? "bg-brand text-white" : "bg-bg-mute text-fg"}`}>
                  {m.text}
                  {m.human && (
                    <button onClick={talkToHuman} className="mt-2 block w-full rounded-lg bg-brand px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-brand-600">
                      Chat with a human
                    </button>
                  )}
                </div>
              </div>
            ))}
            {msgs.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-fg-muted hover:border-brand/40 hover:text-brand">{s}</button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 border-t border-line p-3">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your question…"
              className="min-w-0 flex-1 rounded-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
            <button type="submit" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-white hover:bg-brand-600" aria-label="Send">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
