import { NextResponse } from "next/server";
import { purchase } from "@/lib/service";
import { db } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ policies: db.policies() });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const policy = await purchase({
      eventId: body.eventId,
      coverageId: body.coverageId,
      rooting: body.rooting ?? "home",
      tierId: body.tierId,
      qty: Number(body.qty ?? 1),
      holderName: body.holderName ?? "Guest",
      holderEmail: body.holderEmail ?? "guest@example.com",
    });
    return NextResponse.json({ policy });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
