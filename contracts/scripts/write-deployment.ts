import * as fs from "fs";
import * as path from "path";
import { artifacts } from "hardhat";

export const DEPLOYMENT_PATH = path.join(__dirname, "..", "..", "web", "src", "lib", "arc", "deployment.json");

export async function writeDeployment(address: string | null, extra: Record<string, unknown> = {}) {
  const artifact = await artifacts.readArtifact("BluffProtectionVault");
  fs.mkdirSync(path.dirname(DEPLOYMENT_PATH), { recursive: true });
  const out = {
    address,
    chainId: 5042002,
    network: "arcTestnet",
    usdc: process.env.USDC_ADDRESS || "0x3600000000000000000000000000000000000000",
    ...extra,
    abi: artifact.abi,
  };
  fs.writeFileSync(DEPLOYMENT_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${path.relative(process.cwd(), DEPLOYMENT_PATH)} (address: ${address})`);
}
