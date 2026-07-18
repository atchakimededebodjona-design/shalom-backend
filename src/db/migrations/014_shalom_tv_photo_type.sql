-- Migration: 014_shalom_tv_photo_type
-- Description: Ajoute le type de contenu "photo" à SHALOM TV, en plus de
--   video/audio/text — une image seule (ex: affiche, infographie) sans
--   lecteur média ni article.

ALTER TYPE shalom_tv_content_type ADD VALUE IF NOT EXISTS 'photo';
