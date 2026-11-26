/**
 * @file src/i18n/locales/simplificar.ts
 * @description Textos de Simplificar con verificación (modos «Sin pérdida», «Por tolerancia» y «Por cantidad»,
 * informe antes → después y avisos tipados) en los 6 idiomas. Cada clave se escribe una vez con sus 6 idiomas;
 * `SIMPLIFICAR_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const SIMPLIFICAR = {
  'simplify.mode': { es: 'Modo de simplificar', en: 'Simplify mode', de: 'Vereinfachungsmodus', fr: 'Mode de simplification', hi: 'सरल करने का मोड', zh: '简化模式' },
  'simplify.mode.lossless': { es: 'Sin pérdida', en: 'Lossless', de: 'Verlustfrei', fr: 'Sans perte', hi: 'बिना नुकसान', zh: '无损' },
  'simplify.mode.tolerance': { es: 'Por tolerancia', en: 'By tolerance', de: 'Nach Toleranz', fr: 'Par tolérance', hi: 'सहनशीलता से', zh: '按公差' },
  'simplify.mode.target': { es: 'Por cantidad', en: 'By count', de: 'Nach Anzahl', fr: 'Par nombre', hi: 'संख्या से', zh: '按数量' },
  'simplify.mode.lossless.help': {
    es: 'Quita solo los triángulos que sobran y lo aplica únicamente si la forma, el volumen y los agujeros no cambian.',
    en: 'Removes only redundant triangles and applies it only if the shape, volume and holes stay the same.',
    de: 'Entfernt nur überflüssige Dreiecke und wendet es nur an, wenn Form, Volumen und Löcher gleich bleiben.',
    fr: 'Retire seulement les triangles en trop et ne l’applique que si la forme, le volume et les trous restent identiques.',
    hi: 'सिर्फ़ फ़ालतू त्रिकोण हटाता है और तभी लागू करता है जब आकार, आयतन और छेद न बदलें।',
    zh: '只去掉多余的三角形，并且只有在形状、体积和孔都不变时才应用。',
  },
  'simplify.mode.tolerance.help': {
    es: 'Cuánto puede moverse la superficie: más alta, menos triángulos y más pérdida de forma.',
    en: 'How far the surface may move: higher means fewer triangles and more shape loss.',
    de: 'Wie weit sich die Oberfläche bewegen darf: höher heißt weniger Dreiecke und mehr Formverlust.',
    fr: 'De combien la surface peut bouger : plus haut, moins de triangles et plus de perte de forme.',
    hi: 'सतह कितनी खिसक सकती है: ज़्यादा होने पर कम त्रिकोण और आकार का ज़्यादा नुकसान।',
    zh: '表面允许移动的距离：越高，三角形越少，形状损失越大。',
  },
  'simplify.mode.target.help': {
    es: 'Busca la tolerancia que deja la pieza en la cantidad pedida; si no llega, entrega lo logrado.',
    en: 'Finds the tolerance that leaves the part at the requested count; if it cannot, it delivers what it reached.',
    de: 'Sucht die Toleranz, die das Teil auf die gewünschte Anzahl bringt; gelingt das nicht, liefert es das Erreichte.',
    fr: 'Cherche la tolérance qui laisse la pièce au nombre demandé ; sinon, livre ce qui a été atteint.',
    hi: 'वह सहनशीलता ढूँढता है जो पुर्ज़े को माँगी गई संख्या पर लाए; न पहुँचे तो जितना हुआ उतना देता है।',
    zh: '寻找能使零件达到所需数量的公差；如果达不到，就交付已达到的结果。',
  },
  'simplify.target.kind': { es: 'Objetivo', en: 'Target', de: 'Ziel', fr: 'Objectif', hi: 'लक्ष्य', zh: '目标' },
  'simplify.target.kind.count': { es: 'Triángulos', en: 'Triangles', de: 'Dreiecke', fr: 'Triangles', hi: 'त्रिकोण', zh: '三角形' },
  'simplify.target.kind.percent': { es: 'Porcentaje', en: 'Percentage', de: 'Prozent', fr: 'Pourcentage', hi: 'प्रतिशत', zh: '百分比' },
  'simplify.target.count': { es: 'Triángulos finales', en: 'Final triangles', de: 'Dreiecke am Ende', fr: 'Triangles finaux', hi: 'अंतिम त्रिकोण', zh: '最终三角形数' },
  'simplify.target.percent': { es: 'Conservar (%)', en: 'Keep (%)', de: 'Behalten (%)', fr: 'Conserver (%)', hi: 'रखें (%)', zh: '保留 (%)' },
  'simplify.current': { es: 'Ahora: {tris} triángulos', en: 'Now: {tris} triangles', de: 'Jetzt: {tris} Dreiecke', fr: 'Actuellement : {tris} triangles', hi: 'अभी: {tris} त्रिकोण', zh: '当前：{tris} 个三角形' },
  'simplify.report.title': { es: 'Último resultado', en: 'Last result', de: 'Letztes Ergebnis', fr: 'Dernier résultat', hi: 'पिछला परिणाम', zh: '上次结果' },
  'simplify.report.triangles': { es: 'Triángulos: {before} → {after}', en: 'Triangles: {before} → {after}', de: 'Dreiecke: {before} → {after}', fr: 'Triangles : {before} → {after}', hi: 'त्रिकोण: {before} → {after}', zh: '三角形：{before} → {after}' },
  'simplify.report.volume': { es: 'Volumen: {pct} %', en: 'Volume: {pct} %', de: 'Volumen: {pct} %', fr: 'Volume : {pct} %', hi: 'आयतन: {pct} %', zh: '体积：{pct} %' },
  'simplify.report.genus': { es: 'Agujeros pasantes: {before} → {after}', en: 'Through holes: {before} → {after}', de: 'Durchgangslöcher: {before} → {after}', fr: 'Trous traversants : {before} → {after}', hi: 'आर-पार छेद: {before} → {after}', zh: '通孔：{before} → {after}' },
  'simplify.report.deviation': { es: 'Desviación medida: {mm} mm', en: 'Measured deviation: {mm} mm', de: 'Gemessene Abweichung: {mm} mm', fr: 'Écart mesuré : {mm} mm', hi: 'मापा गया विचलन: {mm} mm', zh: '实测偏差：{mm} mm' },
  'simplify.report.tolerance': { es: 'Tolerancia usada: {mm} mm', en: 'Tolerance used: {mm} mm', de: 'Verwendete Toleranz: {mm} mm', fr: 'Tolérance utilisée : {mm} mm', hi: 'प्रयुक्त सहनशीलता: {mm} mm', zh: '所用公差：{mm} mm' },
  'simplify.report.notApplied': { es: 'No se aplicó: el objeto quedó intacto.', en: 'Not applied: the object was left untouched.', de: 'Nicht angewendet: Das Objekt blieb unverändert.', fr: 'Non appliqué : l’objet est resté intact.', hi: 'लागू नहीं हुआ: ऑब्जेक्ट जैसा था वैसा है।', zh: '未应用：对象保持不变。' },
  'simplify.warn.genus_changed': { es: 'Cambió la cantidad de agujeros pasantes ({before} → {after}).', en: 'The number of through holes changed ({before} → {after}).', de: 'Die Zahl der Durchgangslöcher hat sich geändert ({before} → {after}).', fr: 'Le nombre de trous traversants a changé ({before} → {after}).', hi: 'आर-पार छेदों की संख्या बदली ({before} → {after})।', zh: '通孔数量发生了变化（{before} → {after}）。' },
  'simplify.warn.volume_changed': { es: 'El volumen cambió {pct} % (se avisa desde {limit} %).', en: 'The volume changed {pct} % (warning from {limit} %).', de: 'Das Volumen änderte sich um {pct} % (Hinweis ab {limit} %).', fr: 'Le volume a changé de {pct} % (avertissement dès {limit} %).', hi: 'आयतन {pct} % बदला (चेतावनी {limit} % से)।', zh: '体积变化了 {pct} %（超过 {limit} % 即提示）。' },
  'simplify.warn.deviation_high': { es: 'La superficie se movió hasta {mm} mm (se avisa desde {limit} mm).', en: 'The surface moved up to {mm} mm (warning from {limit} mm).', de: 'Die Oberfläche bewegte sich bis zu {mm} mm (Hinweis ab {limit} mm).', fr: 'La surface a bougé jusqu’à {mm} mm (avertissement dès {limit} mm).', hi: 'सतह {mm} mm तक खिसकी (चेतावनी {limit} mm से)।', zh: '表面最多移动了 {mm} mm（超过 {limit} mm 即提示）。' },
  'simplify.warn.target_not_reached': { es: 'No se llegó a {target} triángulos: quedó en {after}.', en: 'Could not reach {target} triangles: it ended at {after}.', de: '{target} Dreiecke wurden nicht erreicht: Ergebnis {after}.', fr: '{target} triangles non atteints : résultat {after}.', hi: '{target} त्रिकोण तक नहीं पहुँचा: {after} पर रुका।', zh: '未达到 {target} 个三角形：最终为 {after}。' },
  'simplify.warn.no_reduction': { es: 'No había triángulos que quitar.', en: 'There were no triangles to remove.', de: 'Es gab keine Dreiecke zu entfernen.', fr: 'Il n’y avait aucun triangle à retirer.', hi: 'हटाने को कोई त्रिकोण नहीं था।', zh: '没有可去掉的三角形。' },
  'simplify.toast.marginal': {
    es: 'Casi sin reducción: {before} → {tris} triángulos (menos de 1 %). Prueba el modo Por tolerancia o Por cantidad.',
    en: 'Barely reduced: {before} → {tris} triangles (less than 1%). Try the By tolerance or By count mode.',
    de: 'Kaum reduziert: {before} → {tris} Dreiecke (weniger als 1 %). Versuche den Modus Nach Toleranz oder Nach Anzahl.',
    fr: 'Réduction quasi nulle : {before} → {tris} triangles (moins de 1 %). Essaie le mode Par tolérance ou Par nombre.',
    hi: 'लगभग कोई कमी नहीं: {before} → {tris} त्रिभुज (1% से कम)। सहनशीलता से या संख्या से मोड आज़माएँ।',
    zh: '几乎未简化：{before} → {tris} 个三角面（不到 1%）。请尝试“按公差”或“按数量”模式。',
  },
  'simplify.progress.reduce': { es: 'Reduciendo la malla', en: 'Reducing the mesh', de: 'Netz wird reduziert', fr: 'Réduction du maillage', hi: 'मेश घटाई जा रही है', zh: '正在简化网格' },
  'simplify.progress.verify': { es: 'Verificando el resultado', en: 'Checking the result', de: 'Ergebnis wird geprüft', fr: 'Vérification du résultat', hi: 'परिणाम जाँचा जा रहा है', zh: '正在检查结果' },
  'simplify.progress.attempt': { es: 'Ajustando al objetivo: intento {done} de {total}', en: 'Fitting the target: attempt {done} of {total}', de: 'Anpassung ans Ziel: Versuch {done} von {total}', fr: 'Ajustement à l’objectif : essai {done} sur {total}', hi: 'लक्ष्य के अनुसार समायोजन: प्रयास {done}/{total}', zh: '正在逼近目标：第 {done}/{total} 次尝试' },
  'simplify.progress.slow': { es: 'En modelos de más de 1 millón de triángulos puede tardar varios minutos.', en: 'On models with more than 1 million triangles it can take several minutes.', de: 'Bei Modellen mit mehr als 1 Million Dreiecken kann es mehrere Minuten dauern.', fr: 'Sur les modèles de plus d’1 million de triangles, cela peut prendre plusieurs minutes.', hi: '10 लाख से अधिक त्रिभुज वाले मॉडल में कई मिनट लग सकते हैं।', zh: '超过 100 万个三角面的模型可能需要几分钟。' },
  'simplify.toast.noChange': { es: 'No se pudo reducir: la malla sigue con {tris} triángulos.', en: 'Could not reduce: the mesh still has {tris} triangles.', de: 'Keine Reduktion möglich: Das Netz hat weiter {tris} Dreiecke.', fr: 'Réduction impossible : le maillage garde {tris} triangles.', hi: 'घटाया नहीं जा सका: मेश में अब भी {tris} त्रिकोण हैं।', zh: '无法减少：网格仍有 {tris} 个三角形。' },
  'simplify.toast.losslessRejected': { es: 'Sin pérdida no se aplicó: {reasons}', en: 'Lossless was not applied: {reasons}', de: 'Verlustfrei wurde nicht angewendet: {reasons}', fr: 'Sans perte n’a pas été appliqué : {reasons}', hi: 'बिना नुकसान लागू नहीं हुआ: {reasons}', zh: '无损未应用：{reasons}' },
  'simplify.toast.check': { es: 'Revisa el resultado: {reasons}', en: 'Check the result: {reasons}', de: 'Prüfe das Ergebnis: {reasons}', fr: 'Vérifiez le résultat : {reasons}', hi: 'परिणाम जाँचें: {reasons}', zh: '请检查结果：{reasons}' },
  'simplify.entry': { es: 'Simplificar…', en: 'Simplify…', de: 'Vereinfachen…', fr: 'Simplifier…', hi: 'सरल करें…', zh: '简化…' },
  'simplify.entry.tip': { es: 'Abre el panel para reducir los triángulos de esta pieza', en: 'Opens the panel to reduce this part’s triangles', de: 'Öffnet das Panel, um die Dreiecke dieses Teils zu reduzieren', fr: 'Ouvre le panneau pour réduire les triangles de cette pièce', hi: 'इस भाग के त्रिकोण घटाने के लिए पैनल खोलता है', zh: '打开面板以减少此零件的三角形' },
  'simplify.section.simplify': { es: 'Simplificar', en: 'Simplify', de: 'Vereinfachen', fr: 'Simplifier', hi: 'सरल करें', zh: '简化' },
  'simplify.section.refine': { es: 'Refinar malla', en: 'Refine mesh', de: 'Netz verfeinern', fr: 'Affiner le maillage', hi: 'मेश परिष्कृत करें', zh: '细化网格' },
  'simplify.section.hull': { es: 'Envolvente convexa', en: 'Convex hull', de: 'Konvexe Hülle', fr: 'Enveloppe convexe', hi: 'उत्तल आवरण', zh: '凸包' },
  'simplify.report.toleranceHelp': {
    es: 'La tolerancia es el límite que se le pide al algoritmo; la desviación es lo que realmente se midió.',
    en: 'The tolerance is the limit given to the algorithm; the deviation is what was actually measured.',
    de: 'Die Toleranz ist die dem Algorithmus vorgegebene Grenze; die Abweichung ist der tatsächlich gemessene Wert.',
    fr: 'La tolérance est la limite demandée à l’algorithme ; l’écart est ce qui a réellement été mesuré.',
    hi: 'सहनशीलता एल्गोरिद्म को दी गई सीमा है; विचलन वह है जो वास्तव में मापा गया।',
    zh: '公差是给算法设定的上限；偏差是实际测得的值。',
  },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof SIMPLIFICAR]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(SIMPLIFICAR).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const SIMPLIFICAR_ES = pick('es');
export const SIMPLIFICAR_EN = pick('en');
export const SIMPLIFICAR_DE = pick('de');
export const SIMPLIFICAR_FR = pick('fr');
export const SIMPLIFICAR_HI = pick('hi');
export const SIMPLIFICAR_ZH = pick('zh');
