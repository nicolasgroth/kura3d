/**
 * @file src/i18n/locales/ux8.ts
 * @description Textos del lote ux8 en los 6 idiomas (atajo Mayús+H, «N avisos más», resultado desactualizado de Dividir,
 * sección de Medir y copyright corto del pie). Cada clave se escribe una vez con sus 6 idiomas; `UX8_<IDIOMA>` se mezcla
 * en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };
type Lang = keyof Row;

const UX8 = {
  'ux8.shortcuts.toggleVisible': {
    es: 'Ocultar la selección / volver a mostrarla (sin selección: mostrar todo)',
    en: 'Hide the selection / show it again (nothing selected: show all)',
    de: 'Auswahl ausblenden / wieder einblenden (ohne Auswahl: alles einblenden)',
    fr: 'Masquer la sélection / la réafficher (sans sélection : tout afficher)',
    hi: 'चयन छिपाएँ / फिर दिखाएँ (कुछ न चुना हो: सब दिखाएँ)',
    zh: '隐藏所选 / 重新显示(未选择时:全部显示)',
  },
  'ux8.toast.more': {
    es: '{count} {count?aviso|avisos} más',
    en: '{count} more {count?notice|notices}',
    de: '{count} weitere {count?Hinweis|Hinweise}',
    fr: '{count} {count?avis|avis} de plus',
    hi: '{count} और सूचनाएँ',
    zh: '另有 {count} 条提示',
  },
  'ux8.split.stale': {
    es: 'El resultado anterior está desactualizado.',
    en: 'The previous result is out of date.',
    de: 'Das vorherige Ergebnis ist veraltet.',
    fr: 'Le résultat précédent est périmé.',
    hi: 'पिछला परिणाम पुराना हो गया है।',
    zh: '上一次的结果已过时。',
  },
  'ux8.measure.object': {
    es: 'Objeto seleccionado',
    en: 'Selected object',
    de: 'Ausgewähltes Objekt',
    fr: 'Objet sélectionné',
    hi: 'चयनित वस्तु',
    zh: '所选对象',
  },
  'ux8.status.copyrightShort': {
    es: '© 2026 ISGROTH',
    en: '© 2026 ISGROTH',
    de: '© 2026 ISGROTH',
    fr: '© 2026 ISGROTH',
    hi: '© 2026 ISGROTH',
    zh: '© 2026 ISGROTH',
  },
} satisfies Record<string, Row>;

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
