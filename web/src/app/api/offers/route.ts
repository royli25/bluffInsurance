import { NextResponse } from "next/server";
import { db } from "@/lib/store";

export async function POST(req: Request) {
  const { eventId, published, coverages } = await req.json();
  db.setOffer({ eventId, published: !!published, coverages, updatedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
