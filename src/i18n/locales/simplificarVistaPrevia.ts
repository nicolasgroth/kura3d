/**
 * @file src/i18n/locales/simplificarVistaPrevia.ts
 * @description Textos de Simplificar con vista previa, versión segura aplicada en lugar de lo pedido y túneles
 * finos cerrados, en los 6 idiomas. Cada clave se escribe una vez con sus 6 idiomas; `SIMPLIFICAR_VP_<IDIOMA>` se
 * mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const SIMPLIFICAR_VP = {
  'simplify.warn.fine_holes_closed': {
    es: 'Se {count?cerró|cerraron} {count} {count?agujero muy fino|agujeros muy finos} ({before} → {after}): la superficie se movió solo {mm} mm, menos de lo que una impresora resuelve.',
    en: '{count} very thin {count?hole|holes} closed ({before} → {after}): the surface moved only {mm} mm, less than a printer can resolve.',
    de: '{count} sehr {count?feines Loch|feine Löcher} geschlossen ({before} → {after}): Die Oberfläche hat sich nur um {mm} mm verschoben, weniger als ein Drucker auflöst.',
    fr: '{count} {count?trou très fin fermé|trous très fins fermés} ({before} → {after}) : la surface n’a bougé que de {mm} mm, moins que ce qu’une imprimante résout.',
    hi: '{count} बहुत पतले छेद बंद हुए ({before} → {after}): सतह केवल {mm} mm खिसकी, जितना प्रिंटर बना सकता है उससे कम।',
    zh: '封闭了 {count} 个极细的孔（{before} → {after}）：表面仅移动 {mm} mm，小于打印机能分辨的尺寸。',
  },
  'simplify.safeApplied.notice': {
    es: 'Se aplicó la versión segura: {safe} triángulos en vez de {requested}, porque {requested} cambiaba demasiado la forma: {reasons}',
    en: 'The safe version was applied: {safe} triangles instead of {requested}, because {requested} changed the shape too much: {reasons}',
    de: 'Die sichere Version wurde angewendet: {safe} Dreiecke statt {requested}, weil {requested} die Form zu stark verändert hätte: {reasons}',
    fr: 'La version sûre a été appliquée : {safe} triangles au lieu de {requested}, car {requested} changeait trop la forme : {reasons}',
    hi: 'सुरक्षित संस्करण लागू किया गया: {requested} की जगह {safe} त्रिकोण, क्योंकि {requested} आकार को बहुत बदल देता: {reasons}',
    zh: '已应用安全版本：{safe} 个三角形而不是 {requested} 个，因为 {requested} 会过度改变形状：{reasons}',
  },
  'simplify.safeApplied.forceHint': {
    es: '«Aplicar de todos modos» reemplaza este resultado por lo pedido en un solo paso de deshacer.',
    en: '“Apply anyway” replaces this result with what you asked for, in a single undo step.',
    de: '„Trotzdem anwenden“ ersetzt dieses Ergebnis in einem einzigen Rückgängig-Schritt durch das Angeforderte.',
    fr: '« Appliquer quand même » remplace ce résultat par ce qui a été demandé, en une seule étape d’annulation.',
    hi: '«फिर भी लागू करें» इस नतीजे को माँगे गए नतीजे से एक ही पूर्ववत चरण में बदल देता है।',
    zh: '“仍然应用”会以一次撤销步骤将此结果替换为所请求的结果。',
  },
  'simplify.preview.btn': {
    es: 'Vista previa',
    en: 'Preview',
    de: 'Vorschau',
    fr: 'Aperçu',
    hi: 'पूर्वावलोकन',
    zh: '预览',
  },
  'simplify.preview.btnHint': {
    es: 'Calcula el informe sin cambiar la pieza ni el historial. Si después simplificas con los mismos parámetros, se usa este cálculo.',
    en: 'Computes the report without changing the part or the history. If you then simplify with the same settings, this result is reused.',
    de: 'Berechnet den Bericht, ohne das Teil oder den Verlauf zu ändern. Vereinfachst du danach mit denselben Einstellungen, wird dieses Ergebnis verwendet.',
    fr: 'Calcule le rapport sans modifier la pièce ni l’historique. Si tu simplifies ensuite avec les mêmes réglages, ce calcul est réutilisé.',
    hi: 'पुर्ज़े या इतिहास को बदले बिना रिपोर्ट बनाता है। फिर उन्हीं सेटिंग्स से सरल करने पर यही गणना काम आती है।',
    zh: '在不改变零件和历史记录的情况下计算报告。之后若用相同设置简化，将复用此结果。',
  },
  'simplify.preview.computing': {
    es: 'Calculando la vista previa…',
    en: 'Computing the preview…',
    de: 'Vorschau wird berechnet…',
    fr: 'Calcul de l’aperçu…',
    hi: 'पूर्वावलोकन की गणना हो रही है…',
    zh: '正在计算预览…',
  },
  'simplify.preview.cancel': {
    es: 'Cancelar',
    en: 'Cancel',
    de: 'Abbrechen',
    fr: 'Annuler',
    hi: 'रद्द करें',
    zh: '取消',
  },
  'simplify.preview.title': {
    es: 'Vista previa (aún no se aplicó)',
    en: 'Preview (not applied yet)',
    de: 'Vorschau (noch nicht angewendet)',
    fr: 'Aperçu (pas encore appliqué)',
    hi: 'पूर्वावलोकन (अभी लागू नहीं हुआ)',
    zh: '预览（尚未应用）',
  },
  'simplify.preview.wouldApply': {
    es: 'Al pulsar «Simplificar» se aplicaría este resultado.',
    en: 'Pressing “Simplify” would apply this result.',
    de: 'Mit „Vereinfachen“ würde dieses Ergebnis angewendet.',
    fr: 'En appuyant sur « Simplifier », ce résultat serait appliqué.',
    hi: '«सरल करें» दबाने पर यह नतीजा लागू होगा।',
    zh: '点击“简化”将应用此结果。',
  },
  'simplify.preview.wouldSafe': {
    es: 'Al pulsar «Simplificar» se aplicaría la versión segura: {safe} triángulos en vez de {requested}, porque {requested} cambiaba demasiado la forma: {reasons}',
    en: 'Pressing “Simplify” would apply the safe version: {safe} triangles instead of {requested}, because {requested} changed the shape too much: {reasons}',
    de: 'Mit „Vereinfachen“ würde die sichere Version angewendet: {safe} Dreiecke statt {requested}, weil {requested} die Form zu stark verändert hätte: {reasons}',
    fr: 'En appuyant sur « Simplifier », la version sûre serait appliquée : {safe} triangles au lieu de {requested}, car {requested} changeait trop la forme : {reasons}',
    hi: '«सरल करें» दबाने पर सुरक्षित संस्करण लागू होगा: {requested} की जगह {safe} त्रिकोण, क्योंकि {requested} आकार को बहुत बदल देता: {reasons}',
    zh: '点击“简化”将应用安全版本：{safe} 个三角形而不是 {requested} 个，因为 {requested} 会过度改变形状：{reasons}',
  },
  'simplify.preview.wouldBlock': {
    es: 'Al pulsar «Simplificar» no se aplicaría nada:',
    en: 'Pressing “Simplify” would apply nothing:',
    de: 'Mit „Vereinfachen“ würde nichts angewendet:',
    fr: 'En appuyant sur « Simplifier », rien ne serait appliqué :',
    hi: '«सरल करें» दबाने पर कुछ भी लागू नहीं होगा:',
    zh: '点击“简化”将不会应用任何更改：',
  },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof SIMPLIFICAR_VP]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(SIMPLIFICAR_VP).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const SIMPLIFICAR_VP_ES = pick('es');
export const SIMPLIFICAR_VP_EN = pick('en');
export const SIMPLIFICAR_VP_DE = pick('de');
export const SIMPLIFICAR_VP_FR = pick('fr');
export const SIMPLIFICAR_VP_HI = pick('hi');
export const SIMPLIFICAR_VP_ZH = pick('zh');
