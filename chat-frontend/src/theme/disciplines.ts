export type DisciplineKey = 'trail' | 'cyclo' | 'nordique' | 'jeunes' | 'general';

export interface DisciplineTheme {
  key: DisciplineKey;
  label: string;
  shortTag?: string;
  primary: string;
  accent: string;
  accentHover: string;
  accentText: string;
  headerBorder: string;
  iconColor: string;
}

/**
 * Thèmes officiels issus de la Charte Graphique La Transju' (Système colorimétrique p.15 & p.17) :
 * - Midnight Blue : #110856 (commune / ski nordique)
 * - Carribean Green : #6CC66F (Trails)
 * - Orange Yellow : #FFC239 (Cyclo)
 * - Razzmatazz : #EA0066 (Jeunes & couleur d'appel générale)
 */
export const DISCIPLINE_THEMES: Record<DisciplineKey, DisciplineTheme> = {
  trail: {
    key: 'trail',
    label: "La Transju' Trails",
    shortTag: 'Trails',
    primary: '#110856',
    accent: '#6CC66F',
    accentHover: '#57B15A',
    accentText: '#110856',
    headerBorder: '#6CC66F',
    iconColor: '#6CC66F',
  },
  cyclo: {
    key: 'cyclo',
    label: "La Transju' Cyclo",
    shortTag: 'Cyclo',
    primary: '#110856',
    accent: '#FFC239',
    accentHover: '#E5AA20',
    accentText: '#110856',
    headerBorder: '#FFC239',
    iconColor: '#FFC239',
  },
  jeunes: {
    key: 'jeunes',
    label: "La Transju' Jeunes",
    shortTag: 'Jeunes',
    primary: '#110856',
    accent: '#EA0066',
    accentHover: '#C80056',
    accentText: '#FFFFFF',
    headerBorder: '#EA0066',
    iconColor: '#EA0066',
  },
  nordique: {
    key: 'nordique',
    label: "La Transju' (Ski de fond)",
    shortTag: 'Ski',
    primary: '#110856',
    accent: '#110856',
    accentHover: '#23167A',
    accentText: '#FFFFFF',
    headerBorder: '#D0D0D0',
    iconColor: '#FFFFFF',
  },
  general: {
    key: 'general',
    label: "La Transju'",
    primary: '#110856',
    accent: '#EA0066',
    accentHover: '#C80056',
    accentText: '#FFFFFF',
    headerBorder: '#EA0066',
    iconColor: '#FFFFFF',
  },
};

export function getDisciplineTheme(discipline?: string): DisciplineTheme {
  const key = discipline?.trim().toLowerCase() as DisciplineKey;
  return DISCIPLINE_THEMES[key] ?? DISCIPLINE_THEMES.general;
}
