import "server-only";
import { parseLevels } from "../markets/pricing";
import type { ProviderBook } from "../markets/types";
/** A bounded public depth snapshot, not a persistent trading socket. */
export function getGeminiBook(symbol: string, outcome: "yes" | "no"): Promise<ProviderBook | null> {
  if (process.env.GEMINI_OFFLINE === "1" || !/^[A-Za-z0-9-]{1,180}$/.test(symbol)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const socket = new WebSocket(process.env.GEMINI_WS_URL ?? "wss://ws.gemini.com");
    let done = false;
    const finish = (book: ProviderBook | null) => {
      if (done) return; done = true; clearTimeout(timer); socket.close(); resolve(book);
    };
    const timer = setTimeout(() => finish(null), 3500);
    socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: "SUBSCRIBE", params: [`${symbol}@depth20`] }));
    socket.onerror = () => finish(null);
    socket.onclose = () => finish(null);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data));
        const data = message.data ?? message;
        if (data.symbol?.toUpperCase() !== symbol.toUpperCase() || !Array.isArray(data.asks) || !Array.isArray(data.bids)) return;
        finish({ provider: "gemini", symbol, asks: parseLevels(outcome === "yes" ? data.asks : data.bids, outcome === "no"),
          observedAt: new Date().toISOString(), feeRate: Number(process.env.GEMINI_TAKER_FEE_RATE ?? "0.07") });
      } catch { /* Ignore non-book frames. */ }
    };
  });
}
