// src/modules/auth/auth.controller.js
// Contrôleur du module auth — reçoit les requêtes, appelle le service, renvoie les réponses

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { hasValidationErrors } = require('../../utils/validate');
const env = require('../../config/env');
const { AppError } = require('../../middlewares/error.middleware');
const authService = require('./auth.service');
const profilesService = require('../profiles/profiles.service');
const ambassadorService = require('../ambassador/ambassador.service');
const { sendVerificationEmail } = require('../../utils/email');
const { pool } = require('../../config/db');

/**
 * Génère un code de vérification à 6 chiffres.
 * @returns {string}
 */
const generateVerificationCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

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

    const { email, password, display_name, referral_code } = req.body;

    // Vérifier si l'email existe déjà
    const existingUser = await authService.findUserByEmail(email);
    if (existingUser) {
      throw new AppError(
        'Un compte avec cet email existe déjà',
        409,
        'EMAIL_ALREADY_EXISTS'
      );
    }

    // Le code de parrainage est validé AVANT toute création de compte : un
    // code fourni mais invalide/inactif est rejeté proprement (400), pour ne
    // jamais laisser un utilisateur créé avec un parrainage silencieusement
    // ignoré. Absent de la requête, l'inscription se poursuit normalement.
    if (referral_code) {
      const referringAmbassador = await ambassadorService.findActiveAmbassadorByReferralCode(referral_code);
      if (!referringAmbassador) {
        throw new AppError('Code de parrainage invalide ou inactif', 400, 'INVALID_REFERRAL_CODE');
      }
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

    // Enregistrement du parrainage : effet secondaire best-effort après la
    // création du compte. Le code a déjà été validé ci-dessus, donc cet appel
    // devrait toujours réussir ; s'il échoue malgré tout (ex: l'ambassadeur a
    // été suspendu entre-temps), on journalise sans jamais faire échouer une
    // inscription dont le compte est déjà créé (cf. recordReferral, qui
    // ignore lui-même silencieusement un code devenu invalide).
    if (referral_code) {
      const referralClient = await pool.connect();
      try {
        await referralClient.query('BEGIN');
        await ambassadorService.recordReferral(user.id, referral_code, referralClient);
        await referralClient.query('COMMIT');
      } catch (referralError) {
        await referralClient.query('ROLLBACK');
        console.error('Erreur lors de l\'enregistrement du parrainage (inscription non affectée) :', referralError);
      } finally {
        referralClient.release();
      }
    }

    // L'inscription n'est pas encore "réussie" au sens plein : aucun token
    // n'est émis tant que l'email n'est pas vérifié par le code envoyé.
    const code = generateVerificationCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_SALT_ROUNDS);
    await authService.setEmailVerificationCode(user.id, codeHash);
    await sendVerificationEmail(user.email, code, profile.display_name);

    return res.status(201).json({
      success: true,
      message: 'Inscription initiée. Un code de vérification a été envoyé à votre adresse email.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          display_name: profile.display_name,
        },
        requires_verification: true,
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

    // Email non vérifié : bloqué APRÈS la vérification du mot de passe (pas
    // avant), pour ne jamais révéler ce statut à quelqu'un qui ne connaît pas
    // déjà le bon mot de passe.
    if (!user.email_verified) {
      throw new AppError(
        'Veuillez vérifier votre adresse email avant de vous connecter.',
        403,
        'EMAIL_NOT_VERIFIED'
      );
    }

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

/**
 * PATCH /api/v1/auth/password
 * Change le mot de passe de l'utilisateur connecté.
 * Révoque le refresh token existant et en émet un nouveau (rotation) : les
 * autres sessions ouvertes avec l'ancien mot de passe sont déconnectées.
 */
const changePassword = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { current_password, new_password } = req.body;

    const user = await authService.findUserByIdWithPassword(req.user.id);
    if (!user) {
      throw new AppError('Utilisateur introuvable', 401, 'USER_NOT_FOUND');
    }

    const isCurrentValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isCurrentValid) {
      throw new AppError('Mot de passe actuel incorrect', 401, 'INVALID_CURRENT_PASSWORD');
    }

    const newPasswordHash = await bcrypt.hash(new_password, BCRYPT_SALT_ROUNDS);
    await authService.updatePassword(user.id, newPasswordHash);

    // Rotation des tokens : la session courante reste valide (nouveaux
    // cookies posés), mais toute autre session utilisant l'ancien refresh
    // token est invalidée.
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
    await authService.updateRefreshToken(user.id, refreshTokenHash);
    setAuthCookies(res, { access_token: accessToken, refresh_token: refreshToken });

    return res.status(200).json({
      success: true,
      message: 'Mot de passe modifié avec succès',
      data: { tokens: { access_token: accessToken, refresh_token: refreshToken } },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/verify-email
 * Vérifie le code reçu par email et, si valide, complète l'inscription :
 * marque l'email vérifié et émet les tokens (connexion automatique).
 */
const verifyEmail = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { email, code } = req.body;

    const user = await authService.findUserByEmail(email);
    if (!user) {
      throw new AppError('Code de vérification invalide ou expiré', 400, 'INVALID_CODE');
    }

    if (user.email_verified) {
      throw new AppError('Cet email est déjà vérifié, vous pouvez vous connecter.', 409, 'ALREADY_VERIFIED');
    }

    const expired = !user.email_verification_code_hash
      || !user.email_verification_expires_at
      || new Date(user.email_verification_expires_at) < new Date();

    if (expired) {
      throw new AppError(
        'Code expiré ou trop d\'essais incorrects. Demandez un nouveau code.',
        400,
        'CODE_EXPIRED'
      );
    }

    const isCodeValid = await bcrypt.compare(code, user.email_verification_code_hash);
    if (!isCodeValid) {
      await authService.registerFailedVerificationAttempt(user.id);
      throw new AppError('Code de vérification incorrect', 400, 'INVALID_CODE');
    }

    await authService.markEmailVerified(user.id);

    // Connexion automatique : l'inscription est désormais pleinement réussie.
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
    await authService.updateRefreshToken(user.id, refreshTokenHash);
    setAuthCookies(res, { access_token: accessToken, refresh_token: refreshToken });

    return res.status(200).json({
      success: true,
      message: 'Email vérifié avec succès. Bienvenue sur SHALOM !',
      data: {
        user: { id: user.id, email: user.email, role: user.role },
        tokens: { access_token: accessToken, refresh_token: refreshToken },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/resend-verification
 * Renvoie un nouveau code de vérification. Répond toujours avec le même
 * message générique, que l'email existe ou non (anti-énumération).
 */
const resendVerification = async (req, res, next) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { email } = req.body;
    const genericResponse = {
      success: true,
      message: 'Si un compte non vérifié existe pour cet email, un nouveau code vient d\'être envoyé.',
    };

    const user = await authService.findUserByEmail(email);
    if (!user || user.email_verified) {
      return res.status(200).json(genericResponse);
    }

    const code = generateVerificationCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_SALT_ROUNDS);
    await authService.setEmailVerificationCode(user.id, codeHash);

    const profile = await profilesService.findProfileByUserId(user.id);
    await sendVerificationEmail(user.email, code, profile?.display_name || user.email);

    return res.status(200).json(genericResponse);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  changePassword,
  verifyEmail,
  resendVerification,
};
