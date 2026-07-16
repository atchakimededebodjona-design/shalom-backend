const { identifier } = require('../src/modules/uploads/file-signature');

// Construit un en-tête de 32 octets à partir d'octets de tête.
const entete = (octets) => {
  const buf = Buffer.alloc(32);
  Buffer.from(octets).copy(buf, 0);
  return buf;
};

const ftyp = (marque) => {
  const buf = Buffer.alloc(32);
  buf.write('....', 0, 'latin1');
  buf.write('ftyp', 4, 'latin1');
  buf.write(marque, 8, 'latin1');
  return buf;
};

describe('identifier — types autorisés', () => {
  it('reconnaît un PNG', () => {
    expect(identifier(entete([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
      .toEqual({ mime: 'image/png', ext: '.png' });
  });

  it('reconnaît un JPEG', () => {
    expect(identifier(entete([0xff, 0xd8, 0xff, 0xe0])))
      .toEqual({ mime: 'image/jpeg', ext: '.jpg' });
  });

  it('reconnaît un GIF (87a et 89a)', () => {
    expect(identifier(entete(Buffer.from('GIF87a')))).toEqual({ mime: 'image/gif', ext: '.gif' });
    expect(identifier(entete(Buffer.from('GIF89a')))).toEqual({ mime: 'image/gif', ext: '.gif' });
  });

  it('reconnaît un WEBP', () => {
    const buf = Buffer.alloc(32);
    buf.write('RIFF', 0, 'latin1');
    buf.write('WEBP', 8, 'latin1');
    expect(identifier(buf)).toEqual({ mime: 'image/webp', ext: '.webp' });
  });

  it('reconnaît un WebM', () => {
    expect(identifier(entete([0x1a, 0x45, 0xdf, 0xa3])))
      .toEqual({ mime: 'video/webm', ext: '.webm' });
  });

  it('distingue QuickTime du MP4 par la marque ftyp', () => {
    expect(identifier(ftyp('qt  '))).toEqual({ mime: 'video/quicktime', ext: '.mov' });
    expect(identifier(ftyp('isom'))).toEqual({ mime: 'video/mp4', ext: '.mp4' });
    expect(identifier(ftyp('mp42'))).toEqual({ mime: 'video/mp4', ext: '.mp4' });
  });
});

describe('identifier — ce qui doit être refusé', () => {
  it('refuse du HTML, même déguisé en image', () => {
    expect(identifier(entete(Buffer.from('<script>alert(1)</script>')))).toBeNull();
    expect(identifier(entete(Buffer.from('<!DOCTYPE html><html>')))).toBeNull();
  });

  it('refuse le SVG : du XML capable d\'exécuter du script', () => {
    expect(identifier(entete(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')))).toBeNull();
    expect(identifier(entete(Buffer.from('<?xml version="1.0"?><svg>')))).toBeNull();
  });

  it('refuse un RIFF qui n\'est pas du WEBP (ex. AVI)', () => {
    const buf = Buffer.alloc(32);
    buf.write('RIFF', 0, 'latin1');
    buf.write('AVI ', 8, 'latin1');
    expect(identifier(buf)).toBeNull();
  });

  it('refuse un PNG dont la signature est tronquée', () => {
    expect(identifier(entete([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]))).toBeNull();
  });

  it('refuse une entrée trop courte ou invalide', () => {
    expect(identifier(Buffer.alloc(4))).toBeNull();
    expect(identifier(Buffer.alloc(0))).toBeNull();
    expect(identifier(null)).toBeNull();
    expect(identifier('PNG')).toBeNull();
  });
});
