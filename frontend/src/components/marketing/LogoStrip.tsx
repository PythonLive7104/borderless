// Platform logos strip (like the reference). Simple wordmarks to avoid trademark assets.
const PLATFORMS = ["Google Ads", "Meta", "TikTok", "Microsoft Ads", "X Ads", "Yandex", "Taboola", "Outbrain"];
export default function LogoStrip({ title = "Works across every major traffic source" }: { title?: string }) {
  return (
    <div className="container-page py-12">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-fg-dim">{title}</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
        {PLATFORMS.map((p) => (
          <span key={p} className="text-lg font-bold tracking-tight text-fg-dim/80 grayscale transition hover:text-fg">{p}</span>
        ))}
      </div>
    </div>
  );
}
