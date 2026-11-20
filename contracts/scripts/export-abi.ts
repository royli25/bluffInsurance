import * as fs from "fs";
import hre from "hardhat";
import { DEPLOYMENT_PATH, writeDeployment } from "./write-deployment";

// Writes the ABI for the web app. Keeps an existing deployed address if present.
async function main() {
  await hre.run("compile");
  let address: string | null = null;
  let extra: Record<string, unknown> = {};
  if (fs.existsSync(DEPLOYMENT_PATH)) {
    const prev = JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, "utf8"));
    address = prev.address ?? null;
    const { abi: _abi, address: _a, chainId: _c, network: _n, usdc: _u, ...rest } = prev;
    extra = rest;
  }
  await writeDeployment(address, extra);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
