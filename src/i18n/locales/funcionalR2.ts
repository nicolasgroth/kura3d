/**
 * @file src/i18n/locales/funcionalR2.ts
 * @description Textos del lote funcional del 25-nov (ronda 2): Simplificar que no aplica resultados destructivos
 * (motivos, alternativa segura y «Aplicar de todos modos») en los 6 idiomas. Cada clave se escribe una vez con sus
 * 6 idiomas; `FUNCIONAL_R2_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
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
    es: 'la superficie se mueve {mm} mm (tope {limit} mm: un cuarto del lado menor de la pieza, {side} mm).',
    en: 'the surface moves {mm} mm (limit {limit} mm: a quarter of the part’s smallest side, {side} mm).',
    de: 'die Oberfläche verschiebt sich um {mm} mm (Grenze {limit} mm: ein Viertel der kleinsten Seite des Teils, {side} mm).',
    fr: 'la surface se déplace de {mm} mm (limite {limit} mm : un quart du plus petit côté de la pièce, {side} mm).',
    hi: 'सतह {mm} mm खिसकती है (सीमा {limit} mm: पुर्ज़े की सबसे छोटी भुजा {side} mm का चौथाई)।',
    zh: '表面移动 {mm} mm（上限 {limit} mm：零件最短边 {side} mm 的四分之一）。',
  },
  'simplify.blocked.too_few_triangles': {
    es: 'quedan {tris} triángulos, menos que el mínimo de {min} para una pieza con {holes} agujeros pasantes.',
    en: '{tris} triangles remain, fewer than the minimum of {min} for a part with {holes} through holes.',
    de: 'es bleiben {tris} Dreiecke, weniger als das Minimum von {min} für ein Teil mit {holes} Durchgangslöchern.',
    fr: 'il reste {tris} triangles, moins que le minimum de {min} pour une pièce avec {holes} trous traversants.',
    hi: '{tris} त्रिकोण बचते हैं, {holes} आर-पार छेद वाले पुर्ज़े के न्यूनतम {min} से कम।',
    zh: '只剩 {tris} 个三角形，少于有 {holes} 个通孔的零件所需的最少 {min} 个。',
  },
  'simplify.report.notice': {
    es: 'Se aplicó lo pedido, con aviso: la forma cambia de manera visible.',
    en: 'The request was applied, with a warning: the shape changes visibly.',
    de: 'Die Anforderung wurde angewendet, mit Hinweis: Die Form ändert sich sichtbar.',
    fr: 'La demande a été appliquée, avec avertissement : la forme change visiblement.',
    hi: 'माँगा गया लागू हुआ, चेतावनी के साथ: आकार साफ़ दिखने लायक बदलता है।',
    zh: '已按要求应用，但有提示：形状有明显变化。',
  },
  'simplify.preview.wouldNotice': {
    es: 'Se aplicaría lo pedido, con aviso: la forma cambia de manera visible.',
    en: 'The request would be applied, with a warning: the shape changes visibly.',
    de: 'Die Anforderung würde angewendet, mit Hinweis: Die Form ändert sich sichtbar.',
    fr: 'La demande serait appliquée, avec avertissement : la forme change visiblement.',
    hi: 'माँगा गया लागू होगा, चेतावनी के साथ: आकार साफ़ दिखने लायक बदलता है।',
    zh: '将按要求应用，但有提示：形状有明显变化。',
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
    es: 'No hay una reducción segura para esta pieza: ninguna versión que la conserve baja al menos {pct} % los triángulos.',
    en: 'There is no safe reduction for this part: no version that keeps it removes at least {pct} % of the triangles.',
    de: 'Für dieses Teil gibt es keine sichere Reduktion: Keine Version, die es erhält, entfernt mindestens {pct} % der Dreiecke.',
    fr: 'Il n’y a pas de réduction sûre pour cette pièce : aucune version qui la conserve ne retire au moins {pct} % des triangles.',
    hi: 'इस पुर्ज़े के लिए कोई सुरक्षित कमी नहीं है: इसे बचाए रखने वाला कोई संस्करण कम से कम {pct} % त्रिकोण नहीं घटाता।',
    zh: '此零件没有安全的简化方式：没有任何能保留零件的版本能减少至少 {pct} % 的三角形。',
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
  'keyhole.error.notRetained': {
    es: 'El ojo no se colocó: en esa cara no queda labio que sujete la cabeza del tornillo (se saldría). Usa una cara más grande o un tornillo menor.',
    en: 'The keyhole was not placed: that face leaves no lip to hold the screw head (it would slip out). Use a larger face or a smaller screw.',
    de: 'Das Schlüsselloch wurde nicht gesetzt: Auf dieser Fläche bleibt keine Lippe, die den Schraubenkopf hält (er würde herausrutschen). Nutze eine größere Fläche oder eine kleinere Schraube.',
    fr: 'Le trou n’a pas été placé : cette face ne laisse aucune lèvre pour retenir la tête de vis (elle sortirait). Utilise une face plus grande ou une vis plus petite.',
    hi: 'कीहोल नहीं लगाया गया: उस फलक पर स्क्रू के सिर को थामने वाला किनारा नहीं बचता (सिर निकल जाएगा)। बड़ा फलक या छोटा स्क्रू चुनें।',
    zh: '未放置钥匙孔：该面没有留下能卡住螺丝头的唇边（螺丝头会滑出）。请使用更大的面或更小的螺丝。',
  },
  'engineWarning.SPLIT_FRAGMENTS_DISCARDED': {
    es: 'Se descartaron {count} fragmentos diminutos del corte ({volume} mm³ en total): no se pueden imprimir ni pegar y no se entregan como pieza.',
    en: '{count} tiny cut fragments were discarded ({volume} mm³ in total): they cannot be printed or glued and are not delivered as pieces.',
    de: '{count} winzige Schnittfragmente wurden verworfen (insgesamt {volume} mm³): Sie lassen sich weder drucken noch kleben und werden nicht als Teile geliefert.',
    fr: '{count} fragments minuscules de la découpe ont été écartés ({volume} mm³ au total) : impossibles à imprimer ou à coller, ils ne sont pas livrés comme pièces.',
    hi: 'कट के {count} बहुत छोटे टुकड़े हटा दिए गए (कुल {volume} mm³): इन्हें न छापा जा सकता है न चिपकाया, इसलिए ये भाग के रूप में नहीं दिए जाते।',
    zh: '已丢弃 {count} 个切割产生的微小碎块（共 {volume} mm³）：无法打印或粘接，不作为零件交付。',
  },
  'smooth.blocked.toast': {
    es: 'Suavizar no se aplicó: el volumen cambiaría {pct} % (tope {limit} %). La malla es muy gruesa: refínala antes, o usa «Aplicar de todos modos».',
    en: 'Smooth was not applied: the volume would change {pct} % (limit {limit} %). The mesh is very coarse: refine it first, or use “Apply anyway”.',
    de: 'Glätten wurde nicht angewendet: Das Volumen würde sich um {pct} % ändern (Grenze {limit} %). Das Netz ist sehr grob: Verfeinere es zuerst oder nutze „Trotzdem anwenden“.',
    fr: 'Lisser n’a pas été appliqué : le volume changerait de {pct} % (limite {limit} %). Le maillage est très grossier : affine-le d’abord, ou utilise « Appliquer quand même ».',
    hi: 'स्मूद लागू नहीं हुआ: आयतन {pct} % बदल जाता (सीमा {limit} %)। मेश बहुत मोटा है: पहले इसे परिष्कृत करें, या «फिर भी लागू करें» चुनें।',
    zh: '平滑未应用：体积会变化 {pct} %（上限 {limit} %）。网格太粗：请先细化，或使用“仍然应用”。',
  },
  'smooth.blocked.status': {
    es: 'No se aplicó: el volumen cambiaría {pct} % (tope {limit} %). Con tan pocos triángulos el suavizado encoge la pieza; refina la malla antes para conservar la forma.',
    en: 'Not applied: the volume would change {pct} % (limit {limit} %). With so few triangles smoothing shrinks the part; refine the mesh first to keep the shape.',
    de: 'Nicht angewendet: Das Volumen würde sich um {pct} % ändern (Grenze {limit} %). Mit so wenigen Dreiecken schrumpft das Glätten das Teil; verfeinere das Netz zuerst, um die Form zu erhalten.',
    fr: 'Non appliqué : le volume changerait de {pct} % (limite {limit} %). Avec si peu de triangles, le lissage rétrécit la pièce ; affine d’abord le maillage pour garder la forme.',
    hi: 'लागू नहीं हुआ: आयतन {pct} % बदल जाता (सीमा {limit} %)। इतने कम त्रिकोणों में स्मूद करने से पुर्ज़ा सिकुड़ता है; आकार बचाने के लिए पहले मेश परिष्कृत करें।',
    zh: '未应用：体积会变化 {pct} %（上限 {limit} %）。三角形这么少时平滑会使零件缩小；请先细化网格以保持形状。',
  },
  'orient.error.candidateNotFound': {
    es: 'No hay una orientación con id "{id}". Disponibles: {available}.',
    en: 'No orientation candidate with id "{id}". Available: {available}.',
    de: 'Keine Ausrichtung mit der ID "{id}". Verfügbar: {available}.',
    fr: 'Aucune orientation avec l’id "{id}". Disponibles : {available}.',
    hi: '"{id}" id वाला कोई अभिविन्यास नहीं है। उपलब्ध: {available}।',
    zh: '没有 id 为 "{id}" 的朝向。可用：{available}。',
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
