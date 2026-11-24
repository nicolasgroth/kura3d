/**
 * @file src/i18n/locales/unionesFirmes.ts
 * @description Avisos de "uniones firmes" de Dividir para imprimir (profundidad del conector acortada
 * para dejar la pared mínima y unión débil para su sección), en los 6 idiomas. Se mezclan en cada
 * diccionario de `translations.ts` y `locales/*.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export const UNIONES_FIRMES_ES = {
  'engineWarning.SPLIT_CONNECTOR_DEPTH_REDUCED': 'En la unión {label} ({a}–{b}) el conector entra {depth} mm en vez de {requested} mm: más hondo no deja la pared mínima hacia el exterior.',
  'engineWarning.SPLIT_JOINT_WEAK': 'La unión {label} ({a}–{b}) queda débil para su sección: los conectores ({count}) cubren el {area} % del contacto. Pégala además o mueve el corte a una zona más ancha.',
};

export const UNIONES_FIRMES_EN = {
  'engineWarning.SPLIT_CONNECTOR_DEPTH_REDUCED': 'At joint {label} ({a}–{b}) the connector goes {depth} mm deep instead of {requested} mm: any deeper would not leave the minimum wall to the outside.',
  'engineWarning.SPLIT_JOINT_WEAK': 'Joint {label} ({a}–{b}) is weak for its section: its connectors ({count}) cover {area} % of the contact. Glue it as well or move the cut to a wider area.',
};

export const UNIONES_FIRMES_DE = {
  'engineWarning.SPLIT_CONNECTOR_DEPTH_REDUCED': 'An Verbindung {label} ({a}–{b}) greift der Verbinder {depth} mm statt {requested} mm tief: tiefer bliebe nicht die Mindestwand nach außen.',
  'engineWarning.SPLIT_JOINT_WEAK': 'Verbindung {label} ({a}–{b}) ist für ihren Querschnitt schwach: die Verbinder ({count}) decken {area} % der Kontaktfläche. Zusätzlich kleben oder den Schnitt in einen breiteren Bereich verschieben.',
};

export const UNIONES_FIRMES_FR = {
  'engineWarning.SPLIT_CONNECTOR_DEPTH_REDUCED': 'À la jonction {label} ({a}–{b}), le connecteur entre de {depth} mm au lieu de {requested} mm : plus profond, il ne resterait pas la paroi minimale vers l’extérieur.',
  'engineWarning.SPLIT_JOINT_WEAK': 'La jonction {label} ({a}–{b}) est faible pour sa section : les connecteurs ({count}) couvrent {area} % du contact. Collez-la aussi ou déplacez la coupe vers une zone plus large.',
};

export const UNIONES_FIRMES_HI = {
  'engineWarning.SPLIT_CONNECTOR_DEPTH_REDUCED': 'जोड़ {label} ({a}–{b}) पर कनेक्टर {requested} मिमी की जगह {depth} मिमी गहरा जाता है: इससे गहरा जाने पर बाहर की ओर न्यूनतम दीवार नहीं बचती।',
  'engineWarning.SPLIT_JOINT_WEAK': 'जोड़ {label} ({a}–{b}) अपने सेक्शन के लिए कमज़ोर है: {count} कनेक्टर संपर्क का {area} % ढकते हैं। इसे चिपकाएँ भी या कट को चौड़े हिस्से पर ले जाएँ।',
};

export const UNIONES_FIRMES_ZH = {
  'engineWarning.SPLIT_CONNECTOR_DEPTH_REDUCED': '接合 {label}（{a}–{b}）的连接件插入深度为 {depth} 毫米而非 {requested} 毫米：再深就无法向外保留最小壁厚。',
  'engineWarning.SPLIT_JOINT_WEAK': '接合 {label}（{a}–{b}）相对其截面偏弱：{count} 个连接件覆盖接触面的 {area}%。请额外粘合，或将切口移到更宽的位置。',
};
