import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Minuscules + suppression des accents pour une comparaison robuste. */
function normalizeForSearch(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Score de correspondance d'un nom d'unité face à une requête de recherche.
 * Règle : chaque caractère de la requête doit exister dans le nom (en
 * respectant les répétitions). Si un caractère manque → 0 (l'unité est filtrée).
 * Ex : "mgda" correspond à "Mangudai" (m, g, d, a tous présents).
 *   3 = sous-chaîne contiguë (ex. "arch" dans "Archer")
 *   2 = caractères présents dans l'ordre (sous-séquence)
 *   1 = tous présents mais dans le désordre
 *   0 = au moins un caractère manquant
 * @param name - nom de l'unité
 * @param query - requête (trimmée)
 * @returns score 0..3
 */
export function unitNameMatchScore(name: string, query: string): number {
  const n = normalizeForSearch(name);
  const q = normalizeForSearch(query);
  if (q.length === 0) return 1;

  // Tous les caractères de la requête présents dans le nom (multiset) ?
  const counts: Record<string, number> = {};
  for (const ch of n) counts[ch] = (counts[ch] || 0) + 1;
  for (const ch of q) {
    if (!counts[ch]) return 0;
    counts[ch]--;
  }

  if (n.includes(q)) return 3;

  // Sous-séquence : les caractères apparaissent dans l'ordre ?
  let i = 0;
  for (const ch of n) {
    if (ch === q[i]) i++;
    if (i === q.length) break;
  }
  return i === q.length ? 2 : 1;
}

/**
 * Formate un nom de classe pour l'affichage
 * Remplace les underscores par des espaces et applique la casse appropriée
 * @param className - Le nom de la classe (ex: "archer_ship" ou "melee_infantry")
 * @returns Le nom formaté pour l'affichage (ex: "Archer Ship" ou "Melee Infantry")
 */
export function formatClassName(className: string): string {
  // Remplacer les underscores par des espaces et capitaliser chaque mot
  return className
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Formate un array de classes pour l'affichage
 * @param classes - Array de noms de classes
 * @returns String formaté avec espaces au lieu d'underscores
 */
export function formatClassNames(classes: string[] | string[][]): string {
  if (!Array.isArray(classes)) return '';
  
  // Si c'est un array de arrays, flatten et formater
  if (classes.length > 0 && Array.isArray(classes[0])) {
    return (classes as string[][])
      .map(group => group.map(formatClassName).join(' + '))
      .join(' / ');
  }
  
  // Sinon formater chaque classe et joindre avec des espaces
  return (classes as string[])
    .map(formatClassName)
    .join(' ');
}
