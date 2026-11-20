import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { streamConfig } from "../../src/lib/quicknode/config";
import { buildVaultFilter } from "../../src/lib/quicknode/filter";

loadEnvConfig(process.cwd());
const command = process.argv[2] ?? "plan";
const config = streamConfig();
const base = "https://api.quicknode.com/streams/rest/v1/streams";
function numberArg(name: string) {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  const value = Number(process.argv[i + 1]);
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${name} requires a nonnegative block number`);
  return value;
}
function webhookUrl() {
  const value = process.env.QUICKNODE_WEBHOOK_URL;
  if (!value)
    throw new Error(
      "Set QUICKNODE_WEBHOOK_URL to your public HTTPS /api/webhooks/quicknode URL.",
    );
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/api/webhooks/quicknode"
  )
    throw new Error(
      "Use an HTTPS URL ending in /api/webhooks/quicknode, without credentials or query parameters.",
    );
  return url.toString();
}
function createBody() {
  if (config.secret.length < 32)
    throw new Error(
      "Run npm run streams:init and configure the security token first.",
    );
  return {
    name: "Bluff Arc policy confirmations",
    network: config.network,
    dataset: "block_with_receipts",
    region: "usa_east",
    dataset_batch_size: 20,
    elastic_batch_enabled: true,
    keep_distance_from_tip: 0,
    fix_block_reorgs: 1,
    destination: "webhook",
    destination_attributes: {
      url: webhookUrl(),
      compression: "none",
      max_retry: 30,
      retry_interval_sec: 10,
      post_timeout_sec: 15,
      security_token: config.secret,
    },
    status: "paused",
    filter_function: Buffer.from(
      buildVaultFilter(config.vault, config.chainId),
    ).toString("base64"),
    external_id: `bluff-${config.chainId}-${config.vault}`,
    ...(numberArg("--from") !== undefined
      ? { start_range: numberArg("--from") }
      : {}),
    ...(numberArg("--to") !== undefined
      ? { end_range: numberArg("--to") }
      : {}),
  };
}
async function api(method: string, suffix: string, body?: unknown) {
  const key = process.env.QUICKNODE_API_KEY;
  if (!key)
    throw new Error(
      "Set QUICKNODE_API_KEY in .env.local. It is only used by this management command.",
    );
  const response = await fetch(base + suffix, {
    method,
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json().catch(() => null);
  // Provider responses may echo the destination security token. Never print them.
  if (!response.ok)
    throw new Error(
      `QuickNode API returned HTTP ${response.status}; check the dashboard and account permissions.`,
    );
  if (!result || typeof result !== "object")
    throw new Error(
      "QuickNode returned an invalid response; check the dashboard before retrying.",
    );
  return result as Record<string, unknown>;
}
async function run() {
  if (command === "init") {
    const file = path.join(process.cwd(), ".env.local");
    const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    const additions: string[] = [];
    const values: Record<string, string> = {
      QUICKNODE_STREAMS_ENABLED: "0",
      QUICKNODE_STREAM_SECURITY_TOKEN: randomBytes(32).toString("hex"),
      QUICKNODE_STREAM_ID: "",
      QUICKNODE_BACKFILL_STREAM_IDS: "",
      QUICKNODE_API_KEY: "",
      QUICKNODE_WEBHOOK_URL: "",
    };
    for (const [key, value] of Object.entries(values))
      if (!new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`, "m").test(existing))
        additions.push(`${key}=${value}`);
    if (additions.length)
      fs.writeFileSync(
        file,
        existing +
          "\n# QuickNode Streams (generated locally; never commit this file)\n" +
          additions.join("\n") +
          "\n",
        { mode: 0o600 },
      );
    fs.chmodSync(file, 0o600);
    console.log(
      "QuickNode environment fields are ready in .env.local. No secrets were printed. Streams remains disabled until you configure and activate it.",
    );
    return;
  }
  if (command === "filter") {
    console.log(buildVaultFilter(config.vault, config.chainId));
    return;
  }
  if (command === "plan") {
    console.log(
      JSON.stringify(
        {
          network: config.network,
          chainId: config.chainId,
          vault: config.vault,
          dataset: "block_with_receipts",
          dataset_batch_size: 20,
          destination: "webhook",
          path: "/api/webhooks/quicknode",
          initialStatus: "paused",
          tokenConfigured: config.secret.length >= 32,
          apiKeyConfigured: !!process.env.QUICKNODE_API_KEY,
          webhookConfigured: !!process.env.QUICKNODE_WEBHOOK_URL,
          streamId: config.streamId || null,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (command === "create") {
    if (config.secret.length < 32)
      throw new Error("Run npm run streams:init before creating a Stream.");
    const result = await api("POST", "", createBody());
    console.log(
      JSON.stringify(
        { id: result.id, status: result.status, network: result.network },
        null,
        2,
      ),
    );
    console.log(
      "Save the returned id as QUICKNODE_STREAM_ID. Enable Streams in .env.local, restart the application, then activate the Stream.",
    );
    return;
  }
  if (!config.streamId) throw new Error("Set QUICKNODE_STREAM_ID first.");
  if (!/^[A-Za-z0-9_-]+$/.test(config.streamId))
    throw new Error("Invalid Stream id");
  if (command === "status") {
    const result = await api("GET", `/${config.streamId}`);
    console.log(
      JSON.stringify(
        {
          id: result.id,
          status: result.status,
          network: result.network,
          currentHash: result.current_hash,
          startBlock: result.start_range,
          endBlock: result.end_range,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (command === "activate" || command === "pause") {
    if (
      command === "activate" &&
      (!config.enabled || config.secret.length < 32)
    )
      throw new Error(
        "Enable QUICKNODE_STREAMS_ENABLED=1 and configure its token before activation.",
      );
    await api("POST", `/${config.streamId}/${command}`);
    console.log(`Stream ${command} request completed.`);
    return;
  }
  if (command === "backfill") {
    const start = numberArg("--from"),
      end = numberArg("--to");
    if (start === undefined || end === undefined || end < start)
      throw new Error(
        "Backfill requires --from BLOCK --to BLOCK with a valid range.",
      );
    // A separate, explicitly allowlisted finite Stream preserves the live cursor.
    const body = createBody();
    body.name = "Bluff Arc historical reconciliation";
    body.external_id = `bluff-backfill-${config.chainId}-${config.vault}-${start}-${end}`;
    const result = await api("POST", "", body);
    console.log(
      JSON.stringify(
        {
          id: result.id,
          status: result.status,
          startBlock: start,
          endBlock: end,
        },
        null,
        2,
      ),
    );
    console.log(
      "Add this id to QUICKNODE_BACKFILL_STREAM_IDS and restart the app, then activate the finite Stream in the dashboard. The primary live Stream is unchanged.",
    );
    return;
  }
  throw new Error(
    "Use init, plan, filter, create, status, activate, pause, or backfill --from BLOCK --to BLOCK.",
  );
}
run().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
