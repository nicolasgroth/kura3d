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
