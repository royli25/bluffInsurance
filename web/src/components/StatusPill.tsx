export default function StatusPill({ s }: { s: string }) {
  const c = s === "paid" ? "bg-emerald-500/15 text-emerald-300" : s === "expired" ? "bg-zinc-700/40 text-zinc-400" : "bg-blue-500/15 text-blue-300";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c}`}>{s}</span>;
}
