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
    es: 'Arrastrar un objeto seleccionado: lo mueve en el plano de la vista (Alt: vertical; Mayús: un solo eje; Esc cancela; con rejilla libre, Ctrl ajusta a 1 mm)',
    en: 'Drag a selected object: moves it in the plane of the view (Alt: vertical; Shift: single axis; Esc cancels; with free grid, Ctrl snaps to 1 mm)',
    de: 'Ausgewähltes Objekt ziehen: verschiebt es in der Ebene der Ansicht (Alt: senkrecht; Umschalt: eine Achse; Esc bricht ab; bei freiem Raster rastet Strg auf 1 mm ein)',
    fr: 'Glisser un objet sélectionné : le déplace dans le plan de la vue (Alt : vertical ; Maj : un seul axe ; Échap annule ; avec grille libre, Ctrl aimante à 1 mm)',
    hi: 'चुने ऑब्जेक्ट को ड्रैग करें: दृश्य के तल में खिसकता है (Alt: ऊर्ध्वाधर; Shift: एक अक्ष; Esc रद्द करता है; मुक्त ग्रिड में Ctrl 1 मिमी पर रोकता है)',
    zh: '拖动已选对象:在视图所在平面内移动(Alt:垂直;Shift:单轴;Esc 取消;自由网格时按 Ctrl 以 1 mm 对齐)',
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
