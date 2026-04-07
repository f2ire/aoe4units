/**
 * Script de mise à jour des données AoE4
 * Télécharge les 3 fichiers JSON depuis aoe4world/data et les compare aux versions locales.
 *
 * Usage: node scripts/update-data.mjs
 * Options:
 *   --force   Remplace les fichiers même si la version est identique
 *   --dry-run Affiche uniquement ce qui changerait, sans écrire
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../src/data');

const FORCE   = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Sources ────────────────────────────────────────────────────────────────

const SOURCES = [
  {
    name: 'Unités (all-unified.json)',
    url: 'https://raw.githubusercontent.com/aoe4world/data/main/units/all-unified.json',
    dest: 'all-unified.json',
    // Champ utilisé pour détecter les ajouts/suppressions
    diffKey: 'id',
  },
  {
    name: 'Capacités (all-optimized_abi.json)',
    url: 'https://raw.githubusercontent.com/aoe4world/data/main/abilities/all-optimized.json',
    dest: 'all-optimized_abi.json',
    diffKey: 'id',
  },
  {
    name: 'Technologies (all-optimized_tec.json)',
    url: 'https://raw.githubusercontent.com/aoe4world/data/main/technologies/all-optimized.json',
    dest: 'all-optimized_tec.json',
    diffKey: 'id',
  },
];

// IDs référencés dans les patches — à vérifier après mise à jour
// (liste extraite de src/data/patches/)
const PATCH_UNIT_IDS = [
  'culverin', 'manjaniq',
  'ghulam', 'camel-lancer', 'desert-raider', 'mangonel',
  'bedouin-swordsman', 'bedouin-skirmisher',
  'landsknecht',
];

const PATCH_ABILITY_IDS = [
  'ability-quick-strike', 'ability-camel-unease',
  'ability-golden-age-tier-4', 'ability-golden-age-tier-5',
  'ability-conversion', 'ability-proselytize', 'charge-attack',
  'charge-attack-1', 'ability-tactical-charge', 'ability-atabeg-supervision',
  'ability-swap-weapon-kinetic', 'ability-swap-weapon-incendiary',
  'ability-shield-wall',
];

const PATCH_TECH_IDS = [
  'camel-support', 'camel-support-4',
  'adjustable-crossbars', 'ability-quick-strike', 'ability-quick-strike-1',
  'composite-bows', 'composite-bows-3',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(downloadJSON(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} pour ${url}`));
      }
      let raw = '';
      res.on('data', chunk => (raw += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error(`JSON invalide depuis ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function readLocalJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function getIds(data) {
  const items = Array.isArray(data?.data) ? data.data : [];
  return new Set(items.map(x => x.id).filter(Boolean));
}

function diffIds(oldSet, newSet) {
  const added   = [...newSet].filter(id => !oldSet.has(id));
  const removed = [...oldSet].filter(id => !newSet.has(id));
  return { added, removed };
}

function checkPatchIds(patchIds, currentIds, label) {
  const missing = patchIds.filter(id => !currentIds.has(id));
  if (missing.length > 0) {
    console.warn(`  ⚠️  Patches ${label} — IDs introuvables dans les nouvelles données:`);
    missing.forEach(id => console.warn(`       • "${id}"  ← à vérifier dans src/data/patches/`));
  } else {
    console.log(`  ✅  Tous les IDs patchés (${label}) sont présents`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log('╔═══════════════════════════════════════════════╗');
console.log('║       Mise à jour des données AoE4            ║');
console.log('╚═══════════════════════════════════════════════╝');
if (DRY_RUN) console.log('Mode --dry-run : aucun fichier ne sera écrit.\n');
if (FORCE)   console.log('Mode --force   : remplacement même si version identique.\n');

let anyUpdate = false;

for (const source of SOURCES) {
  const destPath = path.join(DATA_DIR, source.dest);
  console.log(`\n─── ${source.name} ─────────────────────────────`);

  // 1. Lire version locale
  const local = readLocalJSON(destPath);
  const localVersion = local?.__version__ ?? '(inconnue)';
  console.log(`  Version locale   : ${localVersion}`);

  // 2. Télécharger
  let remote;
  try {
    console.log(`  Téléchargement...`);
    remote = await downloadJSON(source.url);
  } catch (err) {
    console.error(`  ❌  Échec : ${err.message}`);
    continue;
  }

  const remoteVersion = remote?.__version__ ?? '(inconnue)';
  console.log(`  Version distante : ${remoteVersion}`);

  // 3. Comparer versions
  if (!FORCE && localVersion === remoteVersion) {
    console.log(`  ✔  Déjà à jour, aucun changement.`);
    continue;
  }

  // 4. Diff des IDs
  const oldIds = getIds(local);
  const newIds = getIds(remote);
  const { added, removed } = diffIds(oldIds, newIds);

  if (added.length > 0) {
    console.log(`  ➕  Ajouts   (${added.length}) : ${added.slice(0, 8).join(', ')}${added.length > 8 ? ` … +${added.length - 8}` : ''}`);
  }
  if (removed.length > 0) {
    console.log(`  ➖  Supprimés (${removed.length}) : ${removed.slice(0, 8).join(', ')}${removed.length > 8 ? ` … +${removed.length - 8}` : ''}`);
  }
  if (added.length === 0 && removed.length === 0) {
    console.log(`  ↔  Aucun ID ajouté ou supprimé`);
  }

  // 5. Vérifier les patches selon le fichier
  if (source.dest === 'all-unified.json') {
    checkPatchIds(PATCH_UNIT_IDS, newIds, 'unités');
  } else if (source.dest === 'all-optimized_abi.json') {
    checkPatchIds(PATCH_ABILITY_IDS, newIds, 'capacités');
  } else if (source.dest === 'all-optimized_tec.json') {
    checkPatchIds(PATCH_TECH_IDS, newIds, 'technologies');
  }

  // 6. Écrire si pas dry-run
  if (!DRY_RUN) {
    fs.writeFileSync(destPath, JSON.stringify(remote, null, 2), 'utf-8');
    const sizeKB = Math.round(fs.statSync(destPath).size / 1024);
    console.log(`  💾  Fichier mis à jour → ${source.dest} (${sizeKB} KB)`);
    anyUpdate = true;
  } else {
    console.log(`  [dry-run] Fichier non écrit.`);
  }
}

console.log('\n══════════════════════════════════════════════════');
if (anyUpdate) {
  console.log('✅  Mise à jour terminée.');
  console.log('👉  Vérifiez les avertissements ⚠️  ci-dessus avant de committer.');
} else {
  console.log('✔  Tout était déjà à jour. Rien n\'a été modifié.');
}
console.log('══════════════════════════════════════════════════\n');
