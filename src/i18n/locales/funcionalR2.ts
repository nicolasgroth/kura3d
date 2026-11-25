/**
 * @file src/i18n/locales/funcionalR2.ts
 * @description Textos del lote funcional del 25-nov (ronda 2): Simplificar que no aplica resultados destructivos
 * (motivos, alternativa segura y «Aplicar de todos modos») en los 6 idiomas. Cada clave se escribe una vez con sus
 * 6 idiomas; `FUNCIONAL_R2_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const FUNCIONAL_R2 = {
  'simplify.blocked.title': {
    es: 'No se aplicó porque el resultado estropea la pieza:',
    en: 'Not applied because the result would ruin the part:',
    de: 'Nicht angewendet, weil das Ergebnis das Teil verderben würde:',
    fr: 'Non appliqué, car le résultat abîmerait la pièce :',
    hi: 'लागू नहीं हुआ, क्योंकि नतीजा पुर्ज़े को बिगाड़ देगा:',
    zh: '未应用，因为结果会破坏零件：',
  },
  'simplify.blocked.holes_lost': {
    es: 'se cierran agujeros pasantes ({before} → {after}).',
    en: 'through holes close ({before} → {after}).',
    de: 'Durchgangslöcher schließen sich ({before} → {after}).',
    fr: 'des trous traversants se ferment ({before} → {after}).',
    hi: 'आर-पार छेद बंद हो जाते हैं ({before} → {after})।',
    zh: '通孔被封闭（{before} → {after}）。',
  },
  'simplify.blocked.volume_changed': {
    es: 'el volumen cambia {pct} % (tope {limit} %).',
    en: 'the volume changes {pct} % (limit {limit} %).',
    de: 'das Volumen ändert sich um {pct} % (Grenze {limit} %).',
    fr: 'le volume change de {pct} % (limite {limit} %).',
    hi: 'आयतन {pct} % बदलता है (सीमा {limit} %)।',
    zh: '体积变化 {pct} %（上限 {limit} %）。',
  },
  'simplify.blocked.deviation_high': {
    es: 'la superficie se mueve {mm} mm (tope {limit} mm para esta pieza).',
    en: 'the surface moves {mm} mm (limit {limit} mm for this part).',
    de: 'die Oberfläche verschiebt sich um {mm} mm (Grenze {limit} mm für dieses Teil).',
    fr: 'la surface se déplace de {mm} mm (limite {limit} mm pour cette pièce).',
    hi: 'सतह {mm} mm खिसकती है (इस पुर्ज़े की सीमा {limit} mm)।',
    zh: '表面移动 {mm} mm（此零件上限 {limit} mm）。',
  },
  'simplify.blocked.aggressive': {
    es: 'Resultado pedido: {tris} triángulos, volumen {pct} %, desviación {mm} mm.',
    en: 'Requested result: {tris} triangles, volume {pct} %, deviation {mm} mm.',
    de: 'Angefordertes Ergebnis: {tris} Dreiecke, Volumen {pct} %, Abweichung {mm} mm.',
    fr: 'Résultat demandé : {tris} triangles, volume {pct} %, écart {mm} mm.',
    hi: 'माँगा गया नतीजा: {tris} त्रिकोण, आयतन {pct} %, विचलन {mm} mm।',
    zh: '请求的结果：{tris} 个三角形，体积 {pct} %，偏差 {mm} mm。',
  },
  'simplify.blocked.safe': {
    es: 'Versión segura: {tris} triángulos, volumen {pct} %, desviación {mm} mm, agujeros {genus}.',
    en: 'Safe version: {tris} triangles, volume {pct} %, deviation {mm} mm, holes {genus}.',
    de: 'Sichere Version: {tris} Dreiecke, Volumen {pct} %, Abweichung {mm} mm, Löcher {genus}.',
    fr: 'Version sûre : {tris} triangles, volume {pct} %, écart {mm} mm, trous {genus}.',
    hi: 'सुरक्षित संस्करण: {tris} त्रिकोण, आयतन {pct} %, विचलन {mm} mm, छेद {genus}।',
    zh: '安全版本：{tris} 个三角形，体积 {pct} %，偏差 {mm} mm，孔 {genus}。',
  },
  'simplify.blocked.noSafe': {
    es: 'No se halló una versión más liviana que conserve la pieza.',
    en: 'No lighter version that keeps the part was found.',
    de: 'Es wurde keine leichtere Version gefunden, die das Teil erhält.',
    fr: 'Aucune version plus légère qui conserve la pièce n’a été trouvée.',
    hi: 'पुर्ज़े को बचाए रखने वाला कोई हल्का संस्करण नहीं मिला।',
    zh: '未找到能保留零件的更轻版本。',
  },
  'simplify.blocked.applySafe': {
    es: 'Aplicar la versión segura ({tris} triángulos)',
    en: 'Apply the safe version ({tris} triangles)',
    de: 'Sichere Version anwenden ({tris} Dreiecke)',
    fr: 'Appliquer la version sûre ({tris} triangles)',
    hi: 'सुरक्षित संस्करण लागू करें ({tris} त्रिकोण)',
    zh: '应用安全版本（{tris} 个三角形）',
  },
  'simplify.blocked.applyAnyway': {
    es: 'Aplicar de todos modos',
    en: 'Apply anyway',
    de: 'Trotzdem anwenden',
    fr: 'Appliquer quand même',
    hi: 'फिर भी लागू करें',
    zh: '仍然应用',
  },
  'simplify.toast.blocked': {
    es: 'Simplificar no se aplicó porque estropea la pieza: {reasons} El informe ofrece la versión segura.',
    en: 'Simplify was not applied because it ruins the part: {reasons} The report offers the safe version.',
    de: 'Vereinfachen wurde nicht angewendet, weil es das Teil verdirbt: {reasons} Der Bericht bietet die sichere Version an.',
    fr: 'Simplifier n’a pas été appliqué car il abîme la pièce : {reasons} Le rapport propose la version sûre.',
    hi: 'सरल करना लागू नहीं हुआ क्योंकि यह पुर्ज़े को बिगाड़ता है: {reasons} रिपोर्ट सुरक्षित संस्करण देती है।',
    zh: '简化未应用，因为它会破坏零件：{reasons} 报告中提供了安全版本。',
  },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof FUNCIONAL_R2]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(FUNCIONAL_R2).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const FUNCIONAL_R2_ES = pick('es');
export const FUNCIONAL_R2_EN = pick('en');
export const FUNCIONAL_R2_DE = pick('de');
export const FUNCIONAL_R2_FR = pick('fr');
export const FUNCIONAL_R2_HI = pick('hi');
export const FUNCIONAL_R2_ZH = pick('zh');
