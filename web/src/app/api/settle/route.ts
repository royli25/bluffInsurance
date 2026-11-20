import { NextResponse } from "next/server";
import { settle } from "@/lib/service";

export async function POST(req: Request) {
  const { eventId, coverageId, triggered, demo } = await req.json();
  try {
    if (typeof triggered !== "boolean")
      throw new Error("Choose a valid event outcome.");
    return NextResponse.json(
      await settle(eventId, coverageId, triggered, demo === true),
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
