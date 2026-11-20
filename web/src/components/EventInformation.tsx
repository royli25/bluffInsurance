"use client";
import { useRef } from "react";
import Icon from "./TicketmasterIcon";
export default function EventInformation({
  title,
  date,
  venue,
}: {
  title: string;
  date: string;
  venue: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button className="tm-more-info" onClick={() => ref.current?.showModal()}>
        <Icon name="info-circle" /> More Info
      </button>
      <dialog
        ref={ref}
        className="tm-dialog"
        onClick={(e) => {
          if (e.target === ref.current) ref.current.close();
        }}
      >
        <div>
          <button
            className="tm-dialog-close tm-icon-button"
            aria-label="Close event information"
            onClick={() => ref.current?.close()}
          >
            <Icon name="x-close" />
          </button>
          <h2>{title}</h2>
          <dl>
            <dt>Date</dt>
            <dd>{date}</dd>
            <dt>Venue</dt>
            <dd>{venue}</dd>
          </dl>
          <h3>Event Info</h3>
          <p>
            Mobile entry. Your tickets will be available in your account after
            checkout. Prices include fees.
          </p>
          <h3>Bluff Protect</h3>
          <p>
            Optional protection is available at checkout. Choose your coverage
            and see the exact payout before you place your order.
          </p>
          <button className="tm-button" onClick={() => ref.current?.close()}>
            Done
          </button>
        </div>
      </dialog>
    </>
  );
}
