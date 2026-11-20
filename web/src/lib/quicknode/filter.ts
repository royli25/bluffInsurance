import { vaultEventTopics } from "./events";

/** Source is sent to QuickNode's filter sandbox, not evaluated by our server. */
export function buildVaultFilter(vault: string, chainId: number) {
  return `function main(stream) {
  const vault = ${JSON.stringify(vault.toLowerCase())};
  const topics = ${JSON.stringify(vaultEventTopics)};
  const blocks = stream.data.map(function(entry) {
    const block = entry.block || entry;
    if (block.number == null || !block.hash || block.timestamp == null) throw new Error("Expected block_with_receipts block headers");
    const logs = (entry.receipts || []).flatMap(function(receipt) {
      if (receipt.status !== "0x1" && receipt.status !== 1) return [];
      return (receipt.logs || []).filter(function(log) {
        return log.address && log.address.toLowerCase() === vault && log.topics && topics.indexOf(log.topics[0].toLowerCase()) !== -1;
      }).map(function(log) {
        return Object.assign({}, log, {
          transactionHash: log.transactionHash || receipt.transactionHash,
          transactionIndex: log.transactionIndex == null ? receipt.transactionIndex : log.transactionIndex
        });
      });
    });
    return {number: block.number, hash: block.hash, timestamp: block.timestamp, logs: logs};
  });
  // Empty blocks are heartbeats and carry canonical block identities for reorgs.
  return {version: 1, chainId: ${chainId}, vault: vault, metadata: stream.metadata, blocks: blocks};
}`;
}
