import "server-only";
import { getAddress } from "viem";
import deployment from "../arc/deployment.json";

export function streamConfig() {
  return {
    enabled: process.env.QUICKNODE_STREAMS_ENABLED === "1",
    secret: process.env.QUICKNODE_STREAM_SECURITY_TOKEN ?? "",
    streamId: process.env.QUICKNODE_STREAM_ID ?? "",
    backfillStreamIds: (process.env.QUICKNODE_BACKFILL_STREAM_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    network: process.env.QUICKNODE_STREAM_NETWORK ?? "arc-testnet",
    chainId: deployment.chainId,
    vault: getAddress(
      process.env.ARC_VAULT_ADDRESS ?? deployment.address,
    ).toLowerCase(),
  };
}
export function streamConfirmationRequired(mode: "live" | "simulated") {
  return mode === "live" && streamConfig().enabled;
}
export function assertStreamConfiguration(mode: "live" | "simulated") {
  const config = streamConfig();
  if (
    streamConfirmationRequired(mode) &&
    (config.secret.length < 32 || !config.streamId)
  ) {
    throw new Error(
      "QuickNode Streams requires a security token (minimum 32 characters) and QUICKNODE_STREAM_ID.",
    );
  }
}
