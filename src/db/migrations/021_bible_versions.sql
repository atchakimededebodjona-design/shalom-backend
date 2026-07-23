-- Migration: bible_versions
-- Ajoute le support de plusieurs versions/traductions de la Bible.
-- bible_books reste version-agnostique (canon protestant à 66 livres partagé
-- par toutes les versions ajoutées) ; seul le texte des versets varie par
-- version, via bible_verses.version_id.

CREATE TABLE bible_versions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code       VARCHAR(10) NOT NULL UNIQUE,   -- 'LSG', 'MAR', 'OST', 'EWE'...
    name       VARCHAR(150) NOT NULL,
    language   VARCHAR(10) NOT NULL,          -- 'fr', 'ee'...
    is_default BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO bible_versions (code, name, language, is_default)
VALUES ('LSG', 'Louis Segond (1910)', 'fr', true);

ALTER TABLE bible_verses ADD COLUMN version_id UUID REFERENCES bible_versions(id);
UPDATE bible_verses SET version_id = (SELECT id FROM bible_versions WHERE code = 'LSG');
ALTER TABLE bible_verses ALTER COLUMN version_id SET NOT NULL;

ALTER TABLE bible_verses
  DROP CONSTRAINT bible_verses_book_id_chapter_number_verse_number_key,
  ADD CONSTRAINT bible_verses_version_book_chapter_verse_key
    UNIQUE (version_id, book_id, chapter_number, verse_number);

DROP INDEX idx_bible_verses_chapter;
CREATE INDEX idx_bible_verses_chapter ON bible_verses(version_id, book_id, chapter_number);

-- 'simple' (sans radicalisation langue-spécifique) plutôt que 'french' :
-- l'index sert désormais aussi des versets en éwé, pour lequel Postgres n'a
-- pas de configuration de recherche dédiée.
DROP INDEX idx_bible_verses_search;
CREATE INDEX idx_bible_verses_search ON bible_verses USING GIN (to_tsvector('simple', text));
