// src/modules/auth/auth.controller.js
// Contrôleur du module auth — reçoit les requêtes, appelle le service, renvoie les réponses

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { hasValidationErrors } = require('../../utils/validate');
const env = require('../../config/env');
const { AppError } = require('../../middlewares/error.middleware');
const authService = require('./auth.service');
const profilesService = require('../profiles/profiles.service');
const ambassadorService = require('../ambassador/ambassador.service');

// Constante pour le nombre de rounds bcrypt
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Génère un access token JWT
 * @param {object} user - { id, email, role }
 * @returns {string} Access token signé
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
};

/**
 * Génère un refresh token JWT
 * @param {object} user - { id }
 * @returns {string} Refresh token signé
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );
};

/**
 * POST /api/v1/auth/register
 * Inscription d'un nouvel utilisateur
 */
const register = async (req, res, next) => {
  try {
    // Vérifier les erreurs de validation
    if (hasValidationErrors(req, res)) return;

    const { email, password, display_name } = req.body;

    // Vérifier si l'email existe déjà
    const existingUser = await authService.findUserByEmail(email);
    if (existingUser) {
      throw new AppError(
        'Un compte avec cet email existe déjà',
        409,
        'EMAIL_ALREADY_EXISTS'
      );
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Créer l'utilisateur
    const user = await authService.createUser(email, passwordHash);

    // Créer le profil associé via le service profiles (plan = 'free' par défaut)
    const profile = await profilesService.createProfile(user.id, display_name);

    // Inscription automatique au programme ambassadeur dès l'inscription
    await ambassadorService.joinProgram(user.id);
    profile.is_ambassador = true; // Pour la réponse json

    // Générer les tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Stocker le refresh token hashé en base
    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
    await authService.updateRefreshToken(user.id, refreshTokenHash);

    return res.status(201).json({
      success: true,
      message: 'Inscription réussie. Bienvenue sur SHALOM !',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          display_name: profile.display_name,
          plan: profile.plan,
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/login
 * Connexion d'un utilisateur existant
 */
const login = async (req, res, next) => {
  try {
    // Vérifier les erreurs de validation
    if (hasValidationErrors(req, res)) return;

    const { email, password } = req.body;

    // Rechercher l'utilisateur par email
    const user = await authService.findUserByEmail(email);
    if (!user) {
      throw new AppError(
        'Email ou mot de passe incorrect',
        401,
        'INVALID_CREDENTIALS'
      );
    }

    // Vérifier si le compte est actif
    if (!user.is_active) {
      throw new AppError(
        'Votre compte a été désactivé. Contactez le support.',
        403,
        'ACCOUNT_DISABLED'
      );
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AppError(
        'Email ou mot de passe incorrect',
        401,
        'INVALID_CREDENTIALS'
      );
    }

    // Générer les tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Stocker le refresh token hashé en base
    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
    await authService.updateRefreshToken(user.id, refreshTokenHash);

    return res.status(200).json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/refresh
 * Rafraîchir les tokens (access + refresh)
 */
const refresh = async (req, res, next) => {
  try {
    // Vérifier les erreurs de validation
    if (hasValidationErrors(req, res)) return;

    const { refresh_token } = req.body;

    // Vérifier et décoder le refresh token
    let decoded;
    try {
      decoded = jwt.verify(refresh_token, env.JWT_REFRESH_SECRET);
    } catch {
      throw new AppError(
        'Refresh token invalide ou expiré',
        401,
        'INVALID_REFRESH_TOKEN'
      );
    }

    // Vérifier que l'utilisateur existe
    const user = await authService.findUserById(decoded.id);
    if (!user) {
      throw new AppError(
        'Utilisateur introuvable',
        401,
        'USER_NOT_FOUND'
      );
    }

    // Vérifier le refresh token stocké en base
    const storedTokenHash = await authService.getRefreshToken(user.id);
    if (!storedTokenHash) {
      throw new AppError(
        'Session expirée, veuillez vous reconnecter',
        401,
        'SESSION_EXPIRED'
      );
    }

    // Comparer le refresh token avec le hash stocké
    const isTokenValid = await bcrypt.compare(refresh_token, storedTokenHash);
    if (!isTokenValid) {
      // Possible vol de token — révoquer tous les refresh tokens
      await authService.updateRefreshToken(user.id, null);
      throw new AppError(
        'Refresh token invalide. Toutes les sessions ont été révoquées.',
        401,
        'TOKEN_REVOKED'
      );
    }

    // Générer de nouveaux tokens (rotation)
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Stocker le nouveau refresh token hashé
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, BCRYPT_SALT_ROUNDS);
    await authService.updateRefreshToken(user.id, newRefreshTokenHash);

    return res.status(200).json({
      success: true,
      message: 'Tokens rafraîchis avec succès',
      data: {
        tokens: {
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
};
