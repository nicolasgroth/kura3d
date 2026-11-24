/**
 * @file src/i18n/locales/ux8.ts
 * @description Textos del lote ux8 (colocación y borradores) en los 6 idiomas: atajo Mayús+H del visor
 * en la ayuda de atajos. Cada clave se escribe una vez con sus 6 idiomas; `UX8_<IDIOMA>` se mezcla en
 * cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const UX8 = {
  'ux8.shortcuts.toggleVisible': {
    es: 'Ocultar la selección / volver a mostrarla (sin selección: mostrar todo)',
    en: 'Hide the selection / show it again (nothing selected: show all)',
    de: 'Auswahl ausblenden / wieder einblenden (ohne Auswahl: alles einblenden)',
    fr: 'Masquer la sélection / la réafficher (sans sélection : tout afficher)',
    hi: 'चयन छिपाएँ / फिर दिखाएँ (कुछ न चुना हो: सब दिखाएँ)',
    zh: '隐藏所选 / 重新显示(未选择时:全部显示)',
  },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof UX8]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(UX8).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const UX8_ES = pick('es');
export const UX8_EN = pick('en');
export const UX8_DE = pick('de');
export const UX8_FR = pick('fr');
export const UX8_HI = pick('hi');
export const UX8_ZH = pick('zh');
