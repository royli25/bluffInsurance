import { streamHealth } from "@/lib/quicknode/health";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(streamHealth(), {
    headers: { "Cache-Control": "no-store" },
  });
}
