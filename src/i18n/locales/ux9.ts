/**
 * @file src/i18n/locales/ux9.ts
 * @description Textos del lote ux9 (pendientes de la evaluación de usabilidad) en los 6 idiomas: pasos del
 * historial con su acción real, conversión de unidades de un modelo diminuto, nombres de filamentos repetidos,
 * avisos de dividir y reparar en lenguaje claro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };
type Lang = keyof Row;

const UX9 = {
  'ux9.history.rename': {
    es: 'Renombrar a "{name}"',
    en: 'Rename to "{name}"',
    de: 'Umbenennen in „{name}“',
    fr: 'Renommer en « {name} »',
    hi: '"{name}" नाम रखें',
    zh: '重命名为"{name}"',
  },
  'ux9.history.renameMany': {
    es: 'Renombrar {count} objetos',
    en: 'Rename {count} objects',
    de: '{count} Objekte umbenennen',
    fr: 'Renommer {count} objets',
    hi: '{count} ऑब्जेक्ट का नाम बदलें',
    zh: '重命名 {count} 个对象',
  },
  'ux9.history.hide': {
    es: 'Ocultar "{name}"',
    en: 'Hide "{name}"',
    de: '„{name}“ ausblenden',
    fr: 'Masquer « {name} »',
    hi: '"{name}" छिपाएँ',
    zh: '隐藏"{name}"',
  },
  'ux9.history.hideMany': {
    es: 'Ocultar {count} objetos',
    en: 'Hide {count} objects',
    de: '{count} Objekte ausblenden',
    fr: 'Masquer {count} objets',
    hi: '{count} ऑब्जेक्ट छिपाएँ',
    zh: '隐藏 {count} 个对象',
  },
  'ux9.history.show': {
    es: 'Mostrar "{name}"',
    en: 'Show "{name}"',
    de: '„{name}“ einblenden',
    fr: 'Afficher « {name} »',
    hi: '"{name}" दिखाएँ',
    zh: '显示"{name}"',
  },
  'ux9.history.showMany': {
    es: 'Mostrar {count} objetos',
    en: 'Show {count} objects',
    de: '{count} Objekte einblenden',
    fr: 'Afficher {count} objets',
    hi: '{count} ऑब्जेक्ट दिखाएँ',
    zh: '显示 {count} 个对象',
  },
  'ux9.history.lock': {
    es: 'Bloquear "{name}"',
    en: 'Lock "{name}"',
    de: '„{name}“ sperren',
    fr: 'Verrouiller « {name} »',
    hi: '"{name}" लॉक करें',
    zh: '锁定"{name}"',
  },
  'ux9.history.lockMany': {
    es: 'Bloquear {count} objetos',
    en: 'Lock {count} objects',
    de: '{count} Objekte sperren',
    fr: 'Verrouiller {count} objets',
    hi: '{count} ऑब्जेक्ट लॉक करें',
    zh: '锁定 {count} 个对象',
  },
  'ux9.history.unlock': {
    es: 'Desbloquear "{name}"',
    en: 'Unlock "{name}"',
    de: '„{name}“ entsperren',
    fr: 'Déverrouiller « {name} »',
    hi: '"{name}" अनलॉक करें',
    zh: '解锁"{name}"',
  },
  'ux9.history.unlockMany': {
    es: 'Desbloquear {count} objetos',
    en: 'Unlock {count} objects',
    de: '{count} Objekte entsperren',
    fr: 'Déverrouiller {count} objets',
    hi: '{count} ऑब्जेक्ट अनलॉक करें',
    zh: '解锁 {count} 个对象',
  },
  'ux9.history.groupOne': {
    es: 'Agrupar "{name}"',
    en: 'Group "{name}"',
    de: '„{name}“ gruppieren',
    fr: 'Grouper « {name} »',
    hi: '"{name}" को समूहित करें',
    zh: '编组"{name}"',
  },
  'ux9.history.groupMany': {
    es: 'Agrupar {count} objetos',
    en: 'Group {count} objects',
    de: '{count} Objekte gruppieren',
    fr: 'Grouper {count} objets',
    hi: '{count} ऑब्जेक्ट समूहित करें',
    zh: '编组 {count} 个对象',
  },
  'ux9.history.ungroupOne': {
    es: 'Desagrupar "{name}"',
    en: 'Ungroup "{name}"',
    de: 'Gruppierung von „{name}“ aufheben',
    fr: 'Dégrouper « {name} »',
    hi: '"{name}" का समूह हटाएँ',
    zh: '取消编组"{name}"',
  },
  'ux9.history.ungroupMany': {
    es: 'Desagrupar {count} objetos',
    en: 'Ungroup {count} objects',
    de: 'Gruppierung von {count} Objekten aufheben',
    fr: 'Dégrouper {count} objets',
    hi: '{count} ऑब्जेक्ट का समूह हटाएँ',
    zh: '取消编组 {count} 个对象',
  },
  'ux9.history.color': {
    es: 'Cambiar color de "{name}"',
    en: 'Change color of "{name}"',
    de: 'Farbe von „{name}“ ändern',
    fr: 'Changer la couleur de « {name} »',
    hi: '"{name}" का रंग बदलें',
    zh: '更改"{name}"的颜色',
  },
  'ux9.history.colorMany': {
    es: 'Cambiar color de {count} objetos',
    en: 'Change color of {count} objects',
    de: 'Farbe von {count} Objekten ändern',
    fr: 'Changer la couleur de {count} objets',
    hi: '{count} ऑब्जेक्ट का रंग बदलें',
    zh: '更改 {count} 个对象的颜色',
  },
  'ux9.history.param': {
    es: 'Cambiar {param} de {name}',
    en: 'Change {param} of {name}',
    de: '{param} von {name} ändern',
    fr: 'Modifier {param} de {name}',
    hi: '{name} का {param} बदलें',
    zh: '更改 {name} 的{param}',
  },
  'ux9.history.params': {
    es: 'Cambiar parámetros de {name}',
    en: 'Change parameters of {name}',
    de: 'Parameter von {name} ändern',
    fr: 'Modifier les paramètres de {name}',
    hi: '{name} के पैरामीटर बदलें',
    zh: '更改 {name} 的参数',
  },
  'ux9.history.paramsMany': {
    es: 'Cambiar parámetros de {count} objetos',
    en: 'Change parameters of {count} objects',
    de: 'Parameter von {count} Objekten ändern',
    fr: 'Modifier les paramètres de {count} objets',
    hi: '{count} ऑब्जेक्ट के पैरामीटर बदलें',
    zh: '更改 {count} 个对象的参数',
  },
} satisfies Record<string, Row>;

type Dict = { [K in keyof typeof UX9]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(UX9).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const UX9_ES = pick('es');
export const UX9_EN = pick('en');
export const UX9_DE = pick('de');
export const UX9_FR = pick('fr');
export const UX9_HI = pick('hi');
export const UX9_ZH = pick('zh');
