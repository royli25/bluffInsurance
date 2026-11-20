import Link from "next/link";
import Icon from "./TicketmasterIcon";
export default function DemoSteps({
  eventId,
  published,
  purchased,
  resolved,
}: {
  eventId: string;
  published: boolean;
  purchased: boolean;
  resolved: boolean;
}) {
  const steps = [
    {
      label: "Publish protection",
      done: published,
      href: `/console/events/${eventId}#protection`,
    },
    {
      label: "Try the checkout",
      done: purchased,
      href: published ? `/demo/checkout?event=${eventId}` : null,
    },
    {
      label: "Resolve the outcome",
      done: resolved,
      href: purchased ? `/console/events/${eventId}#resolve` : null,
    },
  ];
  return (
    <ol
      aria-label="Demo flow"
      className="flex flex-wrap items-center gap-5 border-b border-neutral-800 pb-5"
    >
      {steps.map((s, i) => (
        <li key={s.label}>
          <div className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${s.done ? "bg-emerald-400/10 text-emerald-300" : "bg-neutral-800 text-neutral-400"}`}
            >
              {s.done ? <Icon name="check" className="business-icon" /> : i + 1}
            </span>
            {s.href ? (
              <Link href={s.href} className="text-sm hover:underline">
                {s.label}
              </Link>
            ) : (
              <span className="text-sm text-neutral-600">{s.label}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
