// src/modules/uploads/file-signature.js
// Détecte le type réel d'un fichier à partir de ses octets de tête (magic
// numbers) — jamais à partir du nom de fichier ni du Content-Type annoncé
// par le client, qui ne prouvent rien. Tout ce qui n'est pas explicitement
// reconnu est refusé (SVG compris : c'est du XML capable d'exécuter du
// script, dangereux à servir tel quel).

const MIN_HEADER_LENGTH = 12;

const matchesBytes = (buf, offset, bytes) => {
  if (buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
};

const matchesAscii = (buf, offset, str) => matchesBytes(buf, offset, Buffer.from(str, 'latin1'));

// Marques ISO BMFF ('ftyp') identifiant du QuickTime plutôt que du MP4.
const QUICKTIME_BRANDS = new Set(['qt  ']);

/**
 * @param {Buffer} buf - les premiers octets du fichier (32 suffisent largement)
 * @returns {{mime: string, ext: string}|null}
 */
const identifier = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < MIN_HEADER_LENGTH) return null;

  // PNG
  if (matchesBytes(buf, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: 'image/png', ext: '.png' };
  }

  // JPEG (SOI + début du premier marqueur)
  if (matchesBytes(buf, 0, [0xff, 0xd8, 0xff])) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }

  // GIF87a / GIF89a
  if (matchesAscii(buf, 0, 'GIF87a') || matchesAscii(buf, 0, 'GIF89a')) {
    return { mime: 'image/gif', ext: '.gif' };
  }

  // WEBP : conteneur RIFF avec la marque WEBP à l'offset 8.
  // Un autre RIFF (AVI, WAV...) n'est pas une image/vidéo autorisée → refusé.
  if (matchesAscii(buf, 0, 'RIFF')) {
    if (matchesAscii(buf, 8, 'WEBP')) {
      return { mime: 'image/webp', ext: '.webp' };
    }
    return null;
  }

  // WebM (en-tête EBML)
  if (matchesBytes(buf, 0, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { mime: 'video/webm', ext: '.webm' };
  }

  // MP4 / QuickTime : conteneur ISO BMFF, boîte 'ftyp' à l'offset 4,
  // marque de 4 caractères à l'offset 8 distinguant QuickTime du reste.
  if (matchesAscii(buf, 4, 'ftyp')) {
    const brand = buf.subarray(8, 12).toString('latin1');
    if (QUICKTIME_BRANDS.has(brand)) {
      return { mime: 'video/quicktime', ext: '.mov' };
    }
    return { mime: 'video/mp4', ext: '.mp4' };
  }

  return null;
};

module.exports = { identifier };
