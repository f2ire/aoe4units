export interface Civilization {
  abbr: string;
  name: string;
  slug: string;
  flagPath: string;
}

export const CIVILIZATIONS: Civilization[] = [
  { abbr: 'ab', name: 'Abbasid Dynasty', slug: 'abbasid', flagPath: '/flags/ab.png' },
  { abbr: 'ay', name: 'Ayyubids', slug: 'ayyubids', flagPath: '/flags/ay.png' },
  { abbr: 'by', name: 'Byzantines', slug: 'byzantines', flagPath: '/flags/by.png' },
  { abbr: 'ch', name: 'Chinese', slug: 'chinese', flagPath: '/flags/ch.png' },
  { abbr: 'de', name: 'Delhi Sultanate', slug: 'delhi', flagPath: '/flags/de.png' },
  { abbr: 'en', name: 'English', slug: 'english', flagPath: '/flags/en.png' },
  { abbr: 'fr', name: 'French', slug: 'french', flagPath: '/flags/fr.png' },
  { abbr: 'gol', name: 'Golden Horde', slug: 'goldenhorde', flagPath: '/flags/gol.png' },
  { abbr: 'hr', name: 'Holy Roman Empire', slug: 'hre', flagPath: '/flags/hr.png' },
  { abbr: 'hl', name: 'House of Lancaster', slug: 'lancaster', flagPath: '/flags/hl.png' },
  { abbr: 'ja', name: 'Japanese', slug: 'japanese', flagPath: '/flags/ja.png' },
  { abbr: 'je', name: "Jeanne d'Arc", slug: 'jeannedarc', flagPath: '/flags/je.png' },
  { abbr: 'kt', name: 'Knights Templar', slug: 'templar', flagPath: '/flags/kt.png' },
  { abbr: 'mac', name: 'Macedonian Dynasty', slug: 'macedonian', flagPath: '/flags/mac.png' },
  { abbr: 'ma', name: 'Malians', slug: 'malians', flagPath: '/flags/ma.png' },
  { abbr: 'mo', name: 'Mongols', slug: 'mongols', flagPath: '/flags/mo.png' },
  { abbr: 'od', name: 'Order of the Dragon', slug: 'dragon', flagPath: '/flags/od.png' },
  { abbr: 'ot', name: 'Ottomans', slug: 'ottomans', flagPath: '/flags/ot.png' },
  { abbr: 'ru', name: 'Rus', slug: 'rus', flagPath: '/flags/ru.png' },
  { abbr: 'sen', name: 'Sengoku Dynasty', slug: 'sengoku', flagPath: '/flags/sen.png' },
  { abbr: 'tug', name: 'Tughlaq Dynasty', slug: 'tughlaq', flagPath: '/flags/tug.png' },
  { abbr: 'zx', name: "Zhu Xi's Legacy", slug: 'zhuxi', flagPath: '/flags/zx.png' },

];

export const getCivilizationByAbbr = (abbr: string): Civilization | undefined => {
  return CIVILIZATIONS.find(civ => civ.abbr === abbr);
};

export const getCivilizationName = (abbr: string): string => {
  const civ = getCivilizationByAbbr(abbr);
  return civ ? civ.name : abbr.toUpperCase();
};
