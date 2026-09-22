-- Jusqu'ici, POST /api/v1/uploads écrivait sur disque sans jamais enregistrer
-- qui avait téléversé quoi : aucune table ne liait un fichier à un
-- utilisateur, donc aucun quota par utilisateur n'était applicable (rien à
-- sommer). Cette table trace chaque téléversement passé par le module
-- uploads générique (uploads.service.js) pour permettre de calculer l'usage
-- cumulé d'un utilisateur et lui refuser un nouvel envoi au-delà du quota.
CREATE TABLE IF NOT EXISTS uploads (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename   TEXT NOT NULL,
    mime       TEXT NOT NULL,
    size       BIGINT NOT NULL CHECK (size > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Somme des tailles par utilisateur : la requête de quota (SUM(size) WHERE
-- user_id = $1) est sur le chemin chaud de chaque téléversement.
CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id);
