export default function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "warn" }) {
  return (
    <div className="rounded-lg bg-neutral-900 p-4">
      <div className="text-neutral-400">{label}</div>
      <div className={`mt-2 text-xl font-semibold ${tone === "good" ? "text-emerald-400" : tone === "warn" ? "text-amber-300" : "text-neutral-100"}`}>{value}</div>
    </div>
  );
}
