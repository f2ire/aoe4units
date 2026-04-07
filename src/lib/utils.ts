import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
