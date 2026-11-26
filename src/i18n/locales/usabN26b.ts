/**
 * @file src/i18n/locales/usabN26b.ts
 * @description Textos de la segunda tanda de correcciones de usabilidad (nombre del lienzo del visor sin «plano de corte»,
 * nombre de placa repetido, aviso de «Mover a placa» y de «Repartir en placas») en los 6 idiomas.
 * Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const USAB_N26B_TABLE = {
  'viewport.canvasLabelBase': [
    'Visor 3D. F encuadra la selección.',
    '3D viewport. F frames the selection.',
    '3D-Ansichtsfenster. F rahmt die Auswahl ein.',
    'Vue 3D. F cadre la sélection.',
    '3D व्यूपोर्ट। F चयन को फ़्रेम करता है।',
    '3D 视图。F 框选所选对象。',
  ],
} as const satisfies Record<string, Row>;

type UsabKey = keyof typeof USAB_N26B_TABLE;

const pick = (index: number): Record<UsabKey, string> =>
  Object.fromEntries(Object.entries(USAB_N26B_TABLE).map(([key, row]) => [key, (row as Row)[index]])) as Record<UsabKey, string>;

export const USAB_N26B_ES = pick(0);
export const USAB_N26B_EN = pick(1);
export const USAB_N26B_DE = pick(2);
export const USAB_N26B_FR = pick(3);
export const USAB_N26B_HI = pick(4);
export const USAB_N26B_ZH = pick(5);
