-- Verrouillage de compte après échecs de connexion répétés.
-- Complète le rate limiting par IP (auth.routes.js) : celui-ci ne freine que
-- par IP, un credential stuffing distribué (botnet/proxys rotatifs) peut donc
-- continuer à bombarder un même compte depuis des IPs différentes. Ces deux
-- colonnes permettent de verrouiller le COMPTE lui-même, indépendamment de la
-- provenance des requêtes.
ALTER TABLE users
  ADD COLUMN failed_login_attempts SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN locked_until TIMESTAMPTZ;
