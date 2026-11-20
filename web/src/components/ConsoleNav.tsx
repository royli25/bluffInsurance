"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export default function ConsoleNav() {
  const pathname = usePathname();
  return (
    <nav
      className="flex gap-1 overflow-x-auto md:flex-col"
      aria-label="Business navigation"
    >
      {[
        ["/console", "Dashboard"],
        ["/console/events", "Events"],
        ["/console/contracts", "Contracts"],
      ].map(([href, label]) => {
        const active =
          href === "/console" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-2.5 text-sm transition-colors ${active ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-800/60 hover:text-white"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
