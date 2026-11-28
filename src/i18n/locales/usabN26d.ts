/**
 * @file src/i18n/locales/usabN26d.ts
 * @description Textos de la ronda de usabilidad N26d: aviso corto de Simplificar, resumen del informe, qué muestra el
 * fantasma, estado mientras calcula, y el bloqueo por malla abierta con su botón «Reparar malla», en los 6 idiomas.
 * Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const USAB_N26D_TABLE = {
  'simplify.toast.short': [
    'Simplificado: {before} → {after} triángulos',
    'Simplified: {before} → {after} triangles',
    'Vereinfacht: {before} → {after} Dreiecke',
    'Simplifié : {before} → {after} triangles',
    'सरल किया गया: {before} → {after} त्रिभुज',
    '已简化：{before} → {after} 个三角形',
  ],
  'simplify.report.summary': [
    '{before} → {after} triángulos.',
    '{before} → {after} triangles.',
    '{before} → {after} Dreiecke.',
    '{before} → {after} triangles.',
    '{before} → {after} त्रिभुज।',
    '{before} → {after} 个三角形。',
  ],
  'simplify.report.summarySafe': [
    'Versión segura: {before} → {after} triángulos.',
    'Safe version: {before} → {after} triangles.',
    'Sichere Version: {before} → {after} Dreiecke.',
    'Version sûre : {before} → {after} triangles.',
    'सुरक्षित संस्करण: {before} → {after} त्रिभुज।',
    '安全版本：{before} → {after} 个三角形。',
  ],
  'simplify.preview.summary': [
    'Se pasaría de {before} a {after} triángulos.',
    'It would go from {before} to {after} triangles.',
    'Es ginge von {before} auf {after} Dreiecke.',
    'On passerait de {before} à {after} triangles.',
    '{before} से {after} त्रिभुज हो जाते।',
    '将从 {before} 个三角形变为 {after} 个。',
  ],
  'simplify.preview.summarySafe': [
    'Se aplicaría la versión segura: de {before} a {after} triángulos.',
    'The safe version would be applied: from {before} to {after} triangles.',
    'Die sichere Version würde angewendet: von {before} auf {after} Dreiecke.',
    'La version sûre serait appliquée : de {before} à {after} triangles.',
    'सुरक्षित संस्करण लागू होता: {before} से {after} त्रिभुज।',
    '将应用安全版本：从 {before} 个三角形变为 {after} 个。',
  ],
  'simplify.preview.ghostRequested': [
    'El fantasma del visor muestra lo pedido.',
    'The ghost in the viewport shows what you asked for.',
    'Der Geist im Ansichtsfenster zeigt das Gewünschte.',
    'Le fantôme de la vue 3D montre ce qui est demandé.',
    'व्यूपोर्ट का प्रेत वही दिखाता है जो आपने माँगा।',
    '视图中的虚影显示的是您所要求的结果。',
  ],
  'simplify.preview.ghostSafe': [
    'El fantasma del visor muestra la versión segura.',
    'The ghost in the viewport shows the safe version.',
    'Der Geist im Ansichtsfenster zeigt die sichere Version.',
    'Le fantôme de la vue 3D montre la version sûre.',
    'व्यूपोर्ट का प्रेत सुरक्षित संस्करण दिखाता है।',
    '视图中的虚影显示的是安全版本。',
  ],
  'simplify.applying': [
    'Simplificando… en mallas grandes puede tardar hasta un minuto.',
    'Simplifying… on large meshes this can take up to a minute.',
    'Wird vereinfacht… bei großen Netzen kann das bis zu einer Minute dauern.',
    'Simplification en cours… sur de grands maillages, cela peut prendre jusqu’à une minute.',
    'सरल किया जा रहा है… बड़े मेश पर एक मिनट तक लग सकता है।',
    '正在简化…网格很大时可能需要长达一分钟。',
  ],
  'simplify.error.meshInvalid': [
    'Esta pieza no es un sólido cerrado (tiene huecos o aristas sueltas): repárala antes de simplificar.',
    'This part is not a closed solid (it has gaps or loose edges): repair it before simplifying.',
    'Dieses Teil ist kein geschlossener Körper (es hat Lücken oder lose Kanten): Repariere es vor dem Vereinfachen.',
    'Cette pièce n’est pas un solide fermé (trous ou arêtes libres) : répare-la avant de simplifier.',
    'यह हिस्सा बंद ठोस नहीं है (इसमें खाली जगह या ढीले किनारे हैं): सरल करने से पहले इसे ठीक करें।',
    '该零件不是封闭实体（存在缺口或游离边）：请先修复再简化。',
  ],
  'simplify.error.repair': [
    'Reparar malla',
    'Repair mesh',
    'Netz reparieren',
    'Réparer le maillage',
    'मेश ठीक करें',
    '修复网格',
  ],
  'simplify.error.repairTip': [
    'Cierra huecos y arregla aristas sueltas de esta pieza; después podrás simplificarla',
    'Closes gaps and fixes loose edges of this part; then you can simplify it',
    'Schließt Lücken und behebt lose Kanten dieses Teils; danach kannst du es vereinfachen',
    'Ferme les trous et corrige les arêtes libres de cette pièce ; ensuite tu pourras la simplifier',
    'इस हिस्से के खाली स्थान भरता और ढीले किनारे ठीक करता है; फिर इसे सरल कर सकते हैं',
    '封闭该零件的缺口并修复游离边；之后即可简化',
  ],
  'simplify.error.technical': [
    'Detalle técnico',
    'Technical detail',
    'Technische Einzelheiten',
    'Détail technique',
    'तकनीकी विवरण',
    '技术细节',
  ],
  'simplify.warn.genus_changed.preview': [
    'Cambiaría la cantidad de agujeros pasantes ({before} → {after}).',
    'The number of through holes would change ({before} → {after}).',
    'Die Zahl der Durchgangslöcher würde sich ändern ({before} → {after}).',
    'Le nombre de trous traversants changerait ({before} → {after}).',
    'आर-पार छेदों की संख्या बदल जाएगी ({before} → {after})।',
    '通孔数量将会变化（{before} → {after}）。',
  ],
  'simplify.warn.volume_changed.preview': [
    'El volumen cambiaría {pct} % (se avisa desde {limit} %).',
    'The volume would change {pct} % (warning from {limit} %).',
    'Das Volumen würde sich um {pct} % ändern (Hinweis ab {limit} %).',
    'Le volume changerait de {pct} % (avertissement dès {limit} %).',
    'आयतन {pct} % बदल जाएगा (चेतावनी {limit} % से)।',
    '体积将变化 {pct} %（超过 {limit} % 即提示）。',
  ],
  'simplify.warn.deviation_high.preview': [
    'La superficie se movería hasta {mm} mm (se avisa desde {limit} mm).',
    'The surface would move up to {mm} mm (warning from {limit} mm).',
    'Die Oberfläche würde sich bis zu {mm} mm bewegen (Hinweis ab {limit} mm).',
    'La surface bougerait jusqu’à {mm} mm (avertissement dès {limit} mm).',
    'सतह {mm} mm तक खिसक जाएगी (चेतावनी {limit} mm से)।',
    '表面最多将移动 {mm} mm（超过 {limit} mm 即提示）。',
  ],
  'simplify.warn.target_not_reached.preview': [
    'No se llegaría a {target} triángulos: quedaría en {after}.',
    'It would not reach {target} triangles: it would end at {after}.',
    '{target} Dreiecke würden nicht erreicht: Ergebnis wäre {after}.',
    '{target} triangles ne seraient pas atteints : résultat {after}.',
    '{target} त्रिकोण तक नहीं पहुँचेगा: {after} पर रुकेगा।',
    '将达不到 {target} 个三角形：最终会是 {after}。',
  ],
  'simplify.warn.no_reduction.preview': [
    'No habría triángulos que quitar.',
    'There would be no triangles to remove.',
    'Es gäbe keine Dreiecke zu entfernen.',
    'Il n’y aurait aucun triangle à retirer.',
    'हटाने को कोई त्रिकोण नहीं होगा।',
    '没有可去掉的三角形。',
  ],
  'simplify.warn.fine_holes_closed.preview': [
    'Se {count?cerraría|cerrarían} {count} {count?agujero muy fino|agujeros muy finos} ({before} → {after}): la superficie se movería solo {mm} mm, menos de lo que una impresora resuelve.',
    '{count} very thin {count?hole|holes} would close ({before} → {after}): the surface would move only {mm} mm, less than a printer can resolve.',
    '{count} sehr {count?feines Loch würde|feine Löcher würden} geschlossen ({before} → {after}): Die Oberfläche würde sich nur um {mm} mm verschieben, weniger als ein Drucker auflöst.',
    '{count} {count?trou très fin serait fermé|trous très fins seraient fermés} ({before} → {after}) : la surface ne bougerait que de {mm} mm, moins que ce qu’une imprimante résout.',
    '{count} बहुत पतले छेद बंद हो जाएँगे ({before} → {after}): सतह केवल {mm} mm खिसकेगी, जितना प्रिंटर बना सकता है उससे कम।',
    '将封闭 {count} 个极细的孔（{before} → {after}）：表面仅会移动 {mm} mm，小于打印机能分辨的尺寸。',
  ],
  'simplify.preview.notApplied': [
    'No se aplicaría: el objeto quedaría intacto.',
    'It would not be applied: the object would stay untouched.',
    'Würde nicht angewendet: Das Objekt bliebe unverändert.',
    'Ne serait pas appliqué : l’objet resterait intact.',
    'लागू नहीं होगा: ऑब्जेक्ट जैसा है वैसा रहेगा।',
    '不会应用：对象将保持不变。',
  ],
  'simplify.report.appliedSafeHeading': [
    'Se aplicó (versión segura)',
    'Applied (safe version)',
    'Angewendet (sichere Version)',
    'Appliqué (version sûre)',
    'लागू किया गया (सुरक्षित संस्करण)',
    '已应用（安全版本）',
  ],
  'simplify.preview.appliedSafeHeading': [
    'Se aplicaría (versión segura)',
    'Would be applied (safe version)',
    'Würde angewendet (sichere Version)',
    'Serait appliqué (version sûre)',
    'लागू होगा (सुरक्षित संस्करण)',
    '将应用（安全版本）',
  ],
  'simplify.report.requestedHeading': [
    'Lo pedido daría…',
    'What you asked for would give…',
    'Das Gewünschte ergäbe …',
    'Ce qui était demandé donnerait…',
    'जो माँगा गया था उससे मिलेगा…',
    '所要求的设置将得到…',
  ],
  'simplify.report.safeWouldHeading': [
    'La versión segura daría…',
    'The safe version would give…',
    'Die sichere Version ergäbe …',
    'La version sûre donnerait…',
    'सुरक्षित संस्करण से मिलेगा…',
    '安全版本将得到…',
  ],
  'simplify.toast.shortSafe': [
    'Se aplicó la versión segura: {before} → {after} triángulos',
    'Safe version applied: {before} → {after} triangles',
    'Sichere Version angewendet: {before} → {after} Dreiecke',
    'Version sûre appliquée : {before} → {after} triangles',
    'सुरक्षित संस्करण लागू किया गया: {before} → {after} त्रिभुज',
    '已应用安全版本：{before} → {after} 个三角形',
  ],
  'simplify.progress.rung': [
    'Probando tolerancias: paso {done} de {total}',
    'Trying tolerances: step {done} of {total}',
    'Toleranzen werden probiert: Schritt {done} von {total}',
    'Essai des tolérances : étape {done} sur {total}',
    'सहनशीलताएँ आज़माई जा रही हैं: चरण {done}/{total}',
    '正在尝试公差：第 {done}/{total} 步',
  ],
  'simplify.error.repairing': [
    'Reparando la malla…',
    'Repairing the mesh…',
    'Netz wird repariert …',
    'Réparation du maillage…',
    'मेश की मरम्मत हो रही है…',
    '正在修复网格…',
  ],
  'simplify.invalid.hint': [
    'Corrige el valor marcado para poder continuar.',
    'Fix the highlighted value to continue.',
    'Korrigiere den markierten Wert, um fortzufahren.',
    'Corrige la valeur signalée pour continuer.',
    'जारी रखने के लिए चिह्नित मान ठीक करें।',
    '请先修正标出的数值再继续。',
  ],
} as const satisfies Record<string, Row>;

type UsabKey = keyof typeof USAB_N26D_TABLE;

const pick = (index: number): Record<UsabKey, string> =>
  Object.fromEntries(Object.entries(USAB_N26D_TABLE).map(([key, row]) => [key, (row as Row)[index]])) as Record<UsabKey, string>;

export const USAB_N26D_ES = pick(0);
export const USAB_N26D_EN = pick(1);
export const USAB_N26D_DE = pick(2);
export const USAB_N26D_FR = pick(3);
export const USAB_N26D_HI = pick(4);
export const USAB_N26D_ZH = pick(5);
