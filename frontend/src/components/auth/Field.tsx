import { useState } from "react";

export default function Field({ label, type = "text", value, onChange, placeholder, required = true, autoComplete }: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; autoComplete?: string;
}) {
  const isPassword = type === "password";
  const [show, setShow] = useState(false);
  const inputType = isPassword && show ? "text" : type;
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <div className="relative">
        <input
          type={inputType} value={value} required={required} placeholder={placeholder} autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 ${isPassword ? "pr-16" : ""}`}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow((s) => !s)} tabIndex={-1}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-semibold text-fg-muted hover:text-brand">
            {show ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </label>
  );
}
