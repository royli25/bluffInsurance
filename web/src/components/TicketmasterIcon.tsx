import type { CSSProperties } from "react";

// Original SVGs: https://www.untitledui.com/free-icons → github.com/untitleduico/icons.
// CSS masks preserve the original 24×24 geometry and scale strokes uniformly.
export type IconName =
  | "user-01"
  | "x-close"
  | "star-01"
  | "ticket-01"
  | "search-lg"
  | "marker-pin-01"
  | "calendar"
  | "menu-01"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "plus"
  | "minus"
  | "info-circle"
  | "shield-tick"
  | "credit-card-01"
  | "check"
  | "heart"
  | "arrow-right"
  | "lock-01"
  | "sliders-04"
  | "home-03"
  | "check-circle"
  | "clock"
  | "cloud-01"
  | "activity-heart"
  | "building-02"
  | "gift-01"
  | "mail-01";
export default function Icon({
  name,
  className = "",
  style,
}: {
  name: IconName;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`tm-icon ${className}`}
      style={{
        maskImage: `url(/ticketmaster/icons/${name}.svg)`,
        WebkitMaskImage: `url(/ticketmaster/icons/${name}.svg)`,
        ...style,
      }}
    />
  );
}
