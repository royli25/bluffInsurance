import Link from "next/link";
import type { Policy } from "@/lib/store";
import { contractStatus } from "@/lib/business";
import { usd } from "@/lib/format";
import Icon from "./TicketmasterIcon";
import EventIdentity from "./EventIdentity";
export default function ContractLedger({
  policies,
  empty = "No contracts yet",
}: {
  policies: Policy[];
  empty?: string;
}) {
  if (!policies.length)
    return (
      <div className="flex min-h-52 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <h3 className="font-semibold">{empty}</h3>
        <Link
          href="/console/events"
          className="mt-3 rounded-md bg-white px-4 py-2 text-sm font-semibold text-neutral-950"
        >
          Choose an event
        </Link>
      </div>
    );
  return (
    <div className="overflow-x-auto">
      <table
        className="w-full min-w-[760px] text-left text-sm"
        aria-label="Contract ledger"
      >
        <thead className="bg-neutral-800/40 text-xs text-neutral-500">
          <tr>
            {[
              "Started",
              "Event / protection",
              "Customer",
              "Premium",
              "Potential payout",
              "Status",
              "",
            ].map((label, i) => (
              <th
                key={i}
                scope="col"
                className={`px-5 py-3 font-normal ${i === 3 || i === 4 ? "text-right" : ""}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {policies.map((p) => (
            <tr
              key={p.id}
              className="odd:bg-white/[.015] hover:bg-white/[.04]"
            >
              <td className="whitespace-nowrap px-5 py-4 text-neutral-400">
                <time dateTime={p.createdAt}>
                  {new Date(p.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "America/Chicago",
                  })}
                </time>
              </td>
              <td className="min-w-72 max-w-sm px-5 py-4">
                <div className="flex items-center gap-3">
                  <EventIdentity eventId={p.eventId} />
                  <div className="min-w-0">
                    <Link
                      className="font-normal text-neutral-100 hover:underline"
                      href={`/console/contracts/${p.id}`}
                    >
                      {p.eventTitle}
                    </Link>
                    <div className="mt-1 text-xs text-neutral-500">
                      {p.coverageName}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4 text-neutral-400">{p.holderName}</td>
              <td className="px-5 py-4 text-right font-mono text-xs">
                {usd(p.premium)}
              </td>
              <td className="px-5 py-4 text-right font-mono text-xs text-neutral-400">
                {usd(p.payout)}
              </td>
              <td className="whitespace-nowrap px-5 py-4">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${p.status === "active" || p.status === "paid" ? "bg-emerald-400/10 text-emerald-300" : p.status === "pending" || p.status === "settling" ? "bg-amber-400/10 text-amber-300" : "bg-neutral-800 text-neutral-400"}`}
                >
                  <span className="h-1 w-1 rounded-full bg-current" />
                  {contractStatus(p)}
                </span>

              </td>
              <td className="px-5 py-4">
                <Link
                  href={`/console/contracts/${p.id}`}
                  aria-label={`View contract ${p.id}`}
                  className="text-neutral-500 hover:text-white"
                >
                  <Icon name="chevron-right" className="business-icon" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
