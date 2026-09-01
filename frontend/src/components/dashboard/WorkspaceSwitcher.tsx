import { useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";

const roleTone: Record<string, string> = {
  owner: "bg-brand/10 text-brand",
  admin: "bg-violet/10 text-violet",
  analyst: "bg-bg-mute text-fg-muted",
};

export default function WorkspaceSwitcher() {
  const { orgs, current, switchTo } = useWorkspace();
  const [open, setOpen] = useState(false);
  if (!current) return null;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold hover:border-brand/40">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-tr from-brand to-violet text-xs font-bold text-white">
          {current.name.charAt(0).toUpperCase()}
        </span>
        {current.name}
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${roleTone[current.role]}`}>{current.role}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-fg-dim"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-60 rounded-xl border border-line bg-white p-1.5 shadow-soft">
          {orgs.map((o) => (
            <button key={o.id} onClick={() => { switchTo(o.id); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-bg-mute ${o.id === current.id ? "font-semibold" : ""}`}>
              <span className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded bg-gradient-to-tr from-brand to-violet text-[10px] font-bold text-white">{o.name.charAt(0).toUpperCase()}</span>
                {o.name}
              </span>
              <span className="text-[10px] uppercase text-fg-dim">{o.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
