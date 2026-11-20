import { NextResponse } from "next/server";
import { settle } from "@/lib/service";

export async function POST(req: Request) {
  const { eventId, coverageId, triggered } = await req.json();
  try {
    return NextResponse.json(await settle(eventId, coverageId, !!triggered));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
