-- Vérification d'email à l'inscription par code envoyé par email.
ALTER TABLE users
  ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN email_verification_code_hash TEXT,
  ADD COLUMN email_verification_expires_at TIMESTAMPTZ,
  ADD COLUMN email_verification_attempts SMALLINT NOT NULL DEFAULT 0;

-- Comptes déjà existants avant cette fonctionnalité : ils fonctionnaient déjà
-- normalement, on ne les bloque pas rétroactivement à la connexion.
UPDATE users SET email_verified = true;
