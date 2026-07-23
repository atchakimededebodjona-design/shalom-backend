const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.resolve(__dirname, '../uploads');
const ADS_DIR = path.resolve(__dirname, '../uploads/ads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(ADS_DIR)) fs.mkdirSync(ADS_DIR, { recursive: true });

// SVG templates converted into readable SVGs/PNGs for dev testing
const createSvgImage = (title, subtitle, bg1 = '#08111D', bg2 = '#C2982F', width = 800, height = 400) => {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bg1};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${bg2};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#grad)"/>
  <circle cx="${width/2}" cy="${height/2}" r="${Math.min(width, height)/3}" fill="#ffffff" opacity="0.05"/>
  <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#F8FAFC" font-family="sans-serif" font-size="${Math.max(18, height/10)}px" font-weight="bold">${title}</text>
  <text x="50%" y="62%" dominant-baseline="middle" text-anchor="middle" fill="#C2982F" font-family="sans-serif" font-size="${Math.max(12, height/18)}px">${subtitle}</text>
</svg>`;
};

const filesToCreate = [
  // Admin Avatar & Cover
  { path: '4bb87dad-f214-48d4-be04-f1c7031dbb2b.png', title: 'SHALOM Admin', subtitle: 'Administrateur', bg1: '#1E293B', bg2: '#D97706', width: 400, height: 400 },
  { path: '1cf88dbf-a5fb-4f6d-8650-f351940c952d.png', title: 'SHALOM Plateforme', subtitle: 'Connecte, Inspire, Transforme', bg1: '#0F172A', bg2: '#B45309', width: 1200, height: 400 },

  // Ads
  { path: 'ads/image-1784495191925-852146548.jpg', title: 'ISEC INITIATIVE', subtitle: 'Formation & Mentorat Chrétien', bg1: '#064E3B', bg2: '#10B981', width: 800, height: 450 },
  { path: '1784664707396-8fa2cc76-df47-41a9-baed-b7fab00c3d1b.jpg', title: 'ISEC INITIATIVE', subtitle: 'Éducation & Leadership', bg1: '#1E1B4B', bg2: '#6366F1', width: 800, height: 450 },
  { path: 'a98115f5-3c19-4f43-826e-3b9769025a6d.jpg', title: 'Remise de Diplômes', subtitle: 'Célébration des Diplômés', bg1: '#4C1D95', bg2: '#8B5CF6', width: 800, height: 450 },
  { path: 'ad78aa45-f38a-4f35-82b5-0c3dc4d3d507.jpg', title: 'ISEC INITIATIVE', subtitle: 'Découvrez nos nouveaux programmes', bg1: '#831843', bg2: '#EC4899', width: 800, height: 450 },
  { path: '34719163-ffbb-4757-9d1c-2efcef3444cc.png', title: 'SHALOM Réseau Social', subtitle: 'La communauté des jeunes croyants', bg1: '#065F46', bg2: '#34D399', width: 800, height: 450 },
  { path: '3bfa158e-e522-488d-9a7d-8fa9a7f60fbd.png', title: 'CAMAJ', subtitle: 'Convention & Activités Jeunesse', bg1: '#1E3A8A', bg2: '#3B82F6', width: 800, height: 450 },
  { path: '2786f97e-fdf1-4014-8ef5-c4683aff39fb.png', title: 'SHALOM App', subtitle: 'Restez connecté au quotidien', bg1: '#78350F', bg2: '#F59E0B', width: 800, height: 450 },

  // Posts
  { path: '1784050873073-204966486.png', title: 'Verset du Jour', subtitle: 'Psaumes 23:1 — Le Seigneur est mon berger', bg1: '#111827', bg2: '#F59E0B', width: 800, height: 500 },
];

for (const item of filesToCreate) {
  const filePath = path.join(UPLOADS_DIR, item.path);
  const content = createSvgImage(item.title, item.subtitle, item.bg1, item.bg2, item.width, item.height);
  fs.writeFileSync(filePath, content);
  console.log(`Created: ${item.path}`);
}

console.log('✅ Tous les fichiers médias de test ont été générés avec succès !');
