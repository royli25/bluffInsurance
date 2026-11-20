import { ethers, network } from "hardhat";
import { writeDeployment } from "./write-deployment";

const DEFAULT_ARC_USDC = "0x3600000000000000000000000000000000000000";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer account. Set DEPLOYER_PRIVATE_KEY in contracts/.env");

  const usdc = process.env.USDC_ADDRESS || DEFAULT_ARC_USDC;
  const operator = process.env.OPERATOR_ADDRESS || deployer.address;
  const oracle = process.env.ORACLE_ADDRESS || deployer.address;

  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`USDC:     ${usdc}`);
  console.log(`Operator: ${operator}`);
  console.log(`Oracle:   ${oracle}`);

  const Vault = await ethers.getContractFactory("BluffProtectionVault");
  const vault = await Vault.deploy(usdc, operator, oracle);
  await vault.waitForDeployment();
  const address = await vault.getAddress();
  const tx = vault.deploymentTransaction();
  console.log(`BluffProtectionVault deployed at ${address}`);

  await writeDeployment(address, {
    operator,
    oracle,
    deployTx: tx?.hash ?? null,
    deployedAt: new Date().toISOString(),
    explorer: `https://testnet.arcscan.app/address/${address}`,
  });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
