-- ========================================
-- Shopee Cloud Optimizer - Database Schema
-- ========================================

-- TABLE: products
CREATE TABLE products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shopee_item_id      BIGINT,
  shopee_shop_id      BIGINT,
  shopee_url          TEXT,
  name                TEXT NOT NULL,
  description         TEXT,
  price               NUMERIC(10, 2),
  stock               INT DEFAULT 0,
  sold                INT DEFAULT 0,
  category            TEXT,
  image_url           TEXT,
  images              JSONB DEFAULT '[]',
  status              TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'scraping', 'error')),
  last_scraped_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE: competitors
CREATE TABLE competitors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id          UUID REFERENCES products(id) ON DELETE SET NULL,
  shopee_item_id      BIGINT NOT NULL,
  shopee_shop_id      BIGINT NOT NULL,
  shopee_url          TEXT NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  price               NUMERIC(10, 2),
  sold                INT DEFAULT 0,
  rating              NUMERIC(3, 2),
  rating_count        INT DEFAULT 0,
  image_url           TEXT,
  shop_name           TEXT,
  tags                JSONB DEFAULT '[]',
  raw_data            JSONB DEFAULT '{}',
  scraped_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE: optimization_logs
CREATE TABLE optimization_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id            UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  original_name         TEXT NOT NULL,
  original_description  TEXT,
  original_price        NUMERIC(10, 2),
  optimized_name        TEXT,
  optimized_description TEXT,
  suggested_price       NUMERIC(10, 2),
  insights              JSONB DEFAULT '{}',
  status                TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'analyzing', 'completed', 'applied', 'error')),
  error_message         TEXT,
  claude_raw_response   TEXT,
  claude_model          TEXT DEFAULT 'claude-sonnet-4-6',
  prompt_tokens         INT,
  completion_tokens     INT,
  applied_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE: sessions
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  cookies         JSONB NOT NULL DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index：每位 user 只有一個 active session
CREATE UNIQUE INDEX sessions_user_active_unique
  ON sessions (user_id) WHERE is_active = true;

-- ========================================
-- Row Level Security
-- ========================================
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_products"
  ON products FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_competitors"
  ON competitors FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_optimization_logs"
  ON optimization_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_sessions"
  ON sessions FOR ALL USING (auth.uid() = user_id);

-- ========================================
-- Auto-update updated_at trigger
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_optimization_logs_updated_at
  BEFORE UPDATE ON optimization_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================================
-- Indexes
-- ========================================
CREATE INDEX idx_products_user_id          ON products (user_id);
CREATE INDEX idx_products_shopee_item      ON products (shopee_item_id) WHERE shopee_item_id IS NOT NULL;
CREATE INDEX idx_competitors_product_id    ON competitors (product_id);
CREATE INDEX idx_optimization_logs_product ON optimization_logs (product_id);
CREATE INDEX idx_optimization_logs_status  ON optimization_logs (status);
CREATE INDEX idx_sessions_user_id          ON sessions (user_id);
