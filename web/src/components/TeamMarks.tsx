import Image from "next/image";
import type { TicketEvent } from "@/lib/catalog";
import logos from "@/lib/team-logos.json";

type Participant = { abbreviation: string; side?: string };

/** Decorative identifiers; the event or market title beside them provides the names. */
export default function TeamMarks({ league, participants, large = false }: {
  league: string;
  participants: Participant[];
  large?: boolean;
}) {
  if (!participants.length) return null;
  const size = large ? 48 : 32;
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center gap-1.5">
      {[...participants].sort((a, b) => Number(a.side === "home") - Number(b.side === "home")).slice(0, 2).map((team) => {
        const src = (logos as Record<string, string>)[`${league.toUpperCase()}:${team.abbreviation.toUpperCase()}`];
        return (
          <span key={`${team.side}-${team.abbreviation}`} className={`inline-flex shrink-0 items-center justify-center rounded-md bg-neutral-800 ring-1 ring-inset ring-white/5 ${large ? "h-14 w-14" : "h-9 w-9"}`}>
            {src ? <Image src={src} alt="" width={size} height={size} className="object-contain p-0.5" /> : <span className="px-1 text-[10px] font-semibold text-neutral-400">{team.abbreviation}</span>}
          </span>
        );
      })}
    </span>
  );
}

export function EventMarks({ ev, large = false }: { ev: Pick<TicketEvent, "league" | "home" | "away">; large?: boolean }) {
  const participants = [ev.away, ev.home].flatMap((team) => team ? [{ abbreviation: team.abbr, side: team.side }] : []);
  return <TeamMarks league={ev.league} participants={participants} large={large} />;
}

export function PolicyMarks({ eventId, large = false }: { eventId: string; large?: boolean }) {
  const match = eventId.replace(/^custom-/, "").match(/^([a-z0-9]+)-\d{10}-([a-z0-9]+)-([a-z0-9]+)$/i);
  if (!match) return null;
  return <TeamMarks league={match[1]} participants={[{ abbreviation: match[2], side: "away" }, { abbreviation: match[3], side: "home" }]} large={large} />;
}
