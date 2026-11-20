import Link from "next/link";
import ConsoleNav from "@/components/ConsoleNav";
import { arcMode } from "@/lib/arc/client";
import { hedgeMode } from "@/lib/gemini/trading";
export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const simulated = arcMode() === "simulated" || hedgeMode() === "simulated";
  return (
    <div className="min-h-screen bg-neutral-950 text-sm text-neutral-100 md:flex">
      <aside className="flex flex-col border-b border-neutral-800 bg-neutral-950 p-4 md:sticky md:top-0 md:h-screen md:w-52 md:shrink-0 md:border-r md:border-b-0">
        <Link
          href="/console"
          className="mb-5 flex items-baseline gap-2 px-3 py-3 text-xl font-semibold tracking-tight"
        >
          bluff
          <span className="text-xs font-normal tracking-normal text-neutral-600">
            for business
          </span>
        </Link>
        <ConsoleNav />
        <div className="mt-auto px-3 pb-2 pt-5 text-xs md:pt-10">
          <p className="mb-4 hidden items-center gap-2 text-neutral-500 md:inline-flex">
            <span
              className={`h-1.5 w-1.5 rounded-full ${simulated ? "bg-amber-300" : "bg-emerald-300"}`}
            />
            {simulated ? "Demo transactions" : "Live transactions"}
          </p>
          <details className="text-neutral-600">
            <summary className="cursor-pointer hover:text-neutral-300">
              Integrations
            </summary>
            <div className="mt-3 grid gap-3">
              <Link href="/console/activity" className="hover:text-white">
                Arc & QuickNode activity
              </Link>
              <Link href="/console/scanner" className="hover:text-white">
                Gemini markets
              </Link>
            </div>
          </details>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">
        {children}
      </main>
    </div>
  );
}
