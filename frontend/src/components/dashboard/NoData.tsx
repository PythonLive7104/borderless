export default function NoData({ msg = "No data for this range yet." }: { msg?: string }) {
  return <div className="grid place-items-center py-16 text-sm text-fg-muted">{msg}</div>;
}
