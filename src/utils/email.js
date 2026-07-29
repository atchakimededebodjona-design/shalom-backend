// src/utils/email.js
// Envoi d'emails transactionnels (vérification d'inscription, etc.) via SMTP.
//
// Sans configuration SMTP (dev/tant que le service n'est pas branché), les
// emails ne partent pas : le code est simplement journalisé en console pour
// permettre de tester le flux de bout en bout sans dépendance externe.

const nodemailer = require('nodemailer');

const isConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);

// Tests d'intégration (Jest) : au lieu de parser des logs console, on retient
// le dernier code envoyé par adresse pour que les tests puissent le récupérer
// et vérifier réellement le flux d'inscription de bout en bout. NODE_ENV vaut
// 'test' automatiquement sous Jest (avant même le chargement de .env), donc
// cette carte reste vide en dev normal et en production.
const testCodeStore = new Map();

/**
 * (Tests uniquement) Dernier code de vérification envoyé à un email.
 * @param {string} email
 * @returns {string|undefined}
 */
const getLastTestVerificationCode = (email) => testCodeStore.get(String(email).trim().toLowerCase());

let transporter = null;
const getTransporter = () => {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }
  return transporter;
};

/**
 * Envoie l'email contenant le code de vérification d'inscription.
 * @param {string} toEmail
 * @param {string} code - code à 6 chiffres
 * @param {string} displayName
 */
const sendVerificationEmail = async (toEmail, code, displayName) => {
  if (process.env.NODE_ENV === 'test') {
    testCodeStore.set(String(toEmail).trim().toLowerCase(), code);
  }

  const subject = 'Votre code de vérification SHALOM';
  const text = `Bonjour ${displayName},\n\nVotre code de vérification SHALOM est : ${code}\n\nCe code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.\n\n— L'équipe SHALOM`;
  const html = `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #241E19;">
      <h2 style="color: #97731A;">SHALOM</h2>
      <p>Bonjour ${displayName},</p>
      <p>Voici votre code de vérification pour finaliser votre inscription :</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; background: #F6F2E8; padding: 16px; border-radius: 8px;">${code}</p>
      <p style="color: #5B5147; font-size: 14px;">Ce code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet email.</p>
    </div>
  `;

  const client = getTransporter();
  if (!client) {
    console.warn(
      `[email] ⚠️  SMTP non configuré — email NON envoyé (dev only). ` +
      `Code de vérification pour ${toEmail} : ${code}`
    );
    return { sent: false };
  }

  await client.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject,
    text,
    html,
  });
  return { sent: true };
};

module.exports = { sendVerificationEmail, isConfigured, getLastTestVerificationCode };
