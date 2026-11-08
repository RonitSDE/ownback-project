# OWNBACK v3.2 release acceptance — developer sign-off

## Safety blockers fixed in source

- [x] Mandatory nonzero unique orderRef (per campaign)
- [x] Atomic USDC-denominated minimum reward floor, never silently rewardless
- [x] Short user quote deadline; expired/changed preview reverts before transfer
- [x] Local browser checkout intent and transaction hash survive reloads / prevent automatic duplicate submit
- [x] Onchain reward reservations cannot be withdrawn before settling
- [x] Testnet adapter preserves _source_ observation timestamp and rejects stale, future and regressing values
- [x] Order references scoped per payer (anti-griefing); explicit no-reward opt-in; two-step ownership
- [x] Slither: no medium or higher findings outstanding (see SECURITY.md)
- [x] Real-browser wallet journey passes (`npm run test:ui`)
- [ ] Manual pass with real Coinbase Wallet, MetaMask and Rabby extensions on Base Sepolia
- [x] Mock stock and frontend use 8 base-unit decimals + separate 18dp multiplier
- [x] Keeper checks all configured-stock campaigns, recovers after process restart from onchain state
- [x] Mock testnet deployment script refuses mainnet

## Tests executed in this environment

- [x] `npm test`: **22/22 pass** (JS engine, time validation, ABI signature checks)
- [x] `npm run release:preflight`: PASS
- [x] TS/TSX **syntax parse**: 20 files, zero errors (this is not typecheck)
- [x] JS syntax checks: scripts parse cleanly

## Developer MUST execute before release (not yet verified)

- [ ] `npm ci` online (offline registry cache lacked `zod`)
- [ ] `npm run check` TypeScript typecheck
- [ ] `npm run build` Next.js production build
- [ ] `./contracts/install-deps.sh` and `npm run test:contracts` Foundry tests
- [ ] Start Anvil, deploy to local chain, `npm run e2e:local`
- [ ] `npm run dev` plus `npm run test:e2e` Playwright browser flows
- [ ] `npm run prices:check` verify Coinbase response date on a live network
- [ ] Base Sepolia deploy/contract verification and funded checkout/settlement tx receipts
- [ ] Browser account switch / mobile wallet recovery / retry after RPC timeout
- [ ] Chaos tests: stale price, provider outage, refunded order, restart, simultaneous campaigns, nonce collision, gas limits

## Limitations and NOT production-ready

- No Shopify/offchain merchant connector (this product uses its own onchain checkout).
- No regulated stock issuer/provider execution, KYC/eligibility or real tokenized equities.
- Current mock adapter mints synthetic test assets; reference NAV is not an executable quote.
- Stateless keeper is capped at 10,000 historical purchases and must be replaced by an indexed durable service for commercial traffic.
- Browser log scans are not indexed/paginated for large volumes; external markets and loan paths are links only.
- Merchant refund depends on merchant initiating refund and having USDC allowance; reserved rewards can be released after 30 days past hold as disclosed by the contract.
- No independent security audit or real commercial compliance review.

**Release definition:** "Deployable Base Sepolia testnet candidate pending developer E2E execution". Do not describe as production audited, enterprise scale, live stock buyback, or verified mainnet.

**Shortcut:** `npm run verify:local` orchestrates dependency installation, Foundry tests, local deployment, deterministic E2E, typecheck and frontend production build; _not yet executed here_.
