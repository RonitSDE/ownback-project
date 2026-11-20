-- OWNBACK Hybrid Commerce / Shopify single-store pilot migration.
-- Identity is merchant-scoped. No customer emails or API credentials are recorded in webhook tables.
CREATE TABLE IF NOT EXISTS shopify_installations (
  shop_domain TEXT PRIMARY KEY CHECK (shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'),
  token_ciphertext TEXT NOT NULL,
  scopes TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  webhook_ready BOOLEAN NOT NULL DEFAULT FALSE,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shopify_webhook_events (
  shop_domain TEXT NOT NULL,
  webhook_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  digest TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(shop_domain,webhook_id)
);
CREATE TABLE IF NOT EXISTS shopify_refund_markers (
  shop_domain TEXT NOT NULL,
  order_id TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(shop_domain,order_id)
);
CREATE TABLE IF NOT EXISTS shopify_reward_orders (
  shop_domain TEXT NOT NULL REFERENCES shopify_installations(shop_domain),
  order_id TEXT NOT NULL,
  order_label TEXT,
  customer_hash TEXT NOT NULL CHECK (customer_hash ~ '^0x[0-9a-f]{64}$'),
  paid_at TIMESTAMPTZ NOT NULL,
  reward_eligible_at TIMESTAMPTZ NOT NULL,
  price_usdc BIGINT NOT NULL CHECK(price_usdc>0),
  status TEXT NOT NULL DEFAULT 'HOLD' CHECK(status IN ('HOLD','READY','CLAIM_SENT','CLAIMED','SETTLING','DELIVERED','REFUNDED','REFUNDED_AFTER_DELIVERY','BLOCKED','FAILED')),
  claim_token_hash TEXT UNIQUE,
  claim_expires_at TIMESTAMPTZ,
  wallet TEXT CHECK(wallet IS NULL OR wallet ~ '^0x[0-9a-f]{40}$'),
  reward_kind TEXT CHECK(reward_kind IS NULL OR reward_kind IN ('FIRST','COMEBACK')),
  reward_usdc BIGINT,
  tx_hash TEXT UNIQUE,
  stock_amount TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(shop_domain,order_id)
);
CREATE INDEX IF NOT EXISTS shopify_reward_customer ON shopify_reward_orders(shop_domain,customer_hash,paid_at);
CREATE INDEX IF NOT EXISTS shopify_reward_queue ON shopify_reward_orders(status,reward_eligible_at);
CREATE INDEX IF NOT EXISTS shopify_reward_wallet ON shopify_reward_orders(wallet,status);
ALTER TABLE shopify_reward_orders ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
ALTER TABLE shopify_reward_orders ADD COLUMN IF NOT EXISTS processing_attempts INTEGER NOT NULL DEFAULT 0;

-- v3.6.2 claim delivery outbox. PII and bearer claim links are encrypted at rest.
-- Email service is never invoked inside a DB transaction.
CREATE TABLE IF NOT EXISTS shopify_claim_outbox (
  shop_domain TEXT NOT NULL,
  order_id TEXT NOT NULL,
  recipient_ciphertext TEXT NOT NULL,
  token_ciphertext TEXT NOT NULL,
  order_label TEXT NOT NULL,
  reward_kind TEXT NOT NULL CHECK(reward_kind IN ('FIRST','COMEBACK')),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENDING','RETRY','SENT','REVIEW','CANCELLED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_expires_at TIMESTAMPTZ,
  provider_message_id TEXT,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(shop_domain,order_id),
  FOREIGN KEY(shop_domain,order_id) REFERENCES shopify_reward_orders(shop_domain,order_id)
);
CREATE INDEX IF NOT EXISTS shopify_claim_outbox_due ON shopify_claim_outbox(status,next_attempt_at,lease_expires_at);
