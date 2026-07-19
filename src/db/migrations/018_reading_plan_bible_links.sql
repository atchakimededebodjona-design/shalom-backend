-- Migration: reading_plan_bible_links
-- Lie (facultativement) un jour de plan de lecture au vrai texte biblique
-- (module bible), pour permettre un lien direct « Lire » vers le lecteur.
-- Nullable : n'affecte pas les plans existants créés à la main (passages
-- en texte libre, sans référence structurée).

ALTER TABLE bible_reading_plan_days
  ADD COLUMN start_book_id UUID REFERENCES bible_books(id),
  ADD COLUMN start_chapter INT;
