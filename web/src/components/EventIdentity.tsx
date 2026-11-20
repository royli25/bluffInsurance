import { PolicyMarks } from "./TeamMarks";
import Icon from "./TicketmasterIcon";

export default function EventIdentity({ eventId, large = false }: { eventId: string; large?: boolean }) {
  if (/^[a-z0-9]+-\d{10}-[a-z0-9]+-[a-z0-9]+$/i.test(eventId.replace(/^custom-/, ""))) {
    return <PolicyMarks eventId={eventId} large={large} />;
  }
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-md bg-neutral-800 text-neutral-400 ${large ? "h-14 w-14" : "h-9 w-9"}`}><Icon name="ticket-01" className="business-icon" /></span>;
}
