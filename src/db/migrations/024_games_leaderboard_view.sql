-- ============================================================================
-- Migration: 024_games_leaderboard_view.sql
-- Module: SHALOM Games — remplace la vue matérialisée leaderboard_global par
-- une vue classique.
--
-- La vue matérialisée créée en 022 n'a aucun mécanisme de rafraîchissement
-- automatique (pas de job planifié) : elle restait vide/périmée après chaque
-- partie tant que personne n'exécutait REFRESH MATERIALIZED VIEW à la main.
-- Au volume actuel (peu d'utilisateurs), une vue normale — toujours à jour,
-- recalculée à chaque lecture — est plus fiable qu'une optimisation prématurée.
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS leaderboard_global;

CREATE VIEW leaderboard_global AS
SELECT
    user_id,
    SUM(total_points) AS total_points,
    MAX(last_played_at) AS last_played_at,
    RANK() OVER (ORDER BY SUM(total_points) DESC) AS rank
FROM user_game_stats
GROUP BY user_id;
