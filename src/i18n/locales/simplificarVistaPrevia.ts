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
  'simplify.ghost.compare': {
    es: 'Comparar con el original',
    en: 'Compare with the original',
    de: 'Mit dem Original vergleichen',
    fr: 'Comparer avec l’original',
    hi: 'मूल से तुलना करें',
    zh: '与原件对比',
  },
  'simplify.ghost.compare.help': {
    es: 'En el visor, el fantasma celeste es la malla que quedaría. Con el casillero marcado se oculta el fantasma y se ve solo la pieza original; sin marcar, se ve el fantasma.',
    en: 'In the viewport, the cyan ghost is the mesh you would get. When ticked, the ghost is hidden and only the original part shows; when unticked, the ghost is shown.',
    de: 'Im Viewport ist der cyanfarbene Geist das entstehende Netz. Aktiviert ist der Geist ausgeblendet und nur das Originalteil sichtbar; deaktiviert wird der Geist angezeigt.',
    fr: 'Dans la vue 3D, le fantôme cyan est le maillage obtenu. Coché, le fantôme est masqué et seule la pièce d’origine est visible ; décoché, le fantôme s’affiche.',
    hi: 'व्यूपोर्ट में आसमानी भूत वह मेश है जो बनेगी। चुनने पर भूत छिप जाता है और केवल मूल पुर्ज़ा दिखता है; न चुनने पर भूत दिखता है।',
    zh: '在视口中，青色虚影是将得到的网格。勾选时隐藏虚影，只显示原始零件；取消勾选则显示虚影。',
  },
  'simplify.ghost.edges': {
    es: 'Mostrar las aristas de la simplificada',
    en: 'Show the edges of the simplified mesh',
    de: 'Kanten des vereinfachten Netzes anzeigen',
    fr: 'Afficher les arêtes du maillage simplifié',
    hi: 'सरल की गई मेश के किनारे दिखाएँ',
    zh: '显示简化后网格的边',
  },
  'simplify.ghost.edges.help': {
    es: 'Dibuja la red de triángulos de la malla simplificada sobre la pieza. En una malla densa el sólido casi no cambia a la vista; las aristas sí muestran la diferencia.',
    en: 'Draws the triangle network of the simplified mesh over the part. On a dense mesh the solid barely looks different; the edges show the change.',
    de: 'Zeichnet das Dreiecksnetz des vereinfachten Netzes über das Teil. Bei einem dichten Netz sieht der Körper kaum anders aus; die Kanten zeigen den Unterschied.',
    fr: 'Dessine le réseau de triangles du maillage simplifié sur la pièce. Sur un maillage dense, le solide change à peine à l’œil ; les arêtes montrent la différence.',
    hi: 'सरल की गई मेश का त्रिभुज जाल पुर्ज़े पर बनाता है। घनी मेश में ठोस रूप लगभग नहीं बदलता; किनारे अंतर दिखाते हैं।',
    zh: '在零件上绘制简化后网格的三角形网络。对于密集网格，实体外观几乎不变；边线能显示差异。',
  },
  'simplify.ghost.edges.light': {
    es: 'El resultado tiene {tris} triángulos: se dibuja solo el sólido, sin aristas.',
    en: 'The result has {tris} triangles: only the solid is drawn, without edges.',
    de: 'Das Ergebnis hat {tris} Dreiecke: Es wird nur der Körper ohne Kanten gezeichnet.',
    fr: 'Le résultat compte {tris} triangles : seul le solide est dessiné, sans arêtes.',
    hi: 'परिणाम में {tris} त्रिभुज हैं: केवल ठोस रूप बनता है, किनारे नहीं।',
    zh: '结果有 {tris} 个三角形：仅绘制实体，不绘制边线。',
  },
  'simplify.ghost.heavy': {
    es: 'El resultado tiene {tris} triángulos: se muestra solo el informe.',
    en: 'The result has {tris} triangles: only the report is shown.',
    de: 'Das Ergebnis hat {tris} Dreiecke: Es wird nur der Bericht angezeigt.',
    fr: 'Le résultat compte {tris} triangles : seul le rapport est affiché.',
    hi: 'परिणाम में {tris} त्रिभुज हैं: केवल रिपोर्ट दिखाई जाती है।',
    zh: '结果有 {tris} 个三角形：仅显示报告。',
  },
  'simplify.ghost.none': {
    es: 'No hay una malla nueva que mostrar en el visor.',
    en: 'There is no new mesh to show in the viewport.',
    de: 'Es gibt kein neues Netz, das im Viewport angezeigt werden könnte.',
    fr: 'Il n’y a aucun nouveau maillage à afficher dans la vue 3D.',
    hi: 'व्यूपोर्ट में दिखाने के लिए कोई नई मेश नहीं है।',
    zh: '视口中没有可显示的新网格。',
  },
  'simplify.ghost.variant.showSafe': {
    es: 'Ver la versión segura',
    en: 'View the safe version',
    de: 'Sichere Version ansehen',
    fr: 'Voir la version sûre',
    hi: 'सुरक्षित संस्करण देखें',
    zh: '查看安全版本',
  },
  'simplify.ghost.variant.showRequested': {
    es: 'Ver lo pedido',
    en: 'View what you asked for',
    de: 'Angefordertes ansehen',
    fr: 'Voir ce qui a été demandé',
    hi: 'माँगा गया नतीजा देखें',
    zh: '查看所请求的结果',
  },
  'simplify.ghost.variant.nowSafe': {
    es: 'En el visor: la versión segura, la que se aplicaría.',
    en: 'In the viewport: the safe version, the one that would be applied.',
    de: 'Im Viewport: die sichere Version, die angewendet würde.',
    fr: 'Dans la vue 3D : la version sûre, celle qui serait appliquée.',
    hi: 'व्यूपोर्ट में: सुरक्षित संस्करण, जो लागू होगा।',
    zh: '视口中：安全版本，即将被应用的版本。',
  },
  'simplify.ghost.variant.nowRequested': {
    es: 'En el visor: lo pedido, que no se aplicaría tal cual.',
    en: 'In the viewport: what you asked for, which would not be applied as is.',
    de: 'Im Viewport: das Angeforderte, das so nicht angewendet würde.',
    fr: 'Dans la vue 3D : ce qui a été demandé, qui ne serait pas appliqué tel quel.',
    hi: 'व्यूपोर्ट में: माँगा गया नतीजा, जो जस का तस लागू नहीं होगा।',
    zh: '视口中：所请求的结果，不会原样应用。',
  },
  'simplify.progress.safe': {
    es: 'Buscando la versión segura: paso {done} de {total}',
    en: 'Looking for the safe version: step {done} of {total}',
    de: 'Suche nach der sicheren Version: Schritt {done} von {total}',
    fr: 'Recherche de la version sûre : étape {done} sur {total}',
    hi: 'सुरक्षित संस्करण खोजा जा रहा है: चरण {done}/{total}',
    zh: '正在寻找安全版本：第 {done}/{total} 步',
  },
  'simplify.progress.bar': {
    es: 'Progreso del cálculo de la vista previa',
    en: 'Preview computation progress',
    de: 'Fortschritt der Vorschauberechnung',
    fr: 'Progression du calcul de l’aperçu',
    hi: 'पूर्वावलोकन गणना की प्रगति',
    zh: '预览计算进度',
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
