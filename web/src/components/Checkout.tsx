"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TicketEvent, TicketTier } from "@/lib/catalog";
import type { Coverage, Quote } from "@/lib/coverage";
import { dateParts, usd } from "@/lib/format";

type Row = { coverage: Coverage; quote: Quote };

export default function Checkout({ ev, tier, qty }: { ev: TicketEvent; tier: TicketTier; qty: number }) {
  const router = useRouter();
  const [rooting, setRooting] = useState<"home" | "away">("home");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pick, setPick] = useState<string>("none");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [secs, setSecs] = useState(479);
  const subtotal = tier.price * qty;

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setRows(null);
    fetch("/api/quote", { method: "POST", body: JSON.stringify({ eventId: ev.id, rooting, tierId: tier.id, qty }) })
      .then((r) => r.json())
      .then((d) => {
        setRows(d.coverages ?? []);
        const best = (d.coverages ?? []).find((x: Row) => x.coverage.id === "star-sits") ?? (d.coverages ?? [])[0];
        setPick(best ? best.coverage.id : "none");
      });
  }, [ev.id, rooting, tier.id, qty]);

  const chosen = rows?.find((r) => r.coverage.id === pick);
  const total = subtotal + (chosen?.quote.premium ?? 0);

  async function placeOrder() {
    setBusy(true);
    setErr("");
    if (!chosen) {
      router.push(`/seatwise/account?order=ok`);
      return;
    }
    const res = await fetch("/api/policies", {
      method: "POST",
      body: JSON.stringify({ eventId: ev.id, coverageId: chosen.coverage.id, rooting, tierId: tier.id, qty, holderName: "Jordan Rivera", holderEmail: "jordan@example.com" }),
    });
    const d = await res.json();
    if (!res.ok) {
      setErr(d.error ?? "Something went wrong");
      setBusy(false);
      return;
    }
    router.push(`/seatwise/account?new=${d.policy.id}`);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
          <div className="font-semibold">Checkout</div>
          <div className="rounded bg-neutral-900 px-2.5 py-1 font-mono text-sm text-white">Time left {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</div>
        </div>

        <section className="rounded-lg bg-white p-4 shadow-sm">
          <h3 className="font-semibold">Delivery</h3>
          <div className="mt-2 rounded border-2 border-[#024ddf] bg-blue-50 px-3 py-2 text-sm">📱 Mobile Entry — tickets in the Seatwise app · <span className="font-semibold">Free</span></div>
        </section>

        {/* ---------------- Bluff Protect ---------------- */}
        <section className="overflow-hidden rounded-lg border-2 border-emerald-500 bg-white shadow-sm">
          <div className="flex items-center justify-between bg-emerald-600 px-4 py-2.5 text-white">
            <div className="font-semibold">Bluff Protect</div>
          </div>
          {ev.kind === "sports" && ev.home && ev.away && (
            <div className="flex items-center gap-2 border-b px-4 py-3 text-sm">
              <span className="text-neutral-600">Who are you rooting for?</span>
              {(["away", "home"] as const).map((s) => {
                const t = s === "home" ? ev.home! : ev.away!;
                return (
                  <button key={s} onClick={() => setRooting(s)}
                    className={`rounded-full border px-3 py-1 font-semibold ${rooting === s ? "border-transparent text-white" : "border-neutral-300"}`}
                    style={rooting === s ? { background: t.color } : {}}>
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
          <div className="divide-y">
            {!rows && <div className="p-4 text-sm text-neutral-500">Pricing protection against live Gemini markets…</div>}
            {rows?.map(({ coverage: c, quote: q }) => (
              <label key={c.id} className={`flex cursor-pointer gap-3 px-4 py-3 ${pick === c.id ? "bg-emerald-50" : "hover:bg-neutral-50"}`}>
                <input type="radio" name="bluff" className="mt-1 accent-emerald-600" checked={pick === c.id} onChange={() => setPick(c.id)} />
                <div className="flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold">{c.emoji} {c.name}</span>
                    <span className="text-sm text-neutral-600">If <span className="font-semibold">{c.trigger}</span> → get <span className="font-semibold text-emerald-700">{usd(q.payout)}</span> back ({q.refundPct}%)</span>
                  </div>
                  <div className="text-sm text-neutral-500">{c.blurb}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">+{usd(q.premium)}</div>
                  <div className="text-sm text-neutral-500">{Math.round(c.probability * 100)}% chance</div>
                </div>
              </label>
            ))}
            <label className={`flex cursor-pointer gap-3 px-4 py-3 ${pick === "none" ? "bg-neutral-50" : ""}`}>
              <input type="radio" name="bluff" className="mt-1" checked={pick === "none"} onChange={() => setPick("none")} />
              <div className="text-sm text-neutral-600">No thanks, I&apos;ll take my chances.</div>
            </label>
          </div>
          <div className="bg-neutral-50 px-4 py-2 text-sm text-neutral-500">
            Payouts are triggered by official results and sent to your original payment method. Each policy is fully hedged on regulated prediction markets — Bluff can always pay.
          </div>
        </section>

        <section className="rounded-lg bg-white p-4 shadow-sm">
          <h3 className="font-semibold">Payment</h3>
          <div className="mt-2 flex items-center gap-3 rounded border px-3 py-2 text-sm">💳 Visa ending in 4242 <span className="ml-auto text-neutral-500">Jordan Rivera</span></div>
        </section>
      </div>

      <aside className="h-fit space-y-3 rounded-lg bg-white p-4 shadow-sm lg:sticky lg:top-4">
        <div className="font-semibold">Order summary</div>
        <div>
          <div className="font-semibold">{ev.title}</div>
          <div className="text-sm text-neutral-600">{dateParts(ev.startTime).long}</div>
          <div className="text-sm text-neutral-600">{ev.venue}</div>
        </div>
        <div className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between"><span>{tier.name} × {qty}</span><span>{usd(subtotal)}</span></div>
          <div className="text-sm text-neutral-500">{tier.section}</div>
          {chosen && (
            <div className="flex justify-between text-emerald-700"><span>🛡️ {chosen.coverage.name}</span><span>{usd(chosen.quote.premium)}</span></div>
          )}
        </div>
        <div className="flex justify-between border-t pt-3 text-base font-semibold"><span>Total</span><span>{usd(total)}</span></div>
        {err && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{err}</div>}
        <button disabled={busy} onClick={placeOrder} className="w-full rounded bg-[#024ddf] py-3 font-semibold text-white hover:bg-[#0141b9] disabled:opacity-60">
          {busy ? "Placing order & hedging…" : "Place Order"}
        </button>
        <p className="text-sm text-neutral-500">By continuing you agree to the Seatwise Terms of Use and the Bluff Protect coverage terms.</p>
      </aside>
    </div>
  );
}
