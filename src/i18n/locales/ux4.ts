/**
 * @file src/i18n/locales/ux4.ts
 * @description Textos de los pendientes de la cuarta revisión de usabilidad (rótulos de pieza de Dividir,
 * pestañas Inspector | Asistente, rango estricto de campos, nombres de las mitades del corte) en los 6 idiomas.
 * Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const UX4_TABLE = {
  'ux4.labels.show': ['Mostrar rótulos de pieza', 'Show part labels', 'Teilebeschriftungen anzeigen', 'Afficher les étiquettes de pièce', 'पीस लेबल दिखाएँ', '显示零件标签'],
  'ux4.labels.showTip': [
    'Muestra el código de cada pieza (A1, B1a…) sobre ella en el visor',
    'Shows each part’s code (A1, B1a…) over it in the viewport',
    'Zeigt den Code jedes Teils (A1, B1a …) darüber im Viewport an',
    'Affiche le code de chaque pièce (A1, B1a…) au-dessus dans la vue 3D',
    'व्यूपोर्ट में हर पीस के ऊपर उसका कोड (A1, B1a…) दिखाता है',
    '在视图中于每个零件上方显示其编号(A1、B1a…)',
  ],
  'ux4.scale.positive': [
    'La escala debe ser mayor que 0: un valor cero o negativo no se aplica.',
    'Scale must be greater than 0: a zero or negative value is not applied.',
    'Die Skalierung muss größer als 0 sein: Null oder negative Werte werden nicht übernommen.',
    'L’échelle doit être supérieure à 0 : une valeur nulle ou négative n’est pas appliquée.',
    'स्केल 0 से अधिक होना चाहिए: शून्य या ऋणात्मक मान लागू नहीं होता।',
    '缩放必须大于 0:零或负值不会被应用。',
  ],
} as const satisfies Record<string, Row>;

type Ux4Key = keyof typeof UX4_TABLE;

const pick = (index: number): Record<Ux4Key, string> =>
  Object.fromEntries(Object.entries(UX4_TABLE).map(([key, row]) => [key, row[index]])) as Record<Ux4Key, string>;

export const UX4_ES = pick(0);
export const UX4_EN = pick(1);
export const UX4_DE = pick(2);
export const UX4_FR = pick(3);
export const UX4_HI = pick(4);
export const UX4_ZH = pick(5);
