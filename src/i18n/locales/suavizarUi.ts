/**
 * @file src/i18n/locales/suavizarUi.ts
 * @description Textos de la interfaz de «Suavizar malla» (acción del menú, panel derecho, controles con su
 * ayuda, vista previa, resultado, avisos y sugerencia de aristas) en los 6 idiomas. Cada clave se escribe
 * una vez con sus 6 idiomas; `SUAVIZAR_UI_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const SUAVIZAR_UI = {
  'rediseno.action.smooth': { es: 'Suavizar…', en: 'Smooth…', de: 'Glätten…', fr: 'Lisser…', hi: 'स्मूद करें…', zh: '平滑…' },
  'panel.title.smooth': { es: 'Suavizar malla', en: 'Smooth mesh', de: 'Netz glätten', fr: 'Lisser le maillage', hi: 'मेश स्मूद करें', zh: '平滑网格' },
  'smooth.intro': {
    es: 'Quita el facetado y el ruido moviendo vértices, sin cambiar la cantidad de triángulos.',
    en: 'Removes faceting and noise by moving vertices, without changing the triangle count.',
    de: 'Entfernt Facetten und Rauschen durch Verschieben von Eckpunkten, ohne die Dreieckszahl zu ändern.',
    fr: 'Supprime les facettes et le bruit en déplaçant les sommets, sans changer le nombre de triangles.',
    hi: 'शीर्षों को हिलाकर फ़ैसेट और शोर हटाता है; त्रिकोणों की संख्या नहीं बदलती।',
    zh: '通过移动顶点去除棱面和噪点，不改变三角形数量。',
  },
  'smooth.intensity': { es: 'Intensidad', en: 'Intensity', de: 'Intensität', fr: 'Intensité', hi: 'तीव्रता', zh: '强度' },
  'smooth.intensity.help': {
    es: 'Cuánto se alisa en cada pasada: más alta, más lisa queda la superficie.',
    en: 'How much each pass smooths: higher means a smoother surface.',
    de: 'Wie stark jeder Durchgang glättet: höher heißt glattere Oberfläche.',
    fr: 'Force du lissage à chaque passe : plus elle est haute, plus la surface est lisse.',
    hi: 'हर पास में कितना स्मूद होता है: जितनी ज़्यादा, सतह उतनी चिकनी।',
    zh: '每一遍平滑的力度：越高表面越光滑。',
  },
  'smooth.intensity.slider': { es: 'Intensidad (deslizador)', en: 'Intensity (slider)', de: 'Intensität (Regler)', fr: 'Intensité (curseur)', hi: 'तीव्रता (स्लाइडर)', zh: '强度（滑块）' },
  'smooth.passes': { es: 'Pasadas', en: 'Passes', de: 'Durchgänge', fr: 'Passes', hi: 'पास', zh: '遍数' },
  'smooth.passes.help': {
    es: 'Cuántas veces se repite el alisado: más pasadas quitan más facetas.',
    en: 'How many times smoothing repeats: more passes remove more facets.',
    de: 'Wie oft das Glätten wiederholt wird: mehr Durchgänge entfernen mehr Facetten.',
    fr: 'Combien de fois le lissage se répète : plus de passes suppriment plus de facettes.',
    hi: 'स्मूदिंग कितनी बार दोहराई जाती है: ज़्यादा पास, ज़्यादा फ़ैसेट हटते हैं।',
    zh: '平滑重复的次数：遍数越多，去除的棱面越多。',
  },
  'smooth.keepEdges': { es: 'Conservar aristas vivas', en: 'Keep sharp edges', de: 'Scharfe Kanten erhalten', fr: 'Conserver les arêtes vives', hi: 'तीखे किनारे बनाए रखें', zh: '保留锐边' },
  'smooth.keepEdges.help': {
    es: 'Las esquinas y chaflanes marcados no se mueven, así la pieza no se redondea.',
    en: 'Marked corners and chamfers do not move, so the part is not rounded off.',
    de: 'Markierte Ecken und Fasen bewegen sich nicht, das Teil wird nicht abgerundet.',
    fr: 'Les coins et chanfreins repérés ne bougent pas : la pièce ne s’arrondit pas.',
    hi: 'चिह्नित कोने और चैम्फर नहीं हिलते, इसलिए पुर्ज़ा गोल नहीं होता।',
    zh: '已识别的拐角和倒角不会移动，零件不会被磨圆。',
  },
  'smooth.angle': { es: 'Ángulo de arista viva', en: 'Sharp-edge angle', de: 'Winkel scharfer Kanten', fr: 'Angle d’arête vive', hi: 'तीखे किनारे का कोण', zh: '锐边角度' },
  'smooth.angle.help': {
    es: 'Una arista que dobla más que este ángulo es «viva» y se protege; súbelo para proteger menos.',
    en: 'An edge that bends more than this angle counts as sharp and is protected; raise it to protect less.',
    de: 'Eine Kante, die stärker knickt als dieser Winkel, gilt als scharf und wird geschützt; höher schützt weniger.',
    fr: 'Une arête qui plie plus que cet angle est vive et protégée ; montez-le pour protéger moins.',
    hi: 'इस कोण से ज़्यादा मुड़ने वाला किनारा तीखा माना जाकर सुरक्षित होता है; कम सुरक्षा के लिए इसे बढ़ाएँ।',
    zh: '弯折超过此角度的边视为锐边并受保护；调高则保护更少。',
  },
  'smooth.where': { es: 'Dónde', en: 'Where', de: 'Wo', fr: 'Où', hi: 'कहाँ', zh: '范围' },
  'smooth.where.all': { es: 'Toda la pieza', en: 'The whole part', de: 'Ganzes Teil', fr: 'Toute la pièce', hi: 'पूरा पुर्ज़ा', zh: '整个零件' },
  'smooth.where.color': { es: 'Solo la zona pintada de un color', en: 'Only the area painted one color', de: 'Nur der in einer Farbe bemalte Bereich', fr: 'Seulement la zone peinte d’une couleur', hi: 'केवल एक रंग से रंगा क्षेत्र', zh: '仅某一颜色的涂色区域' },
  'smooth.where.help': {
    es: 'Para limitar el alisado a una zona, píntala antes con la herramienta de pintura.',
    en: 'To limit smoothing to an area, paint it first with the paint tool.',
    de: 'Um das Glätten auf einen Bereich zu beschränken, male ihn zuerst mit dem Malwerkzeug an.',
    fr: 'Pour limiter le lissage à une zone, peignez-la d’abord avec l’outil de peinture.',
    hi: 'स्मूदिंग को किसी क्षेत्र तक सीमित करने के लिए पहले उसे पेंट टूल से रंगें।',
    zh: '若要把平滑限制在某个区域，请先用涂色工具给它上色。',
  },
  'smooth.where.noPaint': {
    es: 'Esta pieza no tiene pintura: pinta una zona primero para poder limitar el alisado.',
    en: 'This part has no paint: paint an area first to limit smoothing.',
    de: 'Dieses Teil hat keine Bemalung: Male zuerst einen Bereich an, um das Glätten zu beschränken.',
    fr: 'Cette pièce n’a pas de peinture : peignez d’abord une zone pour limiter le lissage.',
    hi: 'इस पुर्ज़े पर रंग नहीं है: स्मूदिंग सीमित करने के लिए पहले कोई क्षेत्र रंगें।',
    zh: '此零件没有涂色：请先涂出一个区域，才能限制平滑范围。',
  },
  'smooth.color': { es: 'Color de la zona', en: 'Zone color', de: 'Farbe des Bereichs', fr: 'Couleur de la zone', hi: 'क्षेत्र का रंग', zh: '区域颜色' },
  'smooth.color.option': { es: '{name} ({count} triángulos)', en: '{name} ({count} triangles)', de: '{name} ({count} Dreiecke)', fr: '{name} ({count} triangles)', hi: '{name} ({count} त्रिकोण)', zh: '{name}（{count} 个三角形）' },
  'smooth.transition': { es: 'Transición', en: 'Transition', de: 'Übergang', fr: 'Transition', hi: 'संक्रमण', zh: '过渡' },
  'smooth.transition.help': {
    es: 'Anillos de triángulos donde el efecto se atenúa hasta cero, para que no quede un escalón en el borde de la zona.',
    en: 'Rings of triangles where the effect fades to zero, so the zone edge leaves no step.',
    de: 'Dreiecksringe, in denen der Effekt auf null abklingt, damit am Rand des Bereichs keine Stufe entsteht.',
    fr: 'Anneaux de triangles où l’effet s’atténue jusqu’à zéro, pour ne pas laisser de marche au bord de la zone.',
    hi: 'त्रिकोणों के छल्ले जहाँ प्रभाव शून्य तक घटता है, ताकि क्षेत्र के किनारे पर सीढ़ी न बने।',
    zh: '效果逐渐衰减到零的三角形环，使区域边缘不留台阶。',
  },
  'smooth.transition.unit': { es: 'anillos', en: 'rings', de: 'Ringe', fr: 'anneaux', hi: 'छल्ले', zh: '环' },
  'smooth.preview': { es: 'Vista previa', en: 'Preview', de: 'Vorschau', fr: 'Aperçu', hi: 'पूर्वावलोकन', zh: '预览' },
  'smooth.preview.tip': {
    es: 'Calcula el resultado y lo muestra sobre la pieza sin aplicarlo (Enter en un campo hace lo mismo).',
    en: 'Computes the result and shows it over the part without applying it (Enter in a field does the same).',
    de: 'Berechnet das Ergebnis und zeigt es über dem Teil, ohne es anzuwenden (Enter in einem Feld tut dasselbe).',
    fr: 'Calcule le résultat et l’affiche sur la pièce sans l’appliquer (Entrée dans un champ fait pareil).',
    hi: 'नतीजा निकालकर पुर्ज़े पर दिखाता है, लागू किए बिना (किसी फ़ील्ड में Enter भी यही करता है)।',
    zh: '计算结果并叠加显示在零件上，但不应用（在字段中按 Enter 效果相同）。',
  },
  'smooth.cancel': { es: 'Cancelar', en: 'Cancel', de: 'Abbrechen', fr: 'Annuler', hi: 'रद्द करें', zh: '取消' },
  'smooth.cancel.tip': { es: 'Detiene el cálculo y descarta la vista previa.', en: 'Stops the computation and discards the preview.', de: 'Beendet die Berechnung und verwirft die Vorschau.', fr: 'Arrête le calcul et abandonne l’aperçu.', hi: 'गणना रोकता है और पूर्वावलोकन हटाता है।', zh: '停止计算并丢弃预览。' },
  'smooth.apply': { es: 'Aplicar', en: 'Apply', de: 'Anwenden', fr: 'Appliquer', hi: 'लागू करें', zh: '应用' },
  'smooth.apply.tip': {
    es: 'Suaviza la pieza en un solo paso de deshacer; usa la vista previa si no cambiaste nada.',
    en: 'Smooths the part in a single undo step; reuses the preview if nothing changed.',
    de: 'Glättet das Teil in einem einzigen Rückgängig-Schritt; nutzt die Vorschau, wenn sich nichts geändert hat.',
    fr: 'Lisse la pièce en une seule étape d’annulation ; réutilise l’aperçu si rien n’a changé.',
    hi: 'पुर्ज़े को एक ही अनडू चरण में स्मूद करता है; कुछ न बदला हो तो पूर्वावलोकन का उपयोग करता है।',
    zh: '用一步撤销完成平滑；若未改动参数则直接使用预览结果。',
  },
  'smooth.compare': { es: 'Ocultar la vista previa', en: 'Hide the preview', de: 'Vorschau ausblenden', fr: 'Masquer l’aperçu', hi: 'पूर्वावलोकन छिपाएँ', zh: '隐藏预览' },
  'smooth.compare.help': {
    es: 'Activado, oculta el resultado para ver solo la pieza original.',
    en: 'When on, hides the result so you see only the original part.',
    de: 'Eingeschaltet blendet es das Ergebnis aus, sodass nur das Original zu sehen ist.',
    fr: 'Activé, il masque le résultat pour ne voir que la pièce d’origine.',
    hi: 'चालू होने पर नतीजा छिप जाता है और केवल मूल पुर्ज़ा दिखता है।',
    zh: '开启后隐藏结果，只显示原始零件。',
  },
  'smooth.progress.pass': { es: 'Suavizando: pasada {i} de {n}', en: 'Smoothing: pass {i} of {n}', de: 'Glätten: Durchgang {i} von {n}', fr: 'Lissage : passe {i} sur {n}', hi: 'स्मूद हो रहा है: पास {i}/{n}', zh: '平滑中：第 {i}/{n} 遍' },
  'smooth.progress.check': { es: 'Comprobando que la malla no se dañe…', en: 'Checking the mesh is not damaged…', de: 'Prüfe, ob das Netz nicht beschädigt wird…', fr: 'Vérification que le maillage n’est pas endommagé…', hi: 'जाँच रहे हैं कि मेश खराब न हो…', zh: '正在检查网格是否受损…' },
  'smooth.progress.start': { es: 'Preparando el suavizado…', en: 'Preparing the smoothing…', de: 'Glätten wird vorbereitet…', fr: 'Préparation du lissage…', hi: 'स्मूदिंग की तैयारी…', zh: '正在准备平滑…' },
  'smooth.status.ready': { es: 'Vista previa lista: el volumen cambiaría {pct} %.', en: 'Preview ready: the volume would change {pct} %.', de: 'Vorschau bereit: Das Volumen würde sich um {pct} % ändern.', fr: 'Aperçu prêt : le volume changerait de {pct} %.', hi: 'पूर्वावलोकन तैयार: आयतन {pct} % बदलेगा।', zh: '预览已就绪：体积将变化 {pct} %。' },
  'smooth.status.applied': { es: 'Suavizado aplicado: el volumen cambió {pct} %.', en: 'Smoothing applied: the volume changed {pct} %.', de: 'Glätten angewendet: Das Volumen änderte sich um {pct} %.', fr: 'Lissage appliqué : le volume a changé de {pct} %.', hi: 'स्मूदिंग लागू: आयतन {pct} % बदला।', zh: '已应用平滑：体积变化了 {pct} %。' },
  'smooth.status.noEffect': { es: 'Con estos valores no se mueve ningún vértice: baja la protección de aristas o amplía la zona.', en: 'With these values no vertex moves: lower the edge protection or widen the zone.', de: 'Mit diesen Werten bewegt sich kein Eckpunkt: Senke den Kantenschutz oder erweitere den Bereich.', fr: 'Avec ces valeurs aucun sommet ne bouge : réduisez la protection des arêtes ou élargissez la zone.', hi: 'इन मानों से कोई शीर्ष नहीं हिलता: किनारों की सुरक्षा घटाएँ या क्षेत्र बढ़ाएँ।', zh: '按这些参数没有顶点会移动：请降低边缘保护或扩大区域。' },
  'smooth.result.reduced': { es: 'Se redujo la intensidad de {requested} % a {applied} % para no dañar la malla.', en: 'Intensity was lowered from {requested} % to {applied} % to avoid damaging the mesh.', de: 'Die Intensität wurde von {requested} % auf {applied} % gesenkt, um das Netz nicht zu beschädigen.', fr: 'L’intensité a été réduite de {requested} % à {applied} % pour ne pas endommager le maillage.', hi: 'मेश को खराब होने से बचाने के लिए तीव्रता {requested} % से घटाकर {applied} % की गई।', zh: '为避免损坏网格，强度已从 {requested} % 降到 {applied} %。' },
  'smooth.result.volume': { es: 'El volumen cambió más de {limit} %: revisa que la pieza conserve sus medidas.', en: 'The volume changed by more than {limit} %: check the part keeps its dimensions.', de: 'Das Volumen änderte sich um mehr als {limit} %: Prüfe, ob das Teil seine Maße behält.', fr: 'Le volume a changé de plus de {limit} % : vérifiez que la pièce garde ses dimensions.', hi: 'आयतन {limit} % से ज़्यादा बदला: जाँचें कि पुर्ज़े की माप बनी रहे।', zh: '体积变化超过 {limit} %：请检查零件尺寸是否仍符合要求。' },
  'smooth.result.protectedVertices': { es: '{count} de {total} puntos quedaron sin suavizar para no dañar la malla ({pct} % suavizado).', en: '{count} of {total} points were left unsmoothed to avoid damaging the mesh ({pct} % smoothed).', de: '{count} von {total} Punkten blieben ungeglättet, um das Netz nicht zu beschädigen ({pct} % geglättet).', fr: '{count} points sur {total} n’ont pas été lissés pour ne pas endommager le maillage ({pct} % lissé).', hi: 'मेश को खराब होने से बचाने के लिए {total} में से {count} बिंदु स्मूद नहीं किए गए ({pct} % स्मूद)।', zh: '为避免损坏网格，{total} 个点中有 {count} 个未平滑（已平滑 {pct} %）。' },
  'smooth.error.damage': { es: 'No se pudo suavizar sin dañar la malla: baja la intensidad o protege las aristas.', en: 'The mesh could not be smoothed without damaging it: lower the intensity or protect the edges.', de: 'Das Netz ließ sich nicht ohne Beschädigung glätten: Senke die Intensität oder schütze die Kanten.', fr: 'Le maillage n’a pas pu être lissé sans l’endommager : baissez l’intensité ou protégez les arêtes.', hi: 'मेश को खराब किए बिना स्मूद नहीं किया जा सका: तीव्रता घटाएँ या किनारों को सुरक्षित करें।', zh: '无法在不损坏网格的情况下平滑：请降低强度或保护锐边。' },
  'smooth.error.damageEdgesOn': { es: 'No se pudo suavizar sin dañar la malla: baja la intensidad o las pasadas, o limita la zona.', en: 'The mesh could not be smoothed without damaging it: lower the intensity or the passes, or limit the zone.', de: 'Das Netz ließ sich nicht ohne Beschädigung glätten: Senke die Intensität oder die Durchgänge oder begrenze den Bereich.', fr: 'Le maillage n’a pas pu être lissé sans l’endommager : baissez l’intensité ou les passes, ou limitez la zone.', hi: 'मेश को खराब किए बिना स्मूद नहीं किया जा सका: तीव्रता या पास घटाएँ, या क्षेत्र सीमित करें।', zh: '无法在不损坏网格的情况下平滑：请降低强度或遍数，或限制区域。' },
  'smooth.suggest.edges': { es: 'La protección de aristas está frenando el suavizado: sube el ángulo o desactívala.', en: 'Edge protection is holding the smoothing back: raise the angle or turn it off.', de: 'Der Kantenschutz bremst das Glätten: Erhöhe den Winkel oder schalte ihn aus.', fr: 'La protection des arêtes freine le lissage : augmentez l’angle ou désactivez-la.', hi: 'किनारों की सुरक्षा स्मूदिंग को रोक रही है: कोण बढ़ाएँ या इसे बंद करें।', zh: '边缘保护正在妨碍平滑：请调高角度或将其关闭。' },
  'smooth.suggest.raise': { es: 'Subir el ángulo a {angle}°', en: 'Raise the angle to {angle}°', de: 'Winkel auf {angle}° erhöhen', fr: 'Monter l’angle à {angle}°', hi: 'कोण {angle}° करें', zh: '将角度调到 {angle}°' },
  'smooth.suggest.off': { es: 'Desactivar la protección', en: 'Turn protection off', de: 'Schutz ausschalten', fr: 'Désactiver la protection', hi: 'सुरक्षा बंद करें', zh: '关闭保护' },
  'smooth.suggest.fix.tip': { es: 'Aplica el cambio y vuelve a calcular la vista previa.', en: 'Applies the change and recomputes the preview.', de: 'Übernimmt die Änderung und berechnet die Vorschau neu.', fr: 'Applique le changement et recalcule l’aperçu.', hi: 'बदलाव लागू करता है और पूर्वावलोकन फिर से निकालता है।', zh: '应用更改并重新计算预览。' },
  'smooth.toast.done': { es: 'Suavizado aplicado: el volumen cambió {pct} %.', en: 'Smoothing applied: the volume changed {pct} %.', de: 'Glätten angewendet: Das Volumen änderte sich um {pct} %.', fr: 'Lissage appliqué : le volume a changé de {pct} %.', hi: 'स्मूदिंग लागू: आयतन {pct} % बदला।', zh: '已应用平滑：体积变化了 {pct} %。' },
  'smooth.reason.noMesh': { es: 'La pieza no tiene malla que suavizar.', en: 'The part has no mesh to smooth.', de: 'Das Teil hat kein Netz zum Glätten.', fr: 'La pièce n’a pas de maillage à lisser.', hi: 'पुर्ज़े में स्मूद करने के लिए मेश नहीं है।', zh: '该零件没有可平滑的网格。' },
  'smooth.panel.region': { es: 'Opciones de suavizado', en: 'Smoothing options', de: 'Glättungsoptionen', fr: 'Options de lissage', hi: 'स्मूदिंग विकल्प', zh: '平滑选项' },
  'smooth.invalid': { es: 'Corrige los campos marcados antes de calcular.', en: 'Fix the marked fields before computing.', de: 'Korrigiere die markierten Felder vor dem Berechnen.', fr: 'Corrigez les champs marqués avant de calculer.', hi: 'गणना से पहले चिह्नित फ़ील्ड ठीक करें।', zh: '计算前请先修正标出的字段。' },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof SUAVIZAR_UI]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(SUAVIZAR_UI).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const SUAVIZAR_UI_ES = pick('es');
export const SUAVIZAR_UI_EN = pick('en');
export const SUAVIZAR_UI_DE = pick('de');
export const SUAVIZAR_UI_FR = pick('fr');
export const SUAVIZAR_UI_HI = pick('hi');
export const SUAVIZAR_UI_ZH = pick('zh');
