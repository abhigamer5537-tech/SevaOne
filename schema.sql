CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  pincode TEXT NOT NULL,
  referral_code TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  payment_status TEXT NOT NULL DEFAULT 'Created',
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS payment_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
