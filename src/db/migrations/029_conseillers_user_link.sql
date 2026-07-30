-- Un conseiller est désormais obligatoirement un membre SHALOM existant
-- (l'administrateur sélectionne son compte au lieu de saisir un nom en texte
-- libre) : nom/email deviennent redondants avec users/profiles et sont
-- remplacés par une référence. La table est vide à ce jour (fonctionnalité
-- jamais utilisée en production), donc pas de données à migrer.
ALTER TABLE conseillers
  ADD COLUMN user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  DROP COLUMN nom,
  DROP COLUMN email;

-- Un membre ne peut être désigné conseiller qu'une seule fois.
CREATE UNIQUE INDEX IF NOT EXISTS idx_conseillers_user_id ON conseillers(user_id) WHERE deleted_at IS NULL;
