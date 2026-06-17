-- ═══════════════════════════════════════════════
-- 风林慧策 — Cloudflare D1 数据库 Schema
-- SQLite 兼容语法，D1 原生支持
-- ═══════════════════════════════════════════════

-- 1. 股票元数据
CREATE TABLE IF NOT EXISTS stocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  full_code TEXT NOT NULL UNIQUE,
  market TEXT NOT NULL CHECK(market IN ('sz','sh','bj','hk','us')),
  market_type TEXT NOT NULL CHECK(market_type IN ('ashare','hkshare','usshare')),
  name TEXT NOT NULL,
  sector TEXT,
  pinyin TEXT,
  is_tracked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stocks_search ON stocks(code, market_type);
CREATE INDEX IF NOT EXISTS idx_stocks_name ON stocks(name);
CREATE INDEX IF NOT EXISTS idx_stocks_tracked ON stocks(is_tracked);

-- 2. 市场行情缓存（每日快照）
CREATE TABLE IF NOT EXISTS market_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_id INTEGER NOT NULL UNIQUE REFERENCES stocks(id),
  price REAL,
  change_pct REAL,
  pe_ttm REAL,
  pb REAL,
  market_cap REAL,
  total_shares REAL,
  volume REAL,
  turnover REAL,
  div_yield_ttm REAL,
  high_52w REAL,
  low_52w REAL,
  prev_close REAL,
  open_price REAL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 3. 财务数据缓存
CREATE TABLE IF NOT EXISTS financial_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_id INTEGER NOT NULL REFERENCES stocks(id),
  fiscal_year TEXT NOT NULL,
  report_date TEXT,
  revenue REAL,
  net_profit_parent REAL,
  roe REAL,
  total_assets REAL,
  net_assets REAL,
  cash_equivalents REAL,
  trading_assets REAL,
  interest_bearing_debt REAL,
  goodwill REAL,
  operating_cf REAL,
  fcf REAL,
  basic_eps REAL,
  gross_cash REAL,
  net_cash REAL,
  eff_market_cap REAL,
  eff_pe REAL,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(stock_id, fiscal_year)
);

-- 4. PMQD 分析缓存
CREATE TABLE IF NOT EXISTS analysis_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_id INTEGER NOT NULL UNIQUE REFERENCES stocks(id),

  pmqd_total INTEGER,
  pmqd_p_score INTEGER,
  pmqd_m_score INTEGER,
  pmqd_q_score INTEGER,
  pmqd_d_score INTEGER,
  pmqd_stars TEXT,
  pmqd_verdict TEXT,

  kelly_f REAL,
  kelly_b REAL,
  kelly_p REAL,
  kelly_verdict TEXT,

  strategy TEXT,

  safety_q1_pass INTEGER DEFAULT 0,
  safety_q2_pass INTEGER DEFAULT 0,
  safety_q3_pass INTEGER DEFAULT 0,
  safety_total INTEGER DEFAULT 0,

  solvency_score INTEGER,
  health_check_score INTEGER,

  report_json TEXT,

  data_freshness TEXT DEFAULT 'stale',
  generated_at TEXT DEFAULT (datetime('now')),
  data_sources TEXT
);

-- 5. 用户订阅
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  stock_id INTEGER NOT NULL REFERENCES stocks(id),
  frequency_daily INTEGER DEFAULT 0,
  frequency_weekly INTEGER DEFAULT 0,
  frequency_alert INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  last_sent_at TEXT,
  UNIQUE(email, stock_id)
);

CREATE INDEX IF NOT EXISTS idx_subs_active ON subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_subs_email ON subscriptions(email);

-- 6. 用户账户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email TEXT,
  plan TEXT DEFAULT NULL,
  plan_index INTEGER DEFAULT NULL,
  subscribed_at TEXT DEFAULT NULL,
  free_trial_used INTEGER DEFAULT 0,
  jwt_version INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_account ON users(account);

-- 7. 支付记录表
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'CNY',
  method TEXT CHECK(method IN ('wechat','alipay','free_trial')),
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','success','failed','refunded')),
  out_trade_no TEXT UNIQUE,
  paid_at TEXT,
  raw_response TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 8. 数据刷新日志
CREATE TABLE IF NOT EXISTS refresh_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_id INTEGER REFERENCES stocks(id),
  action TEXT CHECK(action IN ('quote','finance','analysis','alert')),
  status TEXT CHECK(status IN ('success','error')),
  error_msg TEXT,
  duration_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_refresh_log_stock ON refresh_log(stock_id);
CREATE INDEX IF NOT EXISTS idx_refresh_log_created ON refresh_log(created_at);
