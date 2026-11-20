import StreamMonitor from "@/components/StreamMonitor";
import { streamHealth } from "@/lib/quicknode/health";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default function Activity() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Onchain activity</h1>
        <p className="mt-2 max-w-2xl text-neutral-400">
          Independent Arc confirmations power policy and payout status.
          QuickNode Streams delivers the vault’s events into a durable,
          replay-safe journal.
        </p>
      </div>
      <StreamMonitor initial={streamHealth()} />
      <section className="rounded-lg bg-neutral-900 p-4 text-neutral-400">
        <h2 className="mb-2 font-semibold text-neutral-200">
          How confirmation works
        </h2>
        <p>
          Arc vault → QuickNode Streams → authenticated webhook → event journal
          → policy status.
        </p>
        <p className="mt-2">
          The webhook confirms blockchain execution. It does not choose sporting
          results or submit payouts. The settlement operator still supplies the
          verified market outcome.
        </p>
      </section>
    </div>
  );
}
