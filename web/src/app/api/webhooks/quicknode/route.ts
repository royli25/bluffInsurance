import { db } from "@/lib/store";
import { streamConfig } from "@/lib/quicknode/config";
import { createStreamsWebhook } from "@/lib/quicknode/webhook";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createStreamsWebhook(streamConfig, db);
// Liveness only: no secret, customer record or journal payload is exposed here.
export async function GET() {
  const config = streamConfig();
  return Response.json(
    {
      service: "bluff-arc-streams",
      configured:
        config.enabled && config.secret.length >= 32 && !!config.streamId,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
