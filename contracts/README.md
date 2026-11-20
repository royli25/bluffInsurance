# Bluff contracts — `BluffProtectionVault` on Arc

USDC escrow for parametric ticket protection. Each policy is tied to a Gemini
prediction-market contract (`marketRef`). The backend buys the matching hedge on
Gemini. When the market resolves, the oracle settles every policy on it: if the
trigger happened, the fan gets USDC; otherwise the policy expires.

## Roles
| Role | Who | Can |
|---|---|---|
| owner | deployer | `setOperator`, `setOracle`, `withdrawSurplus` |
| operator | Bluff backend | `purchasePolicy` (pays the premium in USDC for the fan), `depositHedgeProceeds` |
| oracle | Bluff resolver (reads Gemini market settlement) | `settleMarket` |

## Functions
- `purchasePolicy(policyId, holder, premium, payout, marketRef, triggerText, expiry)`: pulls `premium` USDC from the operator and records an Active policy. Duplicate ids and zero payouts are rejected. Adds `payout` to `totalLiability`.
- `depositHedgeProceeds(amount, marketRef)`: moves USDC realised from the Gemini hedge into reserves.
- `settleMarket(marketRef, triggered, policyIds[])`: for each Active policy on `marketRef`, either pays `payout` to the holder (PaidOut) or marks it Expired. Reverts with `InsufficientReserves` if the vault can't cover a payout.
- Views: `reserves()`, `surplus()` (reserves above liability), `coverageRatioBps()` (10000 = fully covered), `getPolicy(id)`.
- `withdrawSurplus(to, amount)`: owner can withdraw only `reserves − totalLiability`.

## Arc testnet config
| | |
|---|---|
| RPC | `https://rpc.testnet.arc.network` |
| Chain ID | `5042002` |
| USDC (ERC-20 interface, 6 decimals) | `0x3600000000000000000000000000000000000000` |
| Explorer | `https://testnet.arcscan.app` |
| Faucet | https://faucet.circle.com (pick Arc Testnet). On Arc, USDC is also the gas token. |

## Commands
```bash
npm install
npm test                 # 14 tests, in-process Hardhat network
npm run export-abi       # writes ../web/src/lib/arc/deployment.json (address null until deployed)

cp .env.example .env     # set DEPLOYER_PRIVATE_KEY (funded from the faucet)
npm run deploy:arc       # deploys, then writes address + ABI to ../web/src/lib/arc/deployment.json
```
Optional env: `OPERATOR_ADDRESS`, `ORACLE_ADDRESS` (both default to the deployer), `USDC_ADDRESS`, `ARC_RPC_URL`.

Note: `hardhat.config.ts` compiles with the solc-js build in `node_modules/solc`, so compiling works without downloading a compiler.
