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

// Durées de vie des cookies (ms) — indépendantes de JWT_EXPIRES_IN/JWT_REFRESH_EXPIRES_IN
// (qui bornent la validité cryptographique du token ; le cookie n'est qu'un
// vecteur de transport, un cookie expiré-mais-présent est sans risque).
const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 jours

// Options communes des cookies d'auth : httpOnly (inaccessible en JS, ferme le
// vecteur de vol de session par XSS), Secure en production (HTTPS uniquement),
// SameSite=strict (élimine le CSRF sans jeton dédié — aucun scénario de l'app
// n'a besoin d'envoyer ce cookie sur une requête cross-site).
const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge,
});

/**
 * Pose les cookies httpOnly access_token/refresh_token sur la réponse.
 * @param {import('express').Response} res
 * @param {{access_token: string, refresh_token: string}} tokens
 */
const setAuthCookies = (res, { access_token, refresh_token }) => {
  res.cookie('token', access_token, cookieOptions(ACCESS_COOKIE_MAX_AGE));
  res.cookie('refresh_token', refresh_token, cookieOptions(REFRESH_COOKIE_MAX_AGE));
};

/**
 * Efface les cookies d'auth (déconnexion).
 * @param {import('express').Response} res
 */
const clearAuthCookies = (res) => {
  res.clearCookie('token', { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
  res.clearCookie('refresh_token', { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
};

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

    // Client web SHALOM : cookies httpOnly (jamais lisibles en JS, ferme le
    // vecteur de vol par XSS). Les tokens restent aussi dans le corps JSON
    // pour les clients API/tests qui utilisent l'en-tête Authorization.
    setAuthCookies(res, { access_token: accessToken, refresh_token: refreshToken });

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

    // Verrouillage de compte (indépendant du rate limiting par IP, cf.
    // authLimiter) : protège contre le credential stuffing distribué sur un
    // même compte depuis des IPs différentes.
    const isLocked = user.locked_until && new Date(user.locked_until) > new Date();

    // bcrypt.compare est TOUJOURS exécuté, même si le compte est verrouillé :
    // sinon la réponse "verrouillé" serait plus rapide qu'un échec normal,
    // ce qui révélerait l'état de verrouillage par un simple timing.
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (isLocked || !isPasswordValid) {
      // Message générique dans tous les cas — pas de code/texte distinct pour
      // "verrouillé" (éviterait sinon de confirmer qu'un compte existe).
      if (!isLocked) await authService.registerFailedLoginAttempt(user.id);
      throw new AppError(
        'Email ou mot de passe incorrect',
        401,
        'INVALID_CREDENTIALS'
      );
    }

    await authService.resetFailedLoginAttempts(user.id);

    // Générer les tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Stocker le refresh token hashé en base
    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
    await authService.updateRefreshToken(user.id, refreshTokenHash);

    setAuthCookies(res, { access_token: accessToken, refresh_token: refreshToken });

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

    // Priorité au cookie httpOnly (client web) — fallback sur le corps pour
    // les clients API/tests.
    const refresh_token = req.cookies?.refresh_token || req.body?.refresh_token;
    if (!refresh_token) {
      throw new AppError('Refresh token manquant', 401, 'MISSING_REFRESH_TOKEN');
    }

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
      clearAuthCookies(res);
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

    setAuthCookies(res, { access_token: newAccessToken, refresh_token: newRefreshToken });

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

/**
 * POST /api/v1/auth/logout
 * Déconnexion : révoque le refresh token stocké et efface les cookies.
 * Nécessite d'être authentifié (cookie ou header Bearer).
 */
const logout = async (req, res, next) => {
  try {
    await authService.updateRefreshToken(req.user.id, null);
    clearAuthCookies(res);
    return res.status(200).json({ success: true, message: 'Déconnexion réussie' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
};
