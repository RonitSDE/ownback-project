-- OWNBACK Commerce v4: a single merchant selling pickup/digital goods in USDC.
-- Execute via npm run commerce:migrate on PostgreSQL 15+.
CREATE TABLE IF NOT EXISTS commerce_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'Essentials',
  fulfillment_type TEXT NOT NULL DEFAULT 'PICKUP' CHECK(fulfillment_type IN ('PICKUP','DIGITAL')),
  price_usdc BIGINT NOT NULL CHECK(price_usdc > 0),
  stock_on_hand INTEGER NOT NULL DEFAULT 0 CHECK(stock_on_hand >= 0),
  stock_reserved INTEGER NOT NULL DEFAULT 0 CHECK(stock_reserved >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(stock_reserved <= stock_on_hand)
);
CREATE TABLE IF NOT EXISTS commerce_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  wallet TEXT NOT NULL CHECK(wallet ~ '^0x[0-9a-f]{40}$'),
  campaign_id NUMERIC(78,0) NOT NULL,
  order_ref TEXT NOT NULL UNIQUE CHECK(order_ref ~ '^0x[0-9a-f]{64}$'),
  total_usdc BIGINT NOT NULL CHECK(total_usdc > 0),
  status TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT' CHECK(status IN ('AWAITING_PAYMENT','PAID','FULFILLED','CANCELED','REFUND_PENDING','REFUNDED','REFUNDED_AFTER_REWARD')),
  fulfillment TEXT NOT NULL CHECK(fulfillment IN ('PICKUP','DIGITAL')),
  customer_email TEXT,
  customer_note TEXT,
  payment_tx TEXT UNIQUE,
  purchase_id TEXT UNIQUE,
  refund_tx TEXT UNIQUE,
  refund_purchase_id TEXT,
  cancel_reason TEXT,
  receipt_token_hash TEXT NOT NULL,
  quote_deadline BIGINT NOT NULL,
  reserved_until TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commerce_orders_wallet ON commerce_orders(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_orders_state ON commerce_orders(status, reserved_until);
CREATE TABLE IF NOT EXISTS commerce_order_items (
  order_id UUID NOT NULL REFERENCES commerce_orders(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES commerce_products(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 100),
  unit_usdc BIGINT NOT NULL CHECK(unit_usdc > 0),
  PRIMARY KEY(order_id, product_id)
);
CREATE TABLE IF NOT EXISTS commerce_order_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES commerce_orders(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS commerce_rate_limits (
 key TEXT PRIMARY KEY,
 window_start TIMESTAMPTZ NOT NULL,
 hits INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS commerce_chain_cursor (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton),
  next_block NUMERIC(78,0) NOT NULL CHECK(next_block >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
