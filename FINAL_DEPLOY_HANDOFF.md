# OWNBACK v3.10.10 — Final Base Sepolia developer handoff

**What to deploy:** this ZIP to a controlled **Base Sepolia (84532) / MOCK STOCK** staging environment only. The mainnet contracts and worker candidates are included as reviewed source, but **not approved to run with real funds**. This is a deployment candidate, not a deployment receipt.

## Do these six steps

1. Import full ZIP into Git on a clean commit. Configure Base Sepolia, deployed **testnet** contract addresses, a real OWNBACK Builder Code, database/Shopify/webhook secrets and proxy trust settings in your secret manager. Never commit private keys. Keep live/mainnet flags `false`.
2. Run `npm ci && npm run check && npm run test:deployment-safety && npm test && npm run simulate:recovery && npm run test:contracts && npm run build && npm run verify:manifest`. Complete the `./contracts/install-deps.sh` prerequisites first. Fix *all* failures.
3. Deploy the testnet contracts if necessary using the existing `DeployTestnet.s.sol`; record deployed addresses. Run `npm run preflight:staging` with actual staging env populated. Deploy the web app and *testnet-only* keeper/Shopify workers. Confirm `/`, `/judge`, `/verify`, `/allocation`, `/growth`, and public X preview.
4. Run local Anvil `npm run e2e:local` with actual deployed test contracts, then on Sepolia run **merchant fund → first payment → hold → settlement → comeback payment → settlement**, plus overspend, refund, preference first-200/replay-409; record real tx receipts and orderRefs. Validate ERC-8021 on signed tx/UserOperation inputs; old historical receipts do not establish attribution.
5. Replace/re-capture `evidence/proofs.json` and add independently checked **comeback** evidence. Run `npm run verify:proofs:strict`, `npm run verify:builder:tx` with correct arguments, and `npm run judge:gate` on the **exact clean tagged v3.10.10 SHA** (tag after proof files are recorded). Record the 90s judge video only from that tested release.
6. Send CEO: **site URL, exact Git SHA/tag, green CI link, first/comeback explorer links, verified Builder Code evidence, demo video**. Distinguish real customer pilot activity from simulated checkout / test wallets and *observed* retention from causal lift.

**Stop rule:** If any step fails, do not announce final submission readiness. If mainnet is the objective, see `MAINNET_NO_GO.md` before any real-money deployment.
