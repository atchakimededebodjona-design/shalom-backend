-- Migration: create_finance_module
-- Description: Tables pour le module Gestion Financière (Outils Shalom)

-- 1. Catégories de revenus/dépenses
CREATE TABLE finance_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('income','expense')),
  is_default BOOLEAN DEFAULT false,
  icon VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_finance_categories_user ON finance_categories(user_id) WHERE deleted_at IS NULL;

-- 2. Transactions (revenus et dépenses)
CREATE TABLE finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES finance_categories(id),
  type VARCHAR(10) NOT NULL CHECK (type IN ('income','expense')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  note TEXT,
  transaction_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_frequency VARCHAR(20) CHECK (recurrence_frequency IN ('daily','weekly','monthly','yearly') OR recurrence_frequency IS NULL),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_finance_transactions_user_date ON finance_transactions(user_id, transaction_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_finance_transactions_category ON finance_transactions(category_id) WHERE deleted_at IS NULL;

-- 3. Objectifs d'épargne
CREATE TABLE finance_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(12,2) DEFAULT 0 CHECK (current_amount >= 0),
  target_date DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','achieved','abandoned')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_finance_goals_user ON finance_goals(user_id) WHERE deleted_at IS NULL;

-- 4. Résumés mensuels (pour accélérer l'analyse de tendance)
CREATE TABLE finance_monthly_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year_month VARCHAR(7) NOT NULL, -- format 'YYYY-MM'
  total_income NUMERIC(12,2) DEFAULT 0,
  total_expense NUMERIC(12,2) DEFAULT 0,
  savings_rate NUMERIC(5,2) DEFAULT 0,
  category_breakdown JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, year_month)
);

CREATE INDEX idx_finance_summary_user_month ON finance_monthly_summary(user_id, year_month);

-- 5. Trigger pour maintenir updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finance_transactions_updated_at
  BEFORE UPDATE ON finance_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_finance_goals_updated_at
  BEFORE UPDATE ON finance_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
