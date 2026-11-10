# OWNBACK v3.6 — Agentic Commerce developer handoff

## What v3.6 actually adds

- `/agentic`: premium mobile-responsive product discovery with live Shopify UCP Catalog search, real variant selection, Shopify Cart MCP creation, and a user-controlled merchant checkout handoff.
- `/api/agentic/merchants`: lists *installed and active* Shopify pilot stores only, constrained by optional merchant allowlist.
- `/api/agentic/search`: sends `search_catalog` JSON-RPC to the store's `/api/ucp/mcp`; refuses to invent offers or claim unverified stock rewards.
- `/api/agentic/cart`: uses `lookup_catalog` to revalidate variant availability before `create_cart`; returns only vetted merchant-origin HTTPS checkout URLs.
- `public/profiles/ownback-ucp.json`: publicly hosted 2026-08-25 agent profile declaring catalog search/lookup and cart capabilities.
- A transparent **preview mode** operates without live credentials, displays *sample products only*, and never accepts payment or marks a reward delivered.
- Shopify Connect, normal Shopify checkout, authenticated order/refund webhooks, separate testnet reward vault, customer wallet claim, native USDC commerce, and read-only Bankr research remain unchanged.

**Not built:** autonomous card payment, Global Catalog discovery, AI-provider personalized reasoning, production tokenized-equity issuance, Bankr-managed customer borrowing, or Shopify App Store distribution approval. The conversational interface uses Shopify's natural-language catalog search with grounded templates; it is not a model-generated shopping advisor.

## Local setup

```bash
cd ownback
# IMPORTANT: v3.5 inherited a lockfile missing the PostgreSQL packages.
# On a network-connected machine, regenerate and COMMIT the corrected lockfile:
npm install --package-lock-only
npm ci

cp .env.example .env.local
# Configure existing commerce PostgreSQL, Shopify app, Base contracts and Bankr keys as needed
# Existing migrations and contracts are unchanged in v3.6
npm run commerce:migrate
npm run test:agentic
npm run agentic:preflight
npm test
npm run check
npm run build
npm run dev
```

Go to http://localhost:3000/agentic. Preview mode is functional immediately without merchant data; it is explicitly illustrative. All live-mode actions require a real installed Shopify merchant and a publicly reachable UCP agent profile.

## Shopify UCP configuration

1. Register the Shopify app and connect the merchant through the existing `/commerce/admin` or `/experience` OAuth flow; verify that `shopify_installations.active=true` and webhooks are registered.
2. Publish `public/profiles/ownback-ucp.json` on a **public HTTPS domain** (e.g., `https://ownback.example.com/profiles/ownback-ucp.json`). Set `UCP_AGENT_PROFILE_URL` to that URL. **Do not** use `localhost` as the profile URL for live Shopify UCP; Shopify fetches the agent's profile.
3. Set `SHOPIFY_AGENT_ALLOWED_SHOPS=your-store.myshopify.com`. Only installed stores appear to customers. For pilot scope, keep the allowlist restricted.
4. If the store's `cart.continue_url` uses an independently verified custom primary domain, put just that hostname in `SHOPIFY_AGENT_ALLOWED_CHECKOUT_HOSTS`. If Shopify UCP redirects `/api/ucp/mcp` from `myshopify.com` to that primary storefront, also set `SHOPIFY_AGENT_STOREFRONT_HOST` to the same verified host. Arbitrary redirects are rejected. Do not wildcard the setting.
5. Confirm storefront UCP support via Shopify's `https://{shopDomain}/.well-known/ucp` profile and `https://{shopDomain}/api/ucp/mcp`. The app uses `search_catalog`, `lookup_catalog`, and `create_cart`; it uses **no bearer token and no autonomous Checkout MCP payment**.
6. Shopify returns live product prices in **minor currency units** (e.g., USD 1899 = $18.99). OWNBACK's reward preview uses 2% first / 5% comeback, capped at $10, but must remain marked *illustrative* until purchase, campaign funding, customer identity, holds, jurisdiction and refund checks are verified.
7. Keep Shopify checkout as merchant-of-record. Payment cards, tax and shipping information are entered only on Shopify. The original authenticated `orders/paid`/refund webhook processing controls eligibility after checkout.

Reference: https://shopify.dev/docs/agents , https://shopify.dev/docs/agents/catalog/storefront-catalog , https://shopify.dev/docs/agents/carts-and-checkout/cart-mcp

## Acceptance checklist (must actually run)

- [ ] Preview mode on `/agentic` renders on midrange Android and iPhone; cart quantities and reward estimates recompute; no actual purchase is claimed.
- [ ] Connected Shopify store appears after OAuth, with public HTTPS agent profile accepted by UCP.
- [ ] Search in live mode returns real products, valid variants, images and accurate minor-unit prices.
- [ ] A selectable variant becomes a Shopify cart, returns verified HTTPS `continue_url`, and opens merchant checkout. Incorrect hosts/invalid variants are refused.
- [ ] After a real **test** Shopify payment, merchant webhook is HMAC verified, order is deduplicated, and refund-before-payment is handled correctly.
- [ ] After the configured hold, customer receives a claim invitation, signs wallet claim, and receives a **confirmed mock-token transaction on Base Sepolia** from a funded vault; explorer proof is shown.
- [ ] A return order within seven days earns the higher rate once; invalid/duplicate/late/refunded orders never pay.
- [ ] Independent native USDC store still passes inventory reservation, payment receipt, fulfillment and refund tests.
- [ ] Bankr research remains read-only; no operator wallet loan execution is exposed.
- [ ] `npm ci`, full TypeScript check, `next build`, Foundry tests, local-chain E2E, Shopify staging and cross-device UX pass.
- [ ] Rate limits are moved to a shared store and deployment-level WAF protection is configured before public traffic; current server limiter is best effort per process.
- [ ] Production LCP target <2.5s p75 on a mid-range Android under 4G conditions; measure before claiming success.

## Unsupported or blocked here

The source uses the correct Shopify UCP shapes per the 2026-08-25 documentation, but we do not have a live pilot store, customer test accounts, public profile domain, merchant credentials or Base Sepolia wallet access in this environment. New UCP boundary tests are executable offline; an authenticated real-world checkout, confirmation webhook and stock settlement must be tested on staging before claiming production readiness.

**Compliance**: live securities transfers and collateralized loans remain disabled. Stock-delivery claims in this build refer to synthetic testnet tokens only. A Shopify merchant's UCP support is not authorization to distribute regulated securities.
