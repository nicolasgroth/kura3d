/**
 * @file src/i18n/locales/ux8Menu.ts
 * @description Textos del lote ux8 (menú contextual corto del objeto y pintura) en los 6 idiomas: Ocultar/Mostrar y
 * Bloquear/Desbloquear en el primer nivel del menú y el destino de la pintura con varios objetos seleccionados.
 * Cada clave se escribe una vez con sus 6 idiomas; `UX8_MENU_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const UX8_MENU = {
  'ux8.menu.show': { es: 'Mostrar', en: 'Show', de: 'Einblenden', fr: 'Afficher', hi: 'दिखाएँ', zh: '显示' },
  'ux8.menu.show.tip': {
    es: 'Vuelve a mostrar el objeto en el visor (y a incluirlo al exportar)',
    en: 'Show the object in the viewport again (and include it when exporting)',
    de: 'Das Objekt wieder im Viewport zeigen (und beim Export einbeziehen)',
    fr: 'Réafficher l’objet dans la vue (et l’inclure à l’export)',
    hi: 'ऑब्जेक्ट को फिर से व्यूपोर्ट में दिखाएँ (और निर्यात में शामिल करें)',
    zh: '重新在视图中显示该对象（导出时也会包含）',
  },
  'ux8.menu.lock': { es: 'Bloquear', en: 'Lock', de: 'Sperren', fr: 'Verrouiller', hi: 'लॉक करें', zh: '锁定' },
  'ux8.menu.lock.tip': {
    es: 'Bloquea la edición: no se puede mover ni modificar hasta desbloquearlo',
    en: 'Lock editing: it cannot be moved or changed until unlocked',
    de: 'Bearbeitung sperren: Das Objekt lässt sich bis zum Entsperren nicht verschieben oder ändern',
    fr: 'Verrouiller l’édition : impossible de le déplacer ou de le modifier avant de le déverrouiller',
    hi: 'संपादन लॉक करें: अनलॉक करने तक इसे हिलाया या बदला नहीं जा सकता',
    zh: '锁定编辑：解锁之前无法移动或修改',
  },
  'ux8.menu.unlock': { es: 'Desbloquear', en: 'Unlock', de: 'Entsperren', fr: 'Déverrouiller', hi: 'अनलॉक करें', zh: '解锁' },
  'ux8.menu.unlock.tip': {
    es: 'Permite volver a editar el objeto',
    en: 'Allow editing the object again',
    de: 'Das Objekt wieder bearbeitbar machen',
    fr: 'Permettre de modifier de nouveau l’objet',
    hi: 'ऑब्जेक्ट को फिर से संपादित करने दें',
    zh: '允许再次编辑该对象',
  },
  'ux8.paint.targetMany': {
    es: 'Pintando: {name} y {count} {count?objeto más|objetos más}',
    en: 'Painting: {name} and {count} more {count?object|objects}',
    de: 'Bemalt wird: {name} und {count} weitere',
    fr: 'Peinture sur : {name} et {count} {count?autre|autres}',
    hi: 'रंगा जा रहा है: {name} और {count} अन्य',
    zh: '正在上色：{name} 及另外 {count} 个',
  },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof UX8_MENU]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(UX8_MENU).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const UX8_MENU_ES = pick('es');
export const UX8_MENU_EN = pick('en');
export const UX8_MENU_DE = pick('de');
export const UX8_MENU_FR = pick('fr');
export const UX8_MENU_HI = pick('hi');
export const UX8_MENU_ZH = pick('zh');
