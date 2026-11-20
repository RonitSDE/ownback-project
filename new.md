# OWNBACK v3.10.10 — Developer deployment instructions

**Deploy target: Base Sepolia (chain 84532), MOCK STOCK only. Do not enable Base mainnet live equities.** This is the final *source handoff*, not a proven live deployment.

1. Import ZIP into Git and install dependencies on a connected CI runner: `npm ci && ./contracts/install-deps.sh`. Run `npm run check && npm test && npm run test:deployment-safety && npm run simulate:recovery && npm run test:contracts && npm run build && npm run verify:manifest` (and format/lint checks). All must pass.
2. Deploy or confirm Base Sepolia test contracts; set correct public addresses, private secrets, `NEXT_PUBLIC_CHAIN_ID=84532`, `COMMERCE_CHAIN_ID=84532`, `SHOPIFY_REWARD_CHAIN_ID=84532`, matching `BUILDER_CODE` and `NEXT_PUBLIC_BUILDER_CODE`, both REQUIRE_BUILDER_CODE flags true. Keep all live-stock/mainnet-approval flags **false**. Run `npm run preflight:staging`; inspect its errors.
3. Deploy the app and testnet keeper/Shopify workers. Run genuine fund → pay (2%) → hold → settle → comeback pay (5%) → settle, duplicate/refund/overspend refusals, and preference 200→409. Preserve **new** explorer hashes, `orderRef`, event logs and ERC-8021 tx calldata.
4. Replace historic receipts in `evidence/proofs.json` with verified current evidence. Run `npm run verify:proofs:strict` against actual `BASE_SEPOLIA_RPC_URL`. Add the comeback receipts to `/verify` and `/judge`; distinguish *actual pilot customers* from test wallets. Do not claim retention lift.
5. Commit updated proof files and manifest; tag the exact clean SHA `v3.10.10`; run `npm run judge:gate` on that tag. Send CEO: live URL, CI link, SHA, Base Sepolia transaction hashes, Builder Code checks and final 90-second video from the same release.

**Real-money mainnet NO-GO:** Shopify email claim worker is explicitly testnet-only. Native mainnet checkout can reserve USDC without an atomic B20 inventory commitment. A separate code/security review and inventory-liability fix, real B20 issuer eligibility, monitoring, multisig approvals and production canary are required before enabling real funds. See `MAINNET_NO_GO.md` inside ZIP.
