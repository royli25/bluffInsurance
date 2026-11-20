// Deploy BluffProtectionVault to Arc testnet with viem (uses global fetch, so it
// honors HTTPS_PROXY when run with NODE_USE_ENV_PROXY=1). Same output as deploy.ts.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  fs.readFileSync(path.join(here, "..", ".env"), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const rpc = env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
const usdc = env.USDC_ADDRESS || "0x3600000000000000000000000000000000000000";
const arc = defineChain({ id: 5042002, name: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } });
const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY);
const art = JSON.parse(fs.readFileSync(path.join(here, "..", "artifacts", "contracts", "BluffProtectionVault.sol", "BluffProtectionVault.json"), "utf8"));
const pub = createPublicClient({ chain: arc, transport: http() });
const wallet = createWalletClient({ account, chain: arc, transport: http() });

const operator = env.OPERATOR_ADDRESS || account.address;
const oracle = env.ORACLE_ADDRESS || account.address;
console.log("Deployer", account.address);
const hash = await wallet.deployContract({ abi: art.abi, bytecode: art.bytecode, args: [usdc, operator, oracle] });
console.log("Deploy tx", hash);
const rcpt = await pub.waitForTransactionReceipt({ hash });
console.log("BluffProtectionVault deployed at", rcpt.contractAddress, "block", rcpt.blockNumber);

const out = path.join(here, "..", "..", "web", "src", "lib", "arc", "deployment.json");
fs.writeFileSync(out, JSON.stringify({
  address: rcpt.contractAddress, chainId: 5042002, network: "arcTestnet", usdc, operator, oracle,
  deployTx: hash, deployedAt: new Date().toISOString(), explorer: `https://testnet.arcscan.app/address/${rcpt.contractAddress}`, abi: art.abi,
}, null, 2) + "\n");
console.log("Wrote", out);
