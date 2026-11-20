import { NextResponse } from "next/server";
import { createCustomEvent } from "@/lib/service";

export async function POST(req: Request) {
  try {
    const ev = await createCustomEvent(await req.json());
    return NextResponse.json({ event: ev });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
