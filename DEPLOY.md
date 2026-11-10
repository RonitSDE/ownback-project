# OWNBACK v3.2 — Base Sepolia deployment runbook

**Allowed networks:** Anvil 31337 and Base Sepolia 84532. The `DeployTestnet` script rejects Base mainnet. This release **cannot settle actual tokenized stocks**.

## 1. Developer preflight

Install Node 22+, npm, Git, Foundry (`forge`, `anvil`) and dependencies on a network-enabled machine.

```bash
npm ci
./contracts/install-deps.sh
npm test
npm run release:preflight
npm run check
npm run build
npm run test:contracts
```

If any command fails, STOP and fix before broadcasting. For local-chain verification run Anvil and the commands in README; separately run `npm run test:e2e` with the Next.js server available.

## 2. Deploy the mock stack to Base Sepolia

Get test ETH for deployer and keeper. Use separate keys; neither must be hardcoded, committed, or sent to a browser. **Do not reuse the Anvil development keys on public chains.**

```bash
cp .env.example .env.local
# Set DEPLOYER_PRIVATE_KEY and KEEPER_ADDRESS securely in your shell/secret store.
cd contracts
forge script script/DeployTestnet.s.sol:DeployTestnet \
  --rpc-url https://sepolia.base.org --broadcast
cd ..
```

The script writes `contracts/deployments/84532.json`. Commit only the PUBLIC deployment JSON (never `.env`, private keys, or local Anvil deployment output). Verify the contract bytecode/source on a Base Sepolia explorer using your preferred Foundry/explorer API setup.

The deployment creates a funded campaign: **2% first purchase, 5% comeback within seven days, $10 maximum reward, $5 minimum checkout, ten-minute refund hold.** These are mock USDC and mock stock, both without monetary value.

## 3. Verify the external reference feed

```bash
npm run prices:check
```

Check the quote for `STOCK_SYMBOL` includes a recent `nav_price` **and `nav_price_updated_at`**. If the source is older than `MAX_SOURCE_AGE_SECONDS` or onchain `maxPriceAge`, the keeper will not publish the price. Source-time validation intentionally makes stock settlement unavailable during long market closures; alert on this condition and let customers know the reward remains reserved pending resumption. Static pricing is for local Anvil simulations only by default.

## 4. Configure keeper

Server environment (never expose `KEEPER_PRIVATE_KEY` as `NEXT_PUBLIC_*`):

```dotenv
RPC_URL=https://sepolia.base.org
KEEPER_PRIVATE_KEY=0xYOUR_KEEPER_PRIVATE_KEY
DEPLOYMENT_FILE=contracts/deployments/84532.json
PRICE_SOURCE=coinbase
STOCK_SYMBOL=AAPLc
MAX_SOURCE_AGE_SECONDS=172800
KEEPER_MAX_PURCHASES=10000
KEEPER_INTERVAL_MS=60000
```

```bash
npm run keeper:once
# Or use npm run keeper for a continuous worker
```

The included GitHub Actions keeper runs every five minutes with a concurrency group. Add `KEEPER_PRIVATE_KEY` as a GitHub secret. For a recorded live demo, a dedicated worker process is more predictable. The keeper scans **all onchain purchases** to avoid losing work on restart, so stop and replace it with a durable indexed queue before exceeding `KEEPER_MAX_PURCHASES` or running commercial volumes. Use only ONE active keeper instance per key to avoid nonce races.

## 5. Deploy frontend on Vercel or equivalent

Set `NEXT_PUBLIC_CHAIN_ID=84532`, dedicated `NEXT_PUBLIC_RPC_URL`, and fill the following from your deployment JSON:

```dotenv
NEXT_PUBLIC_OWNBACK_ADDRESS=...
NEXT_PUBLIC_USDC_ADDRESS=...
NEXT_PUBLIC_STOCK_ADDRESS=...
NEXT_PUBLIC_ADAPTER_ADDRESS=...
NEXT_PUBLIC_CAMPAIGN_ID=1
NEXT_PUBLIC_DEPLOY_BLOCK=...
NEXT_PUBLIC_STOCK_SYMBOL=AAPLc
```

Optional `NEXT_PUBLIC_BUILDER_CODE` is your ERC-8021 Base Builder Code. Build with `npm run build` and deploy with a provider supporting the Next.js App Router; set the above variables **at build time**.

```bash
SMOKE_URL=https://your-preview-domain.example npm run smoke
```

Check `/api/health` returns 200 with `priceFresh: true` before asking judges to test live self-settlement. A stale source response is intentionally degraded, not silently replaced with sample data.

The testnet adapter accepts a source price up to **5 days** old (`PRICE_MAX_AGE` in the deploy script), which
covers weekends and US market holidays, when Coinbase's NAV stops updating. Checkout never depends on price
freshness: rewards are reserved in USD. Only settlement pauses when the price is older than that, and the shop
labels a closed market as "Market closed · last NAV" rather than "stale".

## 6. Final real-transaction checklist

1. Fresh customer wallet on Base Sepolia gets mock USDC from test faucet.
2. Checkout page displays positive eligible reward and readable policy. Buyer approves mock USDC.
3. Buy $48: merchant balance increases by $48 mock USDC; reward reservation equals $0.96; view the transaction hash.
4. Wait ten minutes; keeper or customer calls settle. Confirm `RewardDelivered` event and stock balance +0.0048 when price is $200.
5. Buy again in the seven-day window: reward $2.40, settlement +0.012 at $200 reference.
6. Attempt third reward checkout: blocked WITHOUT payment. Replay the same orderRef: blocked WITHOUT payment.
7. Merchant pauses or drains available budget between preview and pay: tx reverts, buyer retains USDC.
8. Run keeper twice and restart it: no duplicate mint; create and fund a second campaign using same mock stock and confirm its payments settle too.
9. Take one refund before settlement and observe release; inspect a post-settlement refund as flagged exception.
10. Record browser/mobile walkthrough and save explorer receipts. Never call these mock stock tokens real shares.

**Security before commercial use:** independent audits, eligibility verification, real permitted execution provider, independent price/quote checks, seller/fulfillment identity, privacy/compliance controls, persistent indexed worker and alerting, treasury controls, fraud/chargeback policy and disclosures. Mainnet security and securities compliance are **NOT implemented** in this package.
