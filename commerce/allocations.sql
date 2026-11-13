-- v3.9 read-only consent record. NEVER an authorization to transfer funds or B20.
-- Access to this table must be limited to the application service role.
CREATE TABLE IF NOT EXISTS allocation_preferences (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL CHECK(wallet ~ '^0x[0-9a-f]{40}$'),
  origin TEXT NOT NULL,
  nonce TEXT NOT NULL CHECK(nonce ~ '^[0-9a-f-]{36}$'),
  chain_id INTEGER NOT NULL CHECK(chain_id IN (8453,84532,31337)),
  stock TEXT NOT NULL CHECK(stock IN ('AAPLc','NVDAc')),
  reward_cents INTEGER NOT NULL CHECK(reward_cents BETWEEN 1 AND 1000),
  payload_digest TEXT NOT NULL CHECK(payload_digest ~ '^[0-9a-f]{64}$'),
  verified_signature TEXT NOT NULL CHECK(verified_signature ~ '^0x[0-9a-f]{2,2048}$'),
  status TEXT NOT NULL DEFAULT 'RECORDED_NOT_EXECUTED' CHECK(status='RECORDED_NOT_EXECUTED'),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(wallet,nonce)
);
CREATE INDEX IF NOT EXISTS allocation_preferences_wallet ON allocation_preferences(wallet,created_at DESC);
