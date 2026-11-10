# Stocks Maxxing submission kit

Deadline: **Dec 5, 2026 (UTC)**. A submission is (1) a public X post with a video demo tagging
**@buildonbase**, plus (2) the official submission form with the X link and track.

## Track

**Programmable Stock Markets**: a new primitive that turns everyday spending into a tokenized-stock position.
One project can win in only one track, so enter this one.

## One-liner

> OWNBACK is a checkout on Base that pays customers back in tokenized stock: more on the first order, more
> again when they come back, and a balance that works as collateral.

## Why it wins (the judges' questions, answered)

| They'll ask                     | Answer                                                                                                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is the stock essential?         | Yes. The reward is collateral-grade on mainnet (Morpho, Aave V4). Points can't be borrowed against.                                                                                                                                                  |
| Is it real or a mock?           | The full payment, reservation, hold, settlement and refund lifecycle is designed to run on Base Sepolia once deployed. The reward token is a mock that mirrors the live Coinbase `nav_price` and B20 multiplier. That's the honest testnet boundary. |
| Who do I have to trust?         | Nobody for the order: the USDC payment on Base is the proof, and the reward always goes to the payer. The keeper can't invent orders or redirect rewards.                                                                                            |
| What stops a merchant reneging? | The reward is reserved from the budget at checkout. Withdrawals can't touch reserved funds.                                                                                                                                                          |
| Refunds?                        | Before settlement: reward released, and a dependent comeback is voided. After settlement: recorded, not clawed back. The hold protects the merchant.                                                                                                 |
| Compliance?                     | Testnet mock with no value. Copy never claims shareholder rights. Mainnet delivery must respect the issuer's eligibility rules (eligible non-US persons only).                                                                                       |
| Why Base?                       | Coinbase tokenized stocks, Morpho and Aave equities markets, USDC and Builder Codes all live on one chain.                                                                                                                                           |

## What was built during the Quest Period (for the form)

The Quest Period began Nov 5. Be exact and keep the git history.

- **Pre-existing:** the V2.1 prototype (Shopify-triggered rewards, in-browser simulator, reward rules).
- **Built during the Quest:**
  - New `Ownback` contract: native USDC checkout as purchase proof, reward reservation, refund hold,
    comeback voiding, keeper-or-customer settlement.
  - Removed the Shopify, Postgres, Redis and claim-link stack from the critical path.
  - Testnet B20 mirror: price from the live Coinbase Tokenized Stocks API, multiplier model, fail-closed on
    a stale price.
  - Customer shop, merchant console, keeper, ERC-8021 Builder Codes.
  - Mainnet borrowing path and reference parameters.
  - Foundry test suite with fuzzing, plus a scripted local-chain end-to-end run with the real keeper (must be executed after installation).

  - v3.2 security pass: per-payer order references (anti-griefing), explicit no-reward opt-in, two-step ownership,
    Slither static analysis, chain-time quote deadlines, EIP-6963 wallet discovery, security headers.
  - Real-browser test: an injected test wallet drives the full journey with genuine transactions.

## Demo video script (about 90 seconds)

1. **(0:00) Hook.** "Loyalty points are dead money. OWNBACK pays you back in stock you can borrow against."
2. **(0:08) Merchant.** `/merchant`: a $5,000 campaign at 2% first order, 5% comeback within 7 days. "Every
   number is read from Base."
3. **(0:18) Buy.** `/shop` in a customer wallet: pick the $48 shoes. The preview shows $0.96 reserved. Pay.
   Basescan shows the merchant paid in full in the same transaction.
4. **(0:35) Settle.** Fast-forward past the hold and click Settle. Stock lands in the wallet. Point at the
   mirrored price next to the live Coinbase `nav_price`.
5. **(0:50) Come back.** The banner says "order again within 6d to earn 5%". Buy again, settle, and the
   position grows.
6. **(1:05) Make it work.** The position card shows Morpho's 62.5% liquidation LTV and borrow headroom, with
   the mainnet links.
7. **(1:15) Trust.** A third order shows "no stock reward" and the Pay button stays locked until the customer
   ticks "pay without a reward": OWNBACK never quietly downgrades a reward. A refund releases the reservation.
   "The payment is the proof. Rewards always go to the payer."
8. **(1:25) Close.** "OWNBACK. Spend. Earn stock. Research its possibilities. Built on Base."

Record with the always-on keeper running so settlement happens live.

## X post draft

> Loyalty points are dead money.
>
> OWNBACK pays you back in tokenized stock: 2% on your first order, 5% when you come back. On Base mainnet
> that reward is collateral on Morpho and Aave.
>
> The payment is the proof. No claim links, no trust-me webhooks.
>
> Live on Base Sepolia 👇 [video] [link]
>
> @buildonbase #StocksMaxxing

## Build in public (there's an award for it)

Post progress on X from now to Dec 5, at least twice a week:

- Contract design thread: "why the payment is the purchase proof"
- First Sepolia order with Basescan screenshots
- Live price mirroring from the Coinbase API
- Merchant console reveal
- Final demo

## Partners: what to do in the Nov 6–13 window

- **Bankr** (the only partner on every track; already ships tokenized-stock tooling): **built.** The
  "borrow against your reward" step can run through the customer's Bankr agent (see BANKR.md). Verify the
  live API with `npm run bankr:check` before demoing, and ask Bankr which further integration they'd reward.
- **BaseStonk** (Programmable track partner): ask what market-infrastructure integration they want to see.
- Don't name-drop partners you haven't integrated.

## Pre-submit checklist

- [ ] `npm run prices:check` prints live `nav_price` values
- [ ] Contracts deployed and verified on Base Sepolia; `deployments/84532.json` committed
- [ ] Keeper running; `/api/health` reports `priceFresh: true`
- [ ] Full journey rehearsed with a fresh wallet (DEPLOY.md, step 4)
- [ ] Builder Code suffix visible in Basescan input data
- [ ] CI green (contracts, app, browser tests, chain end-to-end)
- [ ] Video recorded, X post live tagging @buildonbase, form submitted with the X link and track
- [ ] Form states clearly what was built during the Quest Period
