"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import type { streamHealth } from "@/lib/quicknode/health";

type Health = ReturnType<typeof streamHealth>;
const labels: Record<string, string> = {
  disabled: "Not enabled",
  "configuration-required": "Configuration required",
  "awaiting-data": "Waiting for first delivery",
  stale: "Delivery overdue",
  connected: "Receiving Arc events",
};
const names: Record<string, string> = {
  PolicyPurchased: "Policy purchased",
  PolicySettled: "Policy settled",
  MarketSettled: "Market settled",
  HedgeProceedsDeposited: "Hedge proceeds deposited",
};
export default function StreamMonitor({
  initial,
  compact = false,
}: {
  initial: Health;
  compact?: boolean;
}) {
  const [health, setHealth] = useState(initial);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    async function poll() {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch("/api/streams", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Status unavailable");
        setHealth(await response.json());
        setError(false);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError(true);
      } finally {
        inFlight = false;
      }
    }
    const timer = setInterval(poll, 5000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(timer);
      controller.abort();
      document.removeEventListener("visibilitychange", poll);
    };
  }, []);
  const tone =
    error ||
    health.status === "stale" ||
    health.status === "configuration-required"
      ? "text-amber-300"
      : health.status === "connected"
        ? "text-emerald-300"
        : "text-neutral-400";
  return (
    <section
      className="space-y-4 rounded-lg bg-neutral-900 p-4"
      aria-label="QuickNode Streams status"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Arc activity · QuickNode Streams</h2>
          <p className={`mt-1 text-sm ${tone}`} role="status">
            {error
              ? "Could not refresh connection status"
              : labels[health.status]}
          </p>
        </div>
        {compact && (
          <Link
            className="rounded-md bg-neutral-800 px-3 py-2 text-neutral-200 hover:bg-neutral-700"
            href="/console/activity"
          >
            View activity
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Confirmed events", health.events],
          ["Deliveries", health.deliveries],
          ["Latest block", health.lastBlock?.toLocaleString() ?? "—"],
          [
            "Last delivery",
            health.lastDeliveryAt
              ? new Date(health.lastDeliveryAt).toLocaleTimeString("en-US", {
                  timeZone: "America/Chicago",
                })
              : "—",
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-neutral-800 px-3 py-2">
            <div className="text-xs text-neutral-400">{label}</div>
            <div className="mt-1 font-mono">{value}</div>
          </div>
        ))}
      </div>
      {!health.configured && (
        <p className="text-sm text-neutral-400">
          Connect an Arc testnet Stream to confirm policies and payouts from
          vault events. Unsubmitted transactions are not counted as onchain
          confirmations.
        </p>
      )}
      {!compact && (
        <>
          <div className="space-y-1 break-all text-xs text-neutral-500">
            <p>Arc testnet · Chain {health.chainId}</p>
            <p>Vault {health.vault}</p>
            {health.streamId && <p>Stream {health.streamId}</p>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-neutral-400">
                <tr>
                  <th className="p-3">Activity</th>
                  <th className="p-3">Policy / market</th>
                  <th className="p-3">Block</th>
                  <th className="p-3">Transaction</th>
                </tr>
              </thead>
              <tbody>
                {health.recent.map((event) => (
                  <tr key={event.id} className="border-t border-neutral-800">
                    <td className="p-3">
                      <div>{names[event.name] ?? event.name}</div>
                      <div
                        className={
                          event.canonical
                            ? "text-xs text-emerald-400"
                            : "text-xs text-amber-300"
                        }
                      >
                        {event.canonical
                          ? "Confirmed on Arc"
                          : "Removed by chain reconciliation"}
                        {event.name === "PolicySettled" && event.canonical
                          ? event.args.triggered
                            ? ` · ${formatUnits(BigInt(String(event.args.paid)), 6)} USDC paid`
                            : " · Coverage expired"
                          : ""}
                      </div>
                    </td>
                    <td
                      className="p-3 font-mono text-xs text-neutral-400"
                      title={event.policyId ?? event.marketRef}
                    >
                      {(event.policyId ?? event.marketRef).slice(0, 12)}…
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {event.blockNumber.toLocaleString()}
                    </td>
                    <td className="p-3">
                      <a
                        className="font-mono text-xs text-blue-300 hover:underline"
                        href={`https://testnet.arcscan.app/tx/${event.transactionHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {event.transactionHash.slice(0, 10)}…
                        {event.transactionHash.slice(-6)}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!health.recent.length && (
              <div className="border-t border-neutral-800 p-6 text-center text-neutral-500">
                No vault events received yet.
              </div>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            Historical replays are deduplicated. Orphaned events remain visible
            for audit and do not drive policy status.
          </p>
        </>
      )}
    </section>
  );
}
