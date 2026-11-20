import "server-only";
import crypto from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  parseUnits,
  toHex,
  erc20Abi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import deployment from "./deployment.json";
import { streamConfirmationRequired } from "../quicknode/config";

/**
 * Arc (Circle's stablecoin L1) settlement layer.
 * LIVE when ARC_OPERATOR_KEY is set and deployment.json has a vault address
 * (run `npm run deploy:arc` in /contracts). Otherwise SIMULATED: we compute the
 * exact same policyId / marketRef hashes and return a deterministic mock tx.
 */
export const arcChain = defineChain({
  id: deployment.chainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
});

const vaultAddress = (process.env.ARC_VAULT_ADDRESS ??
  deployment.address) as Hex | null;
export const arcMode = (): "live" | "simulated" =>
  process.env.ARC_OPERATOR_KEY && vaultAddress ? "live" : "simulated";

export const toBytes32 = (s: string): Hex => keccak256(toHex(s));
/** Testnet budget: record on-chain amounts at ARC_AMOUNT_SCALE (default 1/100) of the USD figures. */
export const ARC_SCALE = Number(process.env.ARC_AMOUNT_SCALE ?? "0.01");
const usdc = (n: number) => parseUnits((n * ARC_SCALE).toFixed(6), 6);

export interface ArcReceipt {
  mode: "live" | "simulated";
  // A persisted purchase intent has no transaction hash until submission or
  // an independently observed PolicyPurchased event supplies one.
  txHash?: Hex;
  explorerUrl?: string;
  policyIdHex?: Hex;
  marketRefHex?: Hex;
}

const fakeTx = (): Hex => `0x${crypto.randomBytes(32).toString("hex")}`;
const explorer = (tx: string) =>
  `${arcChain.blockExplorers.default.url}/tx/${tx}`;

function clients() {
  const account = privateKeyToAccount(process.env.ARC_OPERATOR_KEY as Hex);
  const transport = http();
  return {
    account,
    pub: createPublicClient({ chain: arcChain, transport }),
    wallet: createWalletClient({ account, chain: arcChain, transport }),
  };
}

export async function recordPolicyOnArc(p: {
  policyId: string;
  holder?: Hex;
  premium: number;
  payout: number;
  marketRef: string;
  trigger: string;
  expiry: Date;
  simulate?: boolean;
}): Promise<ArcReceipt> {
  const policyIdHex = toBytes32(p.policyId);
  const marketRefHex = toBytes32(p.marketRef);
  if (p.simulate || arcMode() === "simulated") {
    const tx = fakeTx();
    return {
      mode: "simulated",
      txHash: tx,
      explorerUrl: explorer(tx),
      policyIdHex,
      marketRefHex,
    };
  }
  const { account, pub, wallet } = clients();
  const holder = p.holder ?? account.address; // custodial wallet per fan in prod
  const approve = await wallet.writeContract({
    address: deployment.usdc as Hex,
    abi: erc20Abi,
    functionName: "approve",
    args: [vaultAddress!, usdc(p.premium)],
  });
  if (
    (await pub.waitForTransactionReceipt({ hash: approve })).status !==
    "success"
  )
    throw new Error("Arc premium approval reverted");
  const tx = await wallet.writeContract({
    address: vaultAddress!,
    abi: deployment.abi,
    functionName: "purchasePolicy",
    args: [
      policyIdHex,
      holder,
      usdc(p.premium),
      usdc(p.payout),
      marketRefHex,
      p.trigger,
      BigInt(Math.floor(p.expiry.getTime() / 1000)),
    ],
  });
  // The Stream is the confirmation source. Return the submitted hash promptly;
  // a reverted transaction emits no purchase event and cannot activate a policy.
  if (
    !streamConfirmationRequired("live") &&
    (await pub.waitForTransactionReceipt({ hash: tx })).status !== "success"
  )
    throw new Error("Arc purchase reverted");
  return {
    mode: "live",
    txHash: tx,
    explorerUrl: explorer(tx),
    policyIdHex,
    marketRefHex,
  };
}

export async function settleOnArc(
  marketRef: string,
  triggered: boolean,
  policyIds: string[],
  hedgeProceeds: number,
  totalPayout = 0,
  simulate = false,
): Promise<ArcReceipt> {
  if (simulate || arcMode() === "simulated") {
    const tx = fakeTx();
    return {
      mode: "simulated",
      txHash: tx,
      explorerUrl: explorer(tx),
      marketRefHex: toBytes32(marketRef),
    };
  }
  const { pub, wallet } = clients();
  // Hedge proceeds land in the vault; for proxy (partial) hedges the Bluff reserve tops up the residual.
  const deposit = Math.max(hedgeProceeds, totalPayout);
  if (triggered && deposit > 0) {
    const a = await wallet.writeContract({
      address: deployment.usdc as Hex,
      abi: erc20Abi,
      functionName: "approve",
      args: [vaultAddress!, usdc(deposit)],
    });
    if ((await pub.waitForTransactionReceipt({ hash: a })).status !== "success")
      throw new Error("Arc proceeds approval reverted");
    const d = await wallet.writeContract({
      address: vaultAddress!,
      abi: deployment.abi,
      functionName: "depositHedgeProceeds",
      args: [usdc(deposit), toBytes32(marketRef)],
    });
    if ((await pub.waitForTransactionReceipt({ hash: d })).status !== "success")
      throw new Error("Arc proceeds deposit reverted");
  }
  const tx = await wallet.writeContract({
    address: vaultAddress!,
    abi: deployment.abi,
    functionName: "settleMarket",
    args: [toBytes32(marketRef), triggered, policyIds.map(toBytes32)],
  });
  if (
    !streamConfirmationRequired("live") &&
    (await pub.waitForTransactionReceipt({ hash: tx })).status !== "success"
  )
    throw new Error("Arc settlement reverted");
  return {
    mode: "live",
    txHash: tx,
    explorerUrl: explorer(tx),
    marketRefHex: toBytes32(marketRef),
  };
}
