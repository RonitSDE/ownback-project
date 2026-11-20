# OWNBACK v3.10.10 — Base Mainnet NO-GO register

**This package is NOT safe to activate on mainnet merely by changing the chain ID.** The Solidity mainnet contracts are candidates, not independently audited or deployed here.

## Confirmed issue A — Shopify claim worker
The claim email flow is mock-stock **testnet only**. `scripts/shopify-claim-mode.mjs` explicitly refuses chain 8453 under every feature-flag combination. Do not delete that guard. A reviewed production claim delivery flow with correct, issuer-approved disclosures, account eligibility verification, KYC/jurisdiction rules, refunds, and end-to-end tests is required. The Shopify settlement worker's existing mainnet support alone does not complete this customer claim journey.

## Confirmed issue B — native checkout reward promises vs B20 inventory
The current `OwnbackMainnet.pay()` reserves merchant USDC without atomically reserving B20 inventory from the independent `InventoryB20Adapter`. The adapter rejects empty inventory when delivery is attempted, but that can leave a customer promised stock without timely settlement. **No code patch here claims to solve this problem.** Before accepting mainnet purchases, complete a security-reviewed inventory/liability reservation or equivalent robust risk control, enforce operating caps and paused admission on insufficient capacity, and test under concurrency and oracle disruption.

## Other non-negotiable gates
- Green clean install + Next build + Foundry adversarial/invariant and Anvil E2E tests at exact tagged SHA; independent security review; owner/adapter authority and multisig handoff.
- Valid real B20 inventory for *each* immutable vault-bound adapter, real Chainlink prices, issuer eligibility/transfer controls, and legal sign-offs.
- Live RPC, real receipts, source-verified contracts, restricted allowlisted canary, operational monitoring, incident/withdrawal/rollback procedures.
- Shopify shop-scoped IAM and tenant isolation before onboarding unrelated live merchants; tested proxy trust, webhook refund races, worker crash replay.
- Never present testnet/mock-stock balances as actual equity ownership. Testnet receipts alone do not prove mainnet readiness.

**Decision:** deploy v3.10.10 to Base Sepolia for judging/merchant testing; keep mainnet real-money operations OFF.
