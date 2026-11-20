"use client";
import { useState } from "react";
import type { TicketEvent } from "@/lib/catalog";
import Icon from "./TicketmasterIcon";

function point(rx: number, ry: number, a: number) {
  return [
    Number((400 + rx * Math.cos(a)).toFixed(3)),
    Number((260 + ry * Math.sin(a)).toFixed(3)),
  ];
}
function wedge(
  outerX: number,
  outerY: number,
  innerX: number,
  innerY: number,
  start: number,
  end: number,
) {
  const a = point(outerX, outerY, start),
    b = point(outerX, outerY, end),
    c = point(innerX, innerY, end),
    d = point(innerX, innerY, start);
  return `M${a} A${outerX},${outerY} 0 0 1 ${b} L${c} A${innerX},${innerY} 0 0 0 ${d} Z`;
}
export default function VenueMap({
  ev,
  selected = 1,
  onSelect,
  mini = false,
}: {
  ev: TicketEvent;
  selected?: number;
  onSelect?: (index: number) => void;
  mini?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [legend, setLegend] = useState(true);
  const isMsg = ev.venue === "Madison Square Garden" && ev.league === "NBA";
  const sourcePins = [
    [483, 60],
    [371, 275],
    [456, 326],
    [422, 381],
  ];
  const rings = [
    [350, 218, 283, 157, 200],
    [276, 150, 200, 106, 100],
    [194, 99, 145, 78, 1],
  ];
  return (
    <div className={`tm-venue-map ${mini ? "is-mini" : ""}`}>
      <svg
        viewBox={isMsg ? "0 0 1024 768" : "0 0 800 520"}
        role="img"
        aria-label={`${ev.venue} seating map`}
      >
        <title>{`${ev.venue} seating map`}</title>
        {isMsg ? (
          <g
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "420px 384px",
              transition: "transform 180ms ease",
            }}
          >
            <image
              href="/ticketmaster/msg-knicks-seating.png"
              width="1024"
              height="768"
            />
            {!mini &&
              sourcePins.map(([x, y], i) => (
                <g
                  key={i}
                  className="tm-map-section"
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${ev.tiers[i]?.name}, ${ev.tiers[i]?.section}`}
                  onClick={() => onSelect?.(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect?.(i);
                    }
                  }}
                >
                  <title>{`${ev.tiers[i]?.name} · ${ev.tiers[i]?.section}`}</title>
                  <circle
                    cx={x}
                    cy={y}
                    r={selected === i ? 17 : 12}
                    fill={selected === i ? "#048851" : "#024ddf"}
                    stroke="white"
                    strokeWidth="4"
                  />
                  <circle cx={x} cy={y} r="30" fill="transparent" />
                </g>
              ))}
          </g>
        ) : (
          <g
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "400px 260px",
              transition: "transform 180ms ease",
            }}
          >
            <ellipse
              cx="400"
              cy="260"
              rx="366"
              ry="235"
              fill="#dedede"
              stroke="#cacaca"
            />
            <ellipse cx="400" cy="260" rx="354" ry="222" fill="#fafafa" />
            {rings.map(([ox, oy, ix, iy, base], r) =>
              Array.from({ length: 28 }, (_, i) => {
                const start = (i / 28) * Math.PI * 2 + 0.009,
                  end = ((i + 1) / 28) * Math.PI * 2 - 0.009;
                const tier = r === 0 ? 0 : r === 1 ? (i % 5 === 0 ? 2 : 1) : 3;
                const available = i % 6 !== 0;
                const active = selected === tier;
                const a = (start + end) / 2;
                const p = point((ox + ix) / 2, (oy + iy) / 2, a);
                const select = () => onSelect?.(tier);
                return (
                  <g
                    key={`${r}-${i}`}
                    className={mini ? "" : "tm-map-section"}
                    role={!mini && onSelect ? "button" : undefined}
                    tabIndex={!mini && onSelect ? 0 : undefined}
                    aria-label={
                      !mini
                        ? `Select ${ev.tiers[tier]?.name ?? "seats"}, section ${base + i}`
                        : undefined
                    }
                    onClick={select}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        select();
                      }
                    }}
                  >
                    <path
                      d={wedge(ox, oy, ix, iy, start, end)}
                      fill={
                        available
                          ? active
                            ? "#2455dc"
                            : r === 0
                              ? "#95acf2"
                              : "#6b8ce9"
                          : "#d3d3d3"
                      }
                      stroke="white"
                      strokeWidth="1.3"
                    />
                    {!mini && (
                      <text
                        x={p[0]}
                        y={p[1]}
                        dominantBaseline="middle"
                        textAnchor="middle"
                        fill={active && available ? "white" : "#3a414e"}
                        fontSize={r === 2 ? 9 : 11}
                      >
                        {base + i}
                      </text>
                    )}
                  </g>
                );
              }),
            )}
            <rect x="265" y="184" width="270" height="152" fill="#e9e9e9" />
            {ev.kind === "concert" ? (
              <>
                <rect x="475" y="190" width="50" height="140" fill="#333" />
                <text
                  x="500"
                  y="260"
                  textAnchor="middle"
                  fill="white"
                  fontSize="14"
                  transform="rotate(-90 500 260)"
                >
                  STAGE
                </text>
              </>
            ) : (
              <g>
                <rect
                  x="303"
                  y="207"
                  width="194"
                  height="106"
                  fill={ev.league === "NHL" ? "#f5fbff" : "#e4c797"}
                  stroke="#bbb2a2"
                />
                <rect
                  x="310"
                  y="214"
                  width="180"
                  height="92"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.5"
                />
                <path
                  d="M400 214V306M310 237H339V283H310M490 237H461V283H490"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.5"
                />
                <circle
                  cx="400"
                  cy="260"
                  r="16"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.5"
                />
                <circle cx="334" cy="260" r="2" fill="#a86c2b" />
                <circle cx="466" cy="260" r="2" fill="#a86c2b" />
                <text
                  x="400"
                  y="263"
                  textAnchor="middle"
                  fill="#736d64"
                  fontSize="8"
                  fontWeight="700"
                >
                  {ev.home?.abbr ?? ev.league}
                </text>
              </g>
            )}
            <g fill="#eee" stroke="#fff">
              {Array.from({ length: 12 }, (_, i) => (
                <rect
                  x={275 + i * 21}
                  y="180"
                  width="17"
                  height="14"
                  key={`a${i}`}
                />
              ))}
              {Array.from({ length: 12 }, (_, i) => (
                <rect
                  x={275 + i * 21}
                  y="326"
                  width="17"
                  height="14"
                  key={`b${i}`}
                />
              ))}
            </g>
          </g>
        )}
      </svg>
      {!mini && (
        <>
          <div className="tm-map-controls">
            <button aria-label="Reset map" onClick={() => setZoom(1)}>
              <Icon name="home-03" />
            </button>
            <button
              aria-label="Zoom in"
              onClick={() => setZoom(Math.min(2.4, zoom + 0.35))}
            >
              <Icon name="plus" />
            </button>
            <button
              aria-label="Zoom out"
              onClick={() => setZoom(Math.max(0.7, zoom - 0.35))}
            >
              <Icon name="minus" />
            </button>
          </div>
          <div className="tm-map-legend">
            <button onClick={() => setLegend(!legend)} aria-expanded={legend}>
              Legend <Icon name="chevron-down" />
            </button>
            {legend && (
              <div>
                <span>
                  <i className="tm-dot available" /> Available
                </span>
                <span>
                  <i className="tm-dot selected" /> Selected section
                </span>
                <span>
                  <i className="tm-dot unavailable" /> Unavailable
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
