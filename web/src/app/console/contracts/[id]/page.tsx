import Link from "next/link";
import { notFound } from "next/navigation";
import { formatUnits } from "viem";
import { db } from "@/lib/store";
import { usd } from "@/lib/format";
import { contractStatus } from "@/lib/business";
import ProviderLogo from "@/components/ProviderLogo";
import { providerName } from "@/lib/markets/types";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";
export default async function Contract({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = db.policy(id);
  if (!p) notFound();
  const simulated = p.arc.mode === "simulated";
  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <AutoRefresh
        enabled={p.status === "pending" || p.status === "settling"}
      />
      <header>
        <Link
          href="/console/contracts"
          className="text-xs text-neutral-500 hover:text-white"
        >
          ← All contracts
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 font-mono text-xs text-neutral-600">{p.id.replace(/^pol_demo_/, "").toUpperCase()}</p>
            <h1 className="text-xl font-semibold tracking-tight">
              {p.coverageName}
            </h1>
            <p className="mt-2 text-neutral-400">{p.eventTitle}</p>
          </div>
          <span className="rounded-full bg-neutral-800 px-3 py-1.5 text-xs">
            {contractStatus(p)}
          </span>
        </div>
      </header>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Premium", usd(p.premium)],
          [
            p.status === "paid" ? "Payout recorded" : "Potential payout",
            usd(p.payout),
          ],
          ["Customer", p.holderName],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg bg-neutral-900 p-5"
          >
            <p className="text-xs text-neutral-500">{label}</p>
            <p className="mt-3 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
      <section className="rounded-lg bg-neutral-900 p-6">
        <h2 className="font-semibold">Protection</h2>
        <p className="mt-3 text-neutral-300">
          If {p.trigger}, the customer gets {usd(p.payout)} back.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          {p.qty} × {p.tierName} · {p.refundPct}% of a {usd(p.ticketTotal)}{" "}
          ticket order.
        </p>
      </section>
      <section className="rounded-lg bg-neutral-900 p-6">
        <h2 className="font-semibold">Contract activity</h2>
        <ol className="mt-5 space-y-5">
          {[
            [
              "Protection purchased",
              p.createdAt,
              `${usd(p.premium)} premium · ${p.holderName}`,
            ],
            [
              p.status === "pending"
                ? "Awaiting purchase confirmation"
                : "Protection activated",
              p.chain?.purchase
                ? new Date(p.chain.purchase.blockTimestamp * 1000).toISOString()
                : p.status === "pending"
                  ? ""
                  : p.createdAt,
              simulated
                ? "Execution not connected"
                : p.chain?.purchase
                  ? "Purchase confirmed by QuickNode Streams"
                  : "Arc receipt recorded",
            ],
            [
              p.status === "paid"
                ? "Payout completed"
                : p.status === "expired"
                  ? "Completed without payout"
                  : p.status === "settling"
                    ? "Settlement in progress"
                    : "Awaiting event outcome",
              p.settledAt ?? "",
              p.status === "paid"
                ? `${usd(p.payout)} ${simulated ? "payout recorded" : "coverage settled on Arc"}`
                : p.status === "expired"
                  ? "The protected outcome did not happen"
                  : "The contract follows the selected event outcome",
            ],
          ].map(([title, time], i) => (
            <li key={title} className="flex gap-4">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${time ? "border-emerald-800 bg-emerald-400/10 text-emerald-300" : "border-neutral-700 text-neutral-500"}`}
              >
                {i + 1}
              </span>
              <div>
                <h3 className="text-sm">{title}</h3>

                {time && (
                  <time
                    dateTime={time}
                    className="mt-1 block text-xs text-neutral-600"
                  >
                    {new Date(time).toLocaleString("en-US", {
                      timeZone: "America/Chicago",
                    })}
                  </time>
                )}
              </div>
            </li>
          ))}
        </ol>
        {(p.purchaseError || p.settlementError) && (
          <p className="mt-5 text-sm text-amber-300">
            {p.purchaseError || p.settlementError}
          </p>
        )}
        {p.status === "active" && (
          <Link
            href={`/console/events/${p.eventId}#resolve`}
            className="mt-6 inline-flex rounded-md bg-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-950"
          >
            {simulated ? "Resolve outcome" : "View event settlement"} →
          </Link>
        )}
      </section>
      <details className="rounded-lg bg-neutral-900 p-6">
        <summary className="cursor-pointer font-semibold">
          Hedge & transaction evidence
        </summary>
        <div className="mt-6 space-y-6 text-sm">
          <section>
            <h3 className="text-neutral-300">{providerName(p.hedgeLeg.provider ?? "gemini")} hedge · {p.hedge.mode === "simulated" ? "Not submitted" : "Submitted"}</h3>
            <div className="mt-3"><ProviderLogo provider={p.hedgeLeg.provider ?? "gemini"} dark /></div>
            <p className="mt-2 break-all font-mono text-xs text-neutral-500">
              {p.hedge.order.quantity} {p.hedge.order.outcome.toUpperCase()} ·{" "}
              {p.hedge.order.symbol} @ {p.hedge.order.price}
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              {p.hedgeType === "partial"
                ? "Partial proxy hedge · reserve backs the remaining risk"
                : "Matched outcome hedge"}{" "}
              · Order {p.hedge.orderId} · {p.hedge.status}
            </p>
          </section>
          <section>
            <h3 className="text-neutral-300">Arc policy · {simulated ? "Not submitted" : "Submitted"}</h3>
            {simulated ? (
              <p className="mt-2 text-xs leading-6 text-neutral-500">
                No blockchain transaction has been submitted.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-emerald-300">
                {p.arc.explorerUrl && (
                  <a href={p.arc.explorerUrl} target="_blank" rel="noreferrer">
                    Purchase transaction ↗
                  </a>
                )}
                {p.settlement?.arc.explorerUrl && (
                  <a
                    href={p.settlement.arc.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Settlement transaction ↗
                  </a>
                )}
              </div>
            )}
            {p.chain ? (
              <p className="mt-3 text-xs text-emerald-300">
                Independently confirmed through QuickNode Streams.
                {p.chain.settlement
                  ? ` ${formatUnits(BigInt(String(p.chain.settlement.args.paid)), 6)} USDC paid on testnet.`
                  : ""}
              </p>
            ) : (
              <p className="mt-3 text-xs text-neutral-600">
                {simulated
                  ? "No matching Arc transaction."
                  : "Waiting for matching vault event evidence."}
              </p>
            )}
          </section>
        </div>
      </details>
    </div>
  );
}
