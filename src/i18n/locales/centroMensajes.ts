/**
 * @file src/i18n/locales/centroMensajes.ts
 * @description Textos del centro de mensajes (iconos de errores, advertencias e información con su panel de histórico)
 * en los 6 idiomas. Cada clave se escribe una vez con sus 6 idiomas; `CENTRO_MENSAJES_<IDIOMA>` se mezcla en cada
 * diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };
type Lang = keyof Row;

const CENTRO = {
  'toastCenter.count.error': {
    es: '{count} {count?error|errores}',
    en: '{count} {count?error|errors}',
    de: '{count} {count?Fehler|Fehler}',
    fr: '{count} {count?erreur|erreurs}',
    hi: '{count} {count?त्रुटि|त्रुटियाँ}',
    zh: '{count} 个错误',
  },
  'toastCenter.count.warning': {
    es: '{count} {count?advertencia|advertencias}',
    en: '{count} {count?warning|warnings}',
    de: '{count} {count?Warnung|Warnungen}',
    fr: '{count} {count?avertissement|avertissements}',
    hi: '{count} {count?चेतावनी|चेतावनियाँ}',
    zh: '{count} 条警告',
  },
  'toastCenter.count.info': {
    es: '{count} {count?mensaje informativo|mensajes informativos}',
    en: '{count} info {count?message|messages}',
    de: '{count} {count?Information|Informationen}',
    fr: '{count} {count?information|informations}',
    hi: '{count} {count?सूचना|सूचनाएँ}',
    zh: '{count} 条信息',
  },
  'toastCenter.title.error': {
    es: 'Errores',
    en: 'Errors',
    de: 'Fehler',
    fr: 'Erreurs',
    hi: 'त्रुटियाँ',
    zh: '错误',
  },
  'toastCenter.title.warning': {
    es: 'Advertencias',
    en: 'Warnings',
    de: 'Warnungen',
    fr: 'Avertissements',
    hi: 'चेतावनियाँ',
    zh: '警告',
  },
  'toastCenter.title.info': {
    es: 'Información',
    en: 'Information',
    de: 'Informationen',
    fr: 'Informations',
    hi: 'जानकारी',
    zh: '信息',
  },
  'toastCenter.openTip': {
    es: 'Ver los mensajes: {label}',
    en: 'Show messages: {label}',
    de: 'Meldungen anzeigen: {label}',
    fr: 'Voir les messages : {label}',
    hi: 'संदेश देखें: {label}',
    zh: '查看消息：{label}',
  },
  'toastCenter.remove': {
    es: 'Quitar este mensaje',
    en: 'Remove this message',
    de: 'Diese Meldung entfernen',
    fr: 'Retirer ce message',
    hi: 'यह संदेश हटाएँ',
    zh: '移除此消息',
  },
  'toastCenter.removeNamed': {
    es: 'Quitar: {text}',
    en: 'Remove: {text}',
    de: 'Entfernen: {text}',
    fr: 'Retirer : {text}',
    hi: 'हटाएँ: {text}',
    zh: '移除：{text}',
  },
  'toastCenter.clear': {
    es: 'Vaciar',
    en: 'Clear',
    de: 'Leeren',
    fr: 'Vider',
    hi: 'खाली करें',
    zh: '清空',
  },
  'toastCenter.clearTip': {
    es: 'Quitar todos los mensajes de «{title}»',
    en: 'Remove all “{title}” messages',
    de: 'Alle Meldungen unter „{title}“ entfernen',
    fr: 'Retirer tous les messages « {title} »',
    hi: '«{title}» के सभी संदेश हटाएँ',
    zh: '移除所有“{title}”消息',
  },
} satisfies Record<string, Row>;

type Dict = { [K in keyof typeof CENTRO]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(CENTRO).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const CENTRO_MENSAJES_ES = pick('es');
export const CENTRO_MENSAJES_EN = pick('en');
export const CENTRO_MENSAJES_DE = pick('de');
export const CENTRO_MENSAJES_FR = pick('fr');
export const CENTRO_MENSAJES_HI = pick('hi');
export const CENTRO_MENSAJES_ZH = pick('zh');
