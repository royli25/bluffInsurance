import { NextResponse } from "next/server";
import { createCheckoutQuote } from "@/lib/service";

export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const quote = await createCheckoutQuote({
      eventId: body.eventId,
      tierId: body.tierId,
      qty: body.qty,
      rooting: body.rooting ?? "home",
    });
    return NextResponse.json({ quote }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
