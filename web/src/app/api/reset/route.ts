import { NextResponse } from "next/server";
import { db } from "@/lib/store";

export async function POST() {
  db.reset();
  return NextResponse.json({ ok: true });
}
