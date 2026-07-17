-- Migration: create_daily_tools_module

-- 1. Calculatrice de dîme/offrandes
CREATE TABLE tithe_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  income_amount NUMERIC(12,2) NOT NULL CHECK (income_amount > 0),
  tithe_percentage NUMERIC(5,2) DEFAULT 10.00,
  tithe_amount NUMERIC(12,2) NOT NULL, -- calculé: income * percentage/100
  offering_amount NUMERIC(12,2) DEFAULT 0, -- offrande libre additionnelle
  calculation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tithe_user_date ON tithe_calculations(user_id, calculation_date);

-- 2. Planificateur d'événements personnels
CREATE TABLE personal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  event_type VARCHAR(30) CHECK (event_type IN ('jeune','retraite','priere','autre')),
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  reminder_enabled BOOLEAN DEFAULT false,
  reminder_before_minutes INTEGER DEFAULT 60,
  status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned','completed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_personal_events_user_date ON personal_events(user_id, start_date) WHERE deleted_at IS NULL;

-- 3. Checklist/organisateur de tâches
CREATE TABLE task_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL DEFAULT 'Ma liste',
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content VARCHAR(300) NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  due_date DATE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_tasks_list ON tasks(list_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_user_due ON tasks(user_id, due_date) WHERE deleted_at IS NULL;

-- 4. Convertisseur d'unités (référentiel statique, pas de user_id nécessaire)
CREATE TABLE unit_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL, -- ex: "Longueur", "Poids", "Volume", "Devise"
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES unit_categories(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL, -- ex: "Kilomètre", "Mile"
  symbol VARCHAR(10) NOT NULL, -- ex: "km", "mi"
  conversion_factor_to_base NUMERIC(20,10) NOT NULL, -- facteur vers l'unité de base de la catégorie
  is_base_unit BOOLEAN DEFAULT false
);

-- Historique des conversions favorites/récentes par utilisateur (optionnel mais utile)
CREATE TABLE user_conversion_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_unit_id UUID NOT NULL REFERENCES units(id),
  to_unit_id UUID NOT NULL REFERENCES units(id),
  used_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, from_unit_id, to_unit_id)
);

-- Triggers updated_at (réutilise la fonction créée par 004_finance_module)
CREATE TRIGGER trg_personal_events_updated_at
  BEFORE UPDATE ON personal_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- Référentiel d'unités (sans lui, le convertisseur n'a rien à convertir).
-- Chaque catégorie a une unité de base (facteur = 1) ; les autres expriment
-- leur facteur vers cette base.
-- =========================================================================

INSERT INTO unit_categories (name) VALUES ('Longueur'), ('Poids'), ('Volume'), ('Devise');

INSERT INTO units (category_id, name, symbol, conversion_factor_to_base, is_base_unit)
SELECT c.id, v.name, v.symbol, v.factor::numeric(20,10), v.is_base
FROM unit_categories c
JOIN (VALUES
  -- Longueur — base : mètre
  ('Longueur', 'Mètre',        'm',   1,            true),
  ('Longueur', 'Kilomètre',    'km',  1000,         false),
  ('Longueur', 'Centimètre',   'cm',  0.01,         false),
  ('Longueur', 'Millimètre',   'mm',  0.001,        false),
  ('Longueur', 'Mille',        'mi',  1609.344,     false),
  ('Longueur', 'Pied',         'ft',  0.3048,       false),
  ('Longueur', 'Pouce',        'in',  0.0254,       false),
  -- Poids — base : kilogramme
  ('Poids',    'Kilogramme',   'kg',  1,            true),
  ('Poids',    'Gramme',       'g',   0.001,        false),
  ('Poids',    'Tonne',        't',   1000,         false),
  ('Poids',    'Livre',        'lb',  0.45359237,   false),
  ('Poids',    'Once',         'oz',  0.0283495231, false),
  -- Volume — base : litre
  ('Volume',   'Litre',        'L',   1,            true),
  ('Volume',   'Millilitre',   'mL',  0.001,        false),
  ('Volume',   'Mètre cube',   'm3',  1000,         false),
  ('Volume',   'Gallon US',    'gal', 3.785411784,  false),
  -- Devise — base : franc CFA. Seul l'euro est figé ici : sa parité avec le
  -- XOF est fixe (1 EUR = 655,957 XOF). Les devises à taux flottant (USD, GBP…)
  -- ne sont volontairement PAS seedées : un taux figé en base induirait
  -- l'utilisateur en erreur. Les ajouter suppose une source de taux à jour.
  ('Devise',   'Franc CFA',    'XOF', 1,            true),
  ('Devise',   'Euro',         'EUR', 655.957,      false)
) AS v(cat, name, symbol, factor, is_base) ON v.cat = c.name;
