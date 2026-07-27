-- ============================================================================
-- Migration: 026_games_duels_columns.sql
-- Module: SHALOM Games — colonnes manquantes sur game_duels pour le mode duel.
--
-- Un duel doit imposer le MÊME jeu de questions (et dans le même ordre) aux
-- deux joueurs pour être équitable — ces colonnes stockent ce choix figé au
-- moment de la création du duel, sur le modèle de daily_challenges.question_ids.
-- ============================================================================

ALTER TABLE game_duels
  ADD COLUMN IF NOT EXISTS question_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS difficulty SMALLINT NOT NULL DEFAULT 1;
