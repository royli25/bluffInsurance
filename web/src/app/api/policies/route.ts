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
      demo: body.demo === true,
      quoteId: typeof body.quoteId === "string" ? body.quoteId : undefined,
      requestId:
        typeof body.requestId === "string" ? body.requestId : undefined,
    });
    return NextResponse.json(
      { policy },
      { status: policy.status === "pending" ? 202 : 200 },
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
