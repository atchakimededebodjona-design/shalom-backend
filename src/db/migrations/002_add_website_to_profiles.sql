-- ============================================================
-- SHALOM — Migration 002 : Ajout du champ website aux profils
-- ============================================================

ALTER TABLE profiles
ADD COLUMN website VARCHAR(255);
