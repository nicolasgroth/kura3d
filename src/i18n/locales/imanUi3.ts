/**
 * @file src/i18n/locales/imanUi3.ts
 * @description Textos de la tercera ronda de interfaz del alojamiento de imán y piezas que comparte: nombre propio
 * del «Deshacer» del preajuste eliminado, rótulo de «Aplicar restas de la selección» y nombre del botón de tamaño de
 * la hoja inferior. Cada clave lleva [es, en, de, fr, hi, zh]; `IMAN_UI3_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const TABLE = {
  'magnet.preset.undoDelete': [
    'Deshacer eliminación del preajuste',
    'Undo preset deletion',
    'Löschen der Vorgabe rückgängig machen',
    'Annuler la suppression du préréglage',
    'प्रीसेट हटाना पूर्ववत करें',
    '撤销删除预设',
  ],
  'inspector.op.applyBooleansSel.one': [
    'Aplicar {count} resta de la selección',
    'Apply {count} subtraction from the selection',
    '{count} Abzug der Auswahl anwenden',
    'Appliquer {count} soustraction de la sélection',
    'चयन का {count} घटाव लागू करें',
    '应用所选内容的 {count} 项减法',
  ],
  'inspector.op.applyBooleansSel.other': [
    'Aplicar {count} restas de la selección',
    'Apply {count} subtractions from the selection',
    '{count} Abzüge der Auswahl anwenden',
    'Appliquer {count} soustractions de la sélection',
    'चयन के {count} घटाव लागू करें',
    '应用所选内容的 {count} 项减法',
  ],
  'uxm.sheet.resize': [
    'Cambiar tamaño del panel',
    'Resize the panel',
    'Größe des Bereichs ändern',
    'Redimensionner le panneau',
    'पैनल का आकार बदलें',
    '调整面板大小',
  ],
} satisfies Record<string, Row>;

type Ui3Key = keyof typeof TABLE;

const pick = (index: number) =>
  Object.fromEntries(Object.entries(TABLE).map(([key, row]) => [key, row[index]])) as Record<Ui3Key, string>;

export const IMAN_UI3_ES = pick(0);
export const IMAN_UI3_EN = pick(1);
export const IMAN_UI3_DE = pick(2);
export const IMAN_UI3_FR = pick(3);
export const IMAN_UI3_HI = pick(4);
export const IMAN_UI3_ZH = pick(5);
