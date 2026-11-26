export type Discipline = 'trail' | 'cyclo' | 'nordique' | 'jeunes' | 'general';

export const FILTERABLE_DISCIPLINES: ReadonlySet<Discipline> = new Set([
  'trail',
  'cyclo',
  'nordique',
  'jeunes',
]);

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  trail: "La Transju' Trails",
  cyclo: "La Transju' Cyclo",
  nordique: "La Transju' (ski de fond)",
  jeunes: "La Transju' Jeunes",
  general: "le portail général de La Transju'",
};

/**
 * Normalise une clé de discipline reçue (API/frontend) vers une des 5 disciplines valides.
 */
export function normalizeDiscipline(value?: string): Discipline {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === 'trail' ||
    normalized === 'cyclo' ||
    normalized === 'nordique' ||
    normalized === 'jeunes' ||
    normalized === 'general'
  ) {
    return normalized;
  }
  return 'general';
}

/**
 * Détermine la discipline d'un document à partir de son URL ou de son chemin/nom de fichier.
 */
export function resolveDiscipline(source: string): Discipline {
  const value = source.toLowerCase();

  if (value.includes('transju-trail') || value.includes('trail')) {
    return 'trail';
  }
  if (value.includes('transju-cyclo') || value.includes('cyclo')) {
    return 'cyclo';
  }
  if (value.includes('transju-jeunes') || value.includes('jeunes')) {
    return 'jeunes';
  }
  if (value.includes('la-transju') || value.includes('nordique') || value.includes('ski')) {
    return 'nordique';
  }

  return 'general';
}
