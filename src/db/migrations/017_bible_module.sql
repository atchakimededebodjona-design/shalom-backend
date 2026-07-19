-- =========================================================================
-- MODULE : LA BIBLE (Louis Segond 1910, domaine public)
-- =========================================================================
-- Contenu de référence canonique (comme daily_verses / worship_songs) :
-- pas de deleted_at, ce n'est pas une donnée appartenant à un utilisateur.

CREATE TABLE bible_books (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    testament      VARCHAR(20) NOT NULL,   -- 'ancien' | 'nouveau'
    name           VARCHAR(100) NOT NULL,
    book_order     INT NOT NULL UNIQUE,    -- 1..66, ordre canonique
    chapter_count  INT NOT NULL
);

CREATE TABLE bible_verses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id         UUID NOT NULL REFERENCES bible_books(id) ON DELETE CASCADE,
    chapter_number  INT NOT NULL,
    verse_number    INT NOT NULL,
    text            TEXT NOT NULL,
    UNIQUE(book_id, chapter_number, verse_number)
);

CREATE INDEX idx_bible_verses_chapter ON bible_verses(book_id, chapter_number);
CREATE INDEX idx_bible_verses_search ON bible_verses USING GIN (to_tsvector('french', text));
