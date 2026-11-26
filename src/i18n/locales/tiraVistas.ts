/**
 * @file src/i18n/locales/tiraVistas.ts
 * @description Textos de la tira de vistas y placas (selector de vista al inicio de la tira, notas de Armado y Libre,
 * consejo del visor expandible) y del informe de Simplificar (tolerancia pedida, «se deshizo») en los 6 idiomas.
 * Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const TIRA_VISTAS_TABLE = {
  'viewMode.strip.armed': [
    '{count} {count?placa|placas} · se {count?edita|editan} en Imprimir',
    '{count} {count?plate|plates} · edited in Print',
    '{count} {count?Platte|Platten} · Bearbeitung in „Drucken“',
    '{count} {count?plateau|plateaux} · modifiable dans Impression',
    '{count} {count?प्लेट|प्लेटें} · प्रिंट में संपादित होती हैं',
    '{count} 块打印板 · 请在“打印”视图中编辑',
  ],
  'viewMode.strip.free': [
    'Vista libre: sin camas',
    'Free view: no beds',
    'Freie Ansicht: ohne Druckbetten',
    'Vue libre : sans plateaux',
    'मुक्त दृश्य: बेड नहीं',
    '自由视图:无打印板',
  ],
  'viewport.protip.expand': [
    'Consejo completo',
    'Full tip',
    'Ganzer Tipp',
    'Conseil complet',
    'पूरी सलाह',
    '完整提示',
  ],
  'simplify.report.toleranceAsked': [
    'Tolerancia pedida: {mm} mm',
    'Requested tolerance: {mm} mm',
    'Angeforderte Toleranz: {mm} mm',
    'Tolérance demandée : {mm} mm',
    'अनुरोधित सहनशीलता: {mm} mm',
    '所设公差:{mm} mm',
  ],
  'simplify.report.undone': [
    'Se deshizo la simplificación: la pieza volvió a su estado anterior.',
    'The simplification was undone: the part is back to its previous state.',
    'Die Vereinfachung wurde rückgängig gemacht: Das Teil ist wieder im vorherigen Zustand.',
    'La simplification a été annulée : la pièce est revenue à son état précédent.',
    'सरलीकरण पूर्ववत हो गया: हिस्सा अपनी पिछली स्थिति में लौट आया।',
    '已撤销简化:零件恢复为之前的状态。',
  ],
} as const satisfies Record<string, Row>;

type TiraKey = keyof typeof TIRA_VISTAS_TABLE;

const pick = (index: number): Record<TiraKey, string> =>
  Object.fromEntries(Object.entries(TIRA_VISTAS_TABLE).map(([key, row]) => [key, (row as Row)[index]])) as Record<TiraKey, string>;

export const TIRA_VISTAS_ES = pick(0);
export const TIRA_VISTAS_EN = pick(1);
export const TIRA_VISTAS_DE = pick(2);
export const TIRA_VISTAS_FR = pick(3);
export const TIRA_VISTAS_HI = pick(4);
export const TIRA_VISTAS_ZH = pick(5);
