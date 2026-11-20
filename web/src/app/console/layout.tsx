import Link from "next/link";
import ProviderLogo from "@/components/ProviderLogo";
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
      <aside className="flex flex-col bg-neutral-900/60 p-4 md:sticky md:top-0 md:h-screen md:w-52 md:shrink-0">
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
          <details className="text-neutral-600">
            <summary className="cursor-pointer hover:text-neutral-300">
              Integrations
            </summary>
            <div className="mt-3 grid gap-3">
              <Link href="/console/scanner" className="flex items-center py-2" aria-label="Gemini markets"><ProviderLogo provider="gemini" dark /></Link>
              <Link href="/console/activity" className="flex items-center py-2" aria-label="Arc activity"><ProviderLogo provider="arc" dark /></Link>
              <Link href="/console/activity" className="flex items-center py-2" aria-label="Quicknode activity"><ProviderLogo provider="quicknode" dark /></Link>
              <span className="text-neutral-500">{simulated ? "Execution not connected" : "Execution connected"}</span>
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
