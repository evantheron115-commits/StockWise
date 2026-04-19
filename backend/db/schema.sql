-- StockWise MVP — PostgreSQL Schema
-- Run this once to set up the database

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id          SERIAL PRIMARY KEY,
  ticker      VARCHAR(20)  NOT NULL UNIQUE,
  name        TEXT,
  exchange    VARCHAR(50),
  sector      TEXT,
  industry    TEXT,
  description TEXT,
  currency    VARCHAR(10)  DEFAULT 'USD',
  country     VARCHAR(50),
  website     TEXT,
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_ticker ON companies(ticker);

-- Financial statements
CREATE TABLE IF NOT EXISTS financials (
  id           SERIAL PRIMARY KEY,
  ticker       VARCHAR(20)  NOT NULL,
  period       VARCHAR(10)  NOT NULL, -- 'FY' or 'Q'
  fiscal_year  INTEGER      NOT NULL,
  date         DATE,
  -- Income
  revenue             BIGINT,
  gross_profit        BIGINT,
  operating_income    BIGINT,
  net_income          BIGINT,
  ebitda              BIGINT,
  eps                 NUMERIC(10,4),
  -- Balance
  total_assets        BIGINT,
  total_liabilities   BIGINT,
  total_debt          BIGINT,
  net_debt            BIGINT,
  shareholders_equity BIGINT,
  cash                BIGINT,
  -- Cash Flow
  operating_cf        BIGINT,
  free_cash_flow      BIGINT,
  capex               BIGINT,
  -- Margins
  gross_margin        NUMERIC(6,4),
  operating_margin    NUMERIC(6,4),
  net_margin          NUMERIC(6,4),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, period, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_financials_ticker ON financials(ticker);
CREATE INDEX IF NOT EXISTS idx_financials_ticker_year ON financials(ticker, fiscal_year);

-- Daily stock prices
CREATE TABLE IF NOT EXISTS stock_prices (
  id         SERIAL PRIMARY KEY,
  ticker     VARCHAR(20) NOT NULL,
  date       DATE        NOT NULL,
  open       NUMERIC(12,4),
  high       NUMERIC(12,4),
  low        NUMERIC(12,4),
  close      NUMERIC(12,4),
  volume     BIGINT,
  UNIQUE(ticker, date)
);

CREATE INDEX IF NOT EXISTS idx_prices_ticker_date ON stock_prices(ticker, date DESC);

-- Users (auth)
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL UNIQUE,
  name       VARCHAR(255),
  password   TEXT,                    -- null for OAuth-only accounts
  provider   VARCHAR(50)  DEFAULT 'email',
  avatar     TEXT,
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- DCF calculation history (optional, for future use)
CREATE TABLE IF NOT EXISTS dcf_runs (
  id                  SERIAL PRIMARY KEY,
  ticker              VARCHAR(20)  NOT NULL,
  growth_rate         NUMERIC(6,4),
  discount_rate       NUMERIC(6,4),
  terminal_growth     NUMERIC(6,4),
  forecast_years      INTEGER,
  intrinsic_value     NUMERIC(12,2),
  enterprise_value    BIGINT,
  equity_value        BIGINT,
  created_at          TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dcf_ticker ON dcf_runs(ticker);
