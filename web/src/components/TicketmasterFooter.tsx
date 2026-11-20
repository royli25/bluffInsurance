import Link from "next/link";
import { TicketmasterLogo } from "./SeatwiseHeader";
export default function TicketmasterFooter() {
  const columns = [
    {
      title: "Helpful Links",
      links: [
        ["Help/FAQ", "https://help.ticketmaster.com/"],
        ["Sell", "https://www.ticketmaster.com/sell"],
        ["My Account", "/seatwise/account"],
        ["Contact Us", "https://help.ticketmaster.com/"],
        ["Gift Cards", "https://www.ticketmaster.com/giftcards"],
        [
          "Do Not Sell or Share My Personal Information",
          "https://privacy.ticketmaster.com/",
        ],
        ["Bluff Console", "/console"],
      ],
    },
    {
      title: "Our Network",
      links: [
        ["Live Nation", "https://www.livenation.com/"],
        ["House of Blues", "https://www.houseofblues.com/"],
        ["Front Gate Tickets", "https://www.frontgatetickets.com/"],
        ["TicketWeb", "https://www.ticketweb.com/"],
        ["universe", "https://www.universe.com/"],
        ["NFL", "/seatwise?category=sports&league=NFL"],
        ["NBA", "/seatwise?category=sports&league=NBA"],
        ["NHL", "/seatwise?category=sports&league=NHL"],
      ],
    },
    {
      title: "About Us",
      links: [
        ["Who We Are", "https://business.ticketmaster.com/"],
        ["Ticketing Truths", "https://www.ticketmaster.com/ticketing-truths/"],
        ["Ad Choices", "https://privacy.ticketmaster.com/"],
        ["Careers", "https://jobs.ticketmaster.com/"],
        ["Ticket Your Event", "https://business.ticketmaster.com/"],
        ["Innovation", "https://business.ticketmaster.com/"],
      ],
    },
    {
      title: "Friends & Partners",
      links: [
        ["PayPal", "https://www.paypal.com/"],
        ["Allianz", "https://www.eventticketprotection.com/"],
        ["AWS", "https://aws.amazon.com/"],
        ["Affiliates", "https://www.ticketmaster.com/affiliates/"],
      ],
    },
  ];
  return (
    <footer className="tm-footer">
      <div className="tm-footer-main">
        <div className="tm-footer-brand">
          <Link href="/seatwise">
            <TicketmasterLogo />
          </Link>
          <p>Let’s connect</p>
          <div className="tm-social-links">
            <a href="https://www.facebook.com/Ticketmaster">Facebook</a>
            <a href="https://www.instagram.com/ticketmaster/">Instagram</a>
            <a href="https://www.youtube.com/ticketmaster">YouTube</a>
          </div>
          <p>Download Our Apps</p>
          <div className="tm-app-links">
            <a href="https://www.ticketmaster.com/mobile">App Store</a>
            <a href="https://www.ticketmaster.com/mobile">Google Play</a>
          </div>
          <small>
            By continuing past this page, you agree to our{" "}
            <a href="https://help.ticketmaster.com/hc/en-us/articles/10468830739345-Terms-of-Use">
              terms of use
            </a>
            .
          </small>
        </div>
        {columns.map((c) => (
          <div className="tm-footer-column" key={c.title}>
            <h3>{c.title}</h3>
            {c.links.map(([name, url]) => (
              <Link href={url} key={name}>
                {name}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="tm-footer-bottom">
        <span>
          <a href="https://privacy.ticketmaster.com/">Our Policies</a> ·{" "}
          <a href="https://privacy.ticketmaster.com/">Privacy Policy</a> ·{" "}
          <a href="https://privacy.ticketmaster.com/">Cookie Policy</a>
        </span>
        <span>Ticket protection by Bluff.</span>
      </div>
    </footer>
  );
}
