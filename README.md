> **Deployment decision (19 Nov 2026):** v3.10.10 is a Base Sepolia / mock-stock candidate, not a certified real-B20 mainnet release. Run `npm run preflight:staging` after deployment addresses and Builder Code are configured. The deployment checklist and mainnet blockers are summarized below.

# OWNBACK v3.10.7 — Base Stocks Maxxing attribution patch

**Track:** Agentic Stock Finance · **Demonstration environment:** Base Sepolia / offline mock · **Base mainnet:** **NOT DEPLOYED**.

OWNBACK is a merchant-funded stock-linked rewards protocol. One immutable stock token can be settled by a configured vault. A policy engine only proposes feasible constraints and refuses impossible stock requests. A preference signature **cannot trade, invest, transfer, or claim**. All retention is **observed, not causal lift**.

**v3.10.10 deployment candidate (BASE SEPOLIA ONLY):** Restores proof verification, agent decision checks, original branded share preview, and fixes the recovery harness on the GitHub navigation branch. v3.10.7 introduced ERC-8021 attribution completion for native wallet, keeper and Shopify worker paths. See [`DEPLOY.md` → Builder Codes](DEPLOY.md#builder-codes). Builder Code transactions are **not** verified by the historical Sepolia proof files.

## Why OWNBACK is different

> **Other agents manage investment portfolios. OWNBACK helps merchants turn purchases into measurable stock-linked loyalty.**

Merchants define financial limits and fund campaigns. A bounded agent proposes only what the configured vault can support and refuses unsupported preferences. Customers can receive permitted mock-stock rewards on Base Sepolia after eligible purchase settlement. Merchants can inspect recorded first and repeat purchases and actual reward costs; **no verified comeback receipt, real B20 ownership, or causal retention lift is claimed** in this source.

See `/judge` for the concise flow and `/verify` for receipt-verification instructions. This is **not a deployed production release** until tagged CI, real RPC verification, contract tests and the live deployment smoke test pass.

## Begin here

- [`HISTORY.md`](HISTORY.md#v310-release) — v3.10 changes, installation, testing and limitations, plus the v3.10.1 evidence gate and v3.10.2 proof execution notes.
- [`HISTORY.md`](HISTORY.md#hackathon-submission) — the canonical 90-second judge script and Base submission claims.
- [`evidence/proofs.json`](evidence/proofs.json) — mandatory proof register; status is tracked in [Captured proof status](#captured-proof-status-not-independent-confirmation) below.

## Primary navigation

`/` → `/judge` → native Base campaign / purchases on `/growth` → one-click allowed/refused `/allocation` → `/growth` observed outcomes.

- **Merchant proof:** `/growth` reads native campaign USDC balances and purchased/delivered receipts only when a configured contract is accessible. Authenticated Shopify cohorts are _secondary_.
- **Agent policy:** `/allocation` has two 20-second, clearly labeled offline fixtures and a separate backend policy route. Backend policy refuses if the settlement token is unconfigured.
- **Proof register:** `/judge#proofs` never manufactures URLs, balance claims or signatures. A tagged release fails strict CI when receipts cannot be independently confirmed.

## Fresh install on a machine with npm network access

```bash
node --version # Node 22.16.0 recommended
npm ci
npm run check
npm run test:allocation
npm run test:retention
npm run test:judge
npm run build
npm run verify:manifest
npm run verify:proofs
```

## Live deployment (Base Sepolia, chain 84532)

This is a deployment candidate, not proof of a completed deployment or a passing release gate. Deploy to Base Sepolia with mock stock only. Keep live-stock and mainnet approval flags false. Never commit private keys or service secrets.

### Base Sepolia deployment checklist

1. Configure the Base Sepolia RPC, deployed testnet contract addresses, matching `BUILDER_CODE` and `NEXT_PUBLIC_BUILDER_CODE`, server secrets, database/Shopify credentials, and trusted proxy settings in the deployment secret manager. Set both attribution-required flags to `true` and all live-stock/mainnet flags to `false`.
2. Install dependencies and pass the checks on a clean checkout: `npm ci`, `./contracts/install-deps.sh`, `npm run check`, `npm run test:deployment-safety`, `npm test`, `npm run simulate:recovery`, `npm run test:contracts`, `npm run build`, and `npm run verify:manifest`.
3. Deploy or confirm the testnet contracts, then run `npm run preflight:staging`. Deploy the app and testnet-only keeper/Shopify workers. Smoke-test `/`, `/judge`, `/verify`, `/allocation`, and `/growth`; retain the Base Sepolia / MOCK STOCK labels. Mini-app assets do not establish that the app is published.
4. Exercise funding, first purchase, hold and settlement, comeback purchase and settlement, plus duplicate/refund/overspend refusals and preference replay (first request 200, identical replay 409). Save new transaction receipts, order references, event logs, and Builder Code calldata evidence. Test wallets are not pilot customers, and observed repeat purchases do not establish causal retention lift.
5. Verify new receipts against the real Base Sepolia RPC with `npm run verify:proofs:strict`. Update `evidence/proofs.json` only with independently verified evidence; then regenerate and verify `SOURCE_MANIFEST.sha256`. Tag the exact clean SHA only after checks pass, and run `npm run judge:gate` on that tagged SHA. Record the demo video from that release.
6. A release handoff should include the site URL, exact commit SHA/tag, green CI link, transaction explorer links, verified Builder Code evidence, and demo video. Do not claim deployment readiness if any required check fails.

### Mainnet status: NO-GO

Do not enable real-money mainnet operations by changing chain IDs or feature flags. Shopify email claims are restricted to testnet; a production claim flow needs independent review, issuer-approved disclosures, eligibility/KYC and jurisdiction checks, refund handling, and end-to-end tests. The native mainnet checkout currently reserves merchant USDC without atomically reserving B20 inventory, which can leave a customer promised stock without timely settlement. Resolve that inventory/liability risk through a security-reviewed design and concurrency tests before accepting mainnet purchases.

Mainnet also requires an independent contract/security audit, real inventory and issuer eligibility, legal sign-off, multisig and adapter authority handoff, source-verified contracts, restricted canary, monitoring, and tested incident/withdrawal/rollback procedures. Testnet or mock-stock balances must never be presented as actual equity ownership.

- **App URL reported in the source:** https://ownback-project.onrender.com — customer store at `/shop`, judge page at `/judge`. Deployment health has not been independently checked in this release.
- Assets are **mock/testnet** (mock USDC, mAAPLc). Base mainnet is **NOT DEPLOYED**.

| Contract             | Address                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| OWNBACK              | [`0xB65c65E2FC79dc8146fd22fe379F8B58D8476b13`](https://sepolia.basescan.org/address/0xB65c65E2FC79dc8146fd22fe379F8B58D8476b13) |
| Mock USDC            | [`0x421e74034DA94a9e4f044F7134B523ffBD75DdE9`](https://sepolia.basescan.org/address/0x421e74034DA94a9e4f044F7134B523ffBD75DdE9) |
| Mock stock (mAAPLc)  | [`0xc0d725AF34a183d484bAe06A771D62d8e2e1BB6a`](https://sepolia.basescan.org/address/0xc0d725AF34a183d484bAe06A771D62d8e2e1BB6a) |
| Settlement adapter   | [`0x36d0c193AA2bCAD589dBf0490853d2c2b1092b13`](https://sepolia.basescan.org/address/0x36d0c193AA2bCAD589dBf0490853d2c2b1092b13) |
| Shopify reward vault | [`0xce9FD4eDE042324f3C1F72783d87922bFE485039`](https://sepolia.basescan.org/address/0xce9FD4eDE042324f3C1F72783d87922bFE485039) |
| Keeper / merchant    | [`0xc2a5d5C6cb6dF500BBa4214DD5CDA40f66970379`](https://sepolia.basescan.org/address/0xc2a5d5C6cb6dF500BBa4214DD5CDA40f66970379) |

Campaign **1**: funded with 5,000 mock USDC, 2% first-purchase and 5% comeback reward, $5 minimum order, 10-minute refund hold. Full addresses and deploy block: [`contracts/deployments/84532.json`](contracts/deployments/84532.json).

## Captured proof status (not independent confirmation)

Each onchain proof references a claimed Base Sepolia transaction, with a saved receipt under [`evidence/receipts/`](evidence/receipts/) and registered in [`evidence/proofs.json`](evidence/proofs.json). The offline `npm run verify:proofs` checks structure **only**. Run `BASE_SEPOLIA_RPC_URL=<rpc> npm run verify:proofs:strict` to query the chain independently.

| #   | Proof                                                                                                                         | Status                            | Evidence                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | Merchant funds campaign 1 (`CampaignFunded`)                                                                                  | 📎 Captured; RPC recheck required | [tx `0x81398f18…`](https://sepolia.basescan.org/tx/0x81398f181e9ce5c892c2c2cdbb83346175132acd2151c57d2ed07e6b8f755503) |
| 2   | Customer pays order, purchase #1, 48 USDC, 0.96 USDC reward reserved (`Purchased`, orderRef `0x9115ad7a…`)                    | 📎 Captured; RPC recheck required | [tx `0x67a480a2…`](https://sepolia.basescan.org/tx/0x67a480a270a2fea55531882d1d586c88c413948a02cf370ea124f7d813d3928e) |
| 3   | Reward settled after the refund hold, 0.0096 mAAPLc delivered to the customer (`RewardDelivered`)                             | 📎 Captured; RPC recheck required | [tx `0x9186e9f0…`](https://sepolia.basescan.org/tx/0x9186e9f0b2d5c7d5c1178d60074288306f41396c5d635d6b8dbe205204b1f0a6) |
| 4   | Wallet-signed preference recorded on the live app (HTTP 200); the identical replay rejected (HTTP 409). No trade or transfer. | 📎 Captured; RPC recheck required | [`evidence/logs/preference-replay.json`](evidence/logs/preference-replay.json)                                         |

On 16 Nov 2026 the v3.10.7 source passed `npm run verify:proofs:strict` locally against a live Base Sepolia RPC (4/4, coherent campaign 1 / purchase #1); the tagged CI run is the authoritative confirmation. The supplied logs identify one campaign (1), one first purchase (#1) and one customer; no comeback purchase is evidenced. Proofs 2 and 3 were sent from a MetaMask smart account, so the transactions are routed through a relay. The strict verifier must accept these receipts only if OWNBACK emitted the expected events on the canonical chain.

## Security hardening in v3.10.6

The HTTP rate-limit identity no longer trusts arbitrary `X-Forwarded-For` headers. By default all unidentified requests use a shared `untrusted` limit bucket. At a properly configured reverse proxy that **overwrites** `X-Real-IP`, set `OWNBACK_TRUSTED_PROXY_IP_HEADER=x-real-ip`; if a trusted proxy **appends the observed peer** to `X-Forwarded-For`, set `OWNBACK_TRUSTED_PROXY_IP_HEADER=x-forwarded-for-last`. Do not enable either mode if clients can control that header. Apply shared edge/WAF limits as well: in-memory rate limits do not span multiple application instances. See `SECURITY_SIMULATION_v3.10.6.md` for test coverage and production blockers.

## Remaining before submission

- [x] Proof 3: purchase #1 settled from **My orders** on `/shop`.
- [x] Proof 4: preference replay response log captured against the reported deployed app; independent authentication of the remote service is not established here.
- [ ] Add the `BASE_SEPOLIA_RPC_URL` GitHub secret, tag `v3.10.10`, and confirm `.github/workflows/submission-gate.yml` passes **on the exact SHA** (including strict chain receipt checks).
- [ ] Complete the actual comeback purchase and settlement, or show the existing first-purchase-only evidence without claiming observed retention.
- [ ] Record the submission video only from the validated tagged release.

## Remaining before production (Base mainnet)

- No funded mainnet inventory, real customer stock balance, legal/issuer approval or independently audited mainnet settlement exists yet.
- Mainnet deploy with real USDC and a real (non-mock) stock settlement provider.
- Paid RPC provider, scheduled keeper and monitoring.
- Install on the production Shopify store and configure the compliance webhooks (`/api/shopify/compliance`).
- Base mini app for the customer side (`/shop`) only; merchant pages stay on the website.

For local Anvil evidence, label it **ANVIL ONLY** and attach real transaction/log files. No public explorer URL exists for a local-only Anvil chain.
