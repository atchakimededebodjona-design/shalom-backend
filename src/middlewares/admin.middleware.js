const { pool } = require('../config/db');
const { isAdminEmail } = require('../utils/admin');

/**
 * Middleware pour vérifier si l'utilisateur connecté est un administrateur global.
 * Pour l'instant, on vérifie si son email fait partie de la liste définie dans la variable d'environnement ADMIN_EMAILS.
 */
const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Récupérer l'email de l'utilisateur
    const result = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Utilisateur introuvable",
        code: "USER_NOT_FOUND"
      });
    }

    const email = result.rows[0].email;

    if (!isAdminEmail(email)) {
      return res.status(403).json({
        success: false,
        error: "Action réservée aux administrateurs",
        code: "FORBIDDEN_ADMIN_ONLY"
      });
    }

    next();
  } catch (error) {
    console.error('requireAdmin middleware error:', error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la vérification des droits",
      code: "INTERNAL_ERROR"
    });
  }
};

module.exports = requireAdmin;
