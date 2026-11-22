import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FLAGS = {
  ab: 'https://static.aoe4world.com/vite/assets/ab-e3be9651.png',
  ay: 'https://static.aoe4world.com/vite/assets/ay-9a60b16b.png',
  by: 'https://static.aoe4world.com/vite/assets/by-5fa0ea3f.png',
  ch: 'https://static.aoe4world.com/vite/assets/ch-889d9920.png',
  de: 'https://static.aoe4world.com/vite/assets/de-47cad142.png',
  en: 'https://static.aoe4world.com/vite/assets/en-9cb03e75.png',
  fr: 'https://static.aoe4world.com/vite/assets/fr-549f1952.png',
  gol: 'https://static.aoe4world.com/vite/assets/goldenhorde-54c12b85.png',
  hr: 'https://static.aoe4world.com/vite/assets/hr-3bbbd5e3.png',
  hl: 'https://static.aoe4world.com/vite/assets/hl-17263954.png',
  ja: 'https://static.aoe4world.com/vite/assets/ja-11f498ae.png',
  je: 'https://static.aoe4world.com/vite/assets/jeannedarc-9c70961e.png',
  kt: 'https://static.aoe4world.com/vite/assets/kt-d78c3272.png',
  mac: 'https://static.aoe4world.com/vite/assets/macedonian-892259f7.png',
  ma: 'https://static.aoe4world.com/vite/assets/malians-c194643c.png',
  mo: 'https://static.aoe4world.com/vite/assets/mo-47536d49.png',
  od: 'https://static.aoe4world.com/vite/assets/od-835af597.png',
  ot: 'https://static.aoe4world.com/vite/assets/ottomans-1e330a73.png',
  ru: 'https://static.aoe4world.com/vite/assets/ru-aec8f40f.png',
  zx: 'https://static.aoe4world.com/vite/assets/zhuxi-f21662c7.png',
  sen: 'https://static.aoe4world.com/vite/assets/sengoku-1cf1ebfb.png',
  tug: 'https://static.aoe4world.com/vite/assets/tughlaq-fe1414db.png',
  sco: 'https://static.aoe4world.com/vite/assets/sco-599ed5e2.png',
  vik: 'https://static.aoe4world.com/vite/assets/vik-0dfbc686.png',
};

const outputDir = path.join(__dirname, '..', 'public', 'flags');

// Créer le dossier si nécessaire
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function downloadAllFlags() {
  console.log('🏁 Téléchargement des drapeaux des civilisations...\n');
  
  let downloaded = 0;
  let errors = 0;

  for (const [abbr, url] of Object.entries(FLAGS)) {
    const outputPath = path.join(outputDir, `${abbr}.png`);
    try {
      await downloadFile(url, outputPath);
      downloaded++;
      console.log(`✅ ${abbr}.png téléchargé`);
    } catch (error) {
      errors++;
      console.error(`❌ Erreur pour ${abbr}: ${error.message}`);
    }
  }

  console.log(`\n🎉 Téléchargement terminé : ${downloaded}/${Object.keys(FLAGS).length} drapeaux téléchargés`);
  if (errors > 0) {
    console.log(`⚠️  ${errors} erreur(s) rencontrée(s)`);
  }
}

downloadAllFlags().catch(console.error);
