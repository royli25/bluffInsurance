import "server-only";
import { db } from "../store";
import { streamConfig } from "./config";
export function streamHealth() {
  const config = streamConfig();
  const snapshot = db.streamSnapshot(config.streamId);
  const configured =
    config.enabled && config.secret.length >= 32 && !!config.streamId;
  const stale = snapshot.lastDeliveryAt
    ? Date.now() - new Date(snapshot.lastDeliveryAt).getTime() > 120_000
    : false;
  const status = !config.enabled
    ? "disabled"
    : !configured
      ? "configuration-required"
      : !snapshot.lastDeliveryAt
        ? "awaiting-data"
        : stale
          ? "stale"
          : "connected";
  return {
    status,
    enabled: config.enabled,
    configured,
    chainId: config.chainId,
    vault: config.vault,
    streamId: config.streamId || null,
    ...snapshot,
  };
}
