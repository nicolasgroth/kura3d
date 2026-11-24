/**
 * @file src/i18n/locales/ux10.ts
 * @description Textos del lote ux10 (arrastrar un objeto seleccionado para moverlo) en los 6 idiomas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };
type Lang = keyof Row;

const UX10 = {
  'ux10.drag.locked': {
    es: 'Los objetos seleccionados están bloqueados: desbloquéalos para moverlos.',
    en: 'The selected objects are locked: unlock them to move them.',
    de: 'Die ausgewählten Objekte sind gesperrt: Entsperre sie, um sie zu verschieben.',
    fr: 'Les objets sélectionnés sont verrouillés : déverrouillez-les pour les déplacer.',
    hi: 'चुने गए ऑब्जेक्ट लॉक हैं: उन्हें खिसकाने के लिए अनलॉक करें।',
    zh: '所选对象已锁定:请先解锁再移动。',
  },
  'ux10.shortcuts.dragMove': {
    es: 'Arrastrar un objeto seleccionado: lo mueve sobre el plano horizontal (Esc cancela)',
    en: 'Drag a selected object: moves it on the horizontal plane (Esc cancels)',
    de: 'Ausgewähltes Objekt ziehen: verschiebt es auf der horizontalen Ebene (Esc bricht ab)',
    fr: 'Glisser un objet sélectionné : le déplace sur le plan horizontal (Échap annule)',
    hi: 'चुने ऑब्जेक्ट को ड्रैग करें: क्षैतिज तल पर खिसकता है (Esc रद्द करता है)',
    zh: '拖动已选对象:在水平面上移动(Esc 取消)',
  },
} satisfies Record<string, Row>;

type Dict = { [K in keyof typeof UX10]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(UX10).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const UX10_ES = pick('es');
export const UX10_EN = pick('en');
export const UX10_DE = pick('de');
export const UX10_FR = pick('fr');
export const UX10_HI = pick('hi');
export const UX10_ZH = pick('zh');
