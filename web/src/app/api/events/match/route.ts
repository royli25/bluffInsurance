import { NextResponse } from "next/server";
import { matchEvent } from "@/lib/service";

export async function POST(req: Request) {
  const { query, kind = "sports", city } = await req.json();
  const matches = await matchEvent(query ?? "", kind, city);
  return NextResponse.json({
    matches: matches.map((m) => ({
      ticker: m.event.ticker,
      title: m.event.title,
      startTime: m.event.startTime ?? m.event.expiryDate,
      participants: m.event.participants,
      score: m.score,
      related: m.related,
    })),
  });
}
