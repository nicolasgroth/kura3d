/**
 * @file src/i18n/locales/ux8.ts
 * @description Textos del lote ux8 en los 6 idiomas (atajo Mayús+H, «N avisos más», resultado desactualizado de Dividir,
 * sección de Medir y copyright corto del pie). Cada clave se escribe una vez con sus 6 idiomas; `UX8_<IDIOMA>` se mezcla
 * en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
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
  'ux8.minWidth.notice': {
    es: 'Kurra Studio está pensado para pantallas de al menos 1024 px de ancho. En una más angosta puedes seguir, pero algunas partes pueden verse apretadas.',
    en: 'Kurra Studio is designed for screens at least 1024 px wide. You can keep going on a narrower one, but some parts may look cramped.',
    de: 'Kurra Studio ist für Bildschirme ab 1024 px Breite gedacht. Auf einem schmaleren kannst du weitermachen, aber manches kann gedrängt wirken.',
    fr: 'Kurra Studio est pensé pour des écrans d’au moins 1024 px de large. Tu peux continuer sur un écran plus étroit, mais certaines parties peuvent sembler serrées.',
    hi: 'Kurra Studio कम से कम 1024 px चौड़ी स्क्रीन के लिए बना है। छोटी स्क्रीन पर भी काम कर सकते हैं, पर कुछ हिस्से तंग दिख सकते हैं।',
    zh: 'Kurra Studio 适用于宽度至少 1024 px 的屏幕。在更窄的屏幕上仍可使用,但部分界面可能显得拥挤。',
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
