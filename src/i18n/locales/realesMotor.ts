/**
 * @file src/i18n/locales/realesMotor.ts
 * @description Textos del lote de modelos reales (motor): escena restaurada desde un 3MF de la app,
 * aviso de unidades dudosas con su reescalado, malla abierta compartida por varias piezas y resultado
 * de simplificar (triángulos y volumen). Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const REALES_MOTOR_TABLE = {
  'realesMotor.sceneRestored': [
    'Escena restaurada tal como se exportó desde «{name}»: {count} objetos y {groups} grupos.',
    'Scene restored exactly as exported from “{name}”: {count} objects and {groups} groups.',
    'Szene genau wie aus „{name}“ exportiert wiederhergestellt: {count} Objekte und {groups} Gruppen.',
    'Scène restaurée telle qu’exportée depuis « {name} » : {count} objets et {groups} groupes.',
    '«{name}» से निर्यात की गई दृश्य जैसा था वैसा बहाल: {count} वस्तुएँ और {groups} समूह।',
    '已按「{name}」导出时的原样恢复场景:{count} 个对象、{groups} 个组。',
  ],
  'realesMotor.openMeshShared': [
    'La malla «{name}», usada en {count} piezas, está abierta ({edges} bordes sueltos).',
    'The mesh “{name}”, used in {count} parts, is open ({edges} loose edges).',
    'Das Netz „{name}“, verwendet in {count} Teilen, ist offen ({edges} lose Kanten).',
    'Le maillage « {name} », utilisé dans {count} pièces, est ouvert ({edges} arêtes libres).',
    'मेश «{name}», जो {count} भागों में उपयोग हुई है, खुली है ({edges} खुले किनारे)।',
    '网格「{name}」被 {count} 个零件使用,且未封闭({edges} 条开放边)。',
  ],
  'engineError.HOLLOW_INEFFECTIVE': [
    'El ahuecado no dejó una cavidad coherente con la pared de {thickness} mm (pared media medida {measured} mm, volumen quitado {removedPct} %), así que la pieza no se modificó. Suele pasar con mallas que se cruzan a sí mismas: prueba «Separar cuerpos» o «Reparar malla» y vuelve a ahuecar, o usa una pared mayor.',
    'Hollowing did not leave a cavity consistent with the {thickness} mm wall (measured mean wall {measured} mm, volume removed {removedPct} %), so the part was not changed. This usually happens with self-intersecting meshes: try “Separate bodies” or “Repair mesh” and hollow again, or use a thicker wall.',
    'Das Aushöhlen ergab keinen zur Wand von {thickness} mm passenden Hohlraum (gemessene mittlere Wand {measured} mm, entferntes Volumen {removedPct} %), daher wurde das Teil nicht verändert. Das passiert meist bei sich selbst schneidenden Netzen: versuche „Körper trennen“ oder „Netz reparieren“ und höhle erneut aus, oder nimm eine dickere Wand.',
    'L’évidement n’a pas laissé de cavité cohérente avec la paroi de {thickness} mm (paroi moyenne mesurée {measured} mm, volume retiré {removedPct} %) ; la pièce n’a donc pas été modifiée. Cela arrive surtout avec des maillages qui s’auto-intersectent : essayez « Séparer les corps » ou « Réparer le maillage » puis évidez à nouveau, ou utilisez une paroi plus épaisse.',
    'खोखला करने से {thickness} mm दीवार के अनुरूप गुहा नहीं बनी (मापी गई औसत दीवार {measured} mm, हटाया गया आयतन {removedPct} %), इसलिए भाग नहीं बदला गया। यह अक्सर ख़ुद को काटती मेश में होता है: «बॉडी अलग करें» या «मेश ठीक करें» आज़माएँ और फिर खोखला करें, या मोटी दीवार लें।',
    '抽壳未形成与 {thickness} mm 壁厚相符的空腔(实测平均壁厚 {measured} mm,去除体积 {removedPct} %),因此零件未被修改。这通常发生在自相交的网格上:请尝试「分离实体」或「修复网格」后再抽壳,或使用更厚的壁。',
  ],
  'engineWarning.HOLLOW_SELF_INTERSECTING': [
    'La malla se cruza a sí misma; la cavidad se calculó sobre la unión de lo que encierra. Revisa la sección antes de imprimir.',
    'The mesh intersects itself; the cavity was computed on the union of what it encloses. Check the section view before printing.',
    'Das Netz schneidet sich selbst; der Hohlraum wurde über die Vereinigung des Umschlossenen berechnet. Prüfe die Schnittansicht vor dem Druck.',
    'Le maillage s’auto-intersecte ; la cavité a été calculée sur l’union de ce qu’il enferme. Vérifiez la vue en coupe avant d’imprimer.',
    'मेश ख़ुद को काटती है; गुहा उसके घेरे हुए हिस्से के संघ पर गणना की गई। प्रिंट से पहले सेक्शन देखें।',
    '网格存在自相交;空腔按其包围区域的并集计算。打印前请检查剖面视图。',
  ],
  'realesMotor.repairAllDone': [
    'Mallas reparadas y cerradas: {closed} de {total} ({pieces} piezas).',
    'Meshes repaired and closed: {closed} of {total} ({pieces} parts).',
    'Netze repariert und geschlossen: {closed} von {total} ({pieces} Teile).',
    'Maillages réparés et fermés : {closed} sur {total} ({pieces} pièces).',
    'सुधारी और बंद की गई मेश: {total} में से {closed} ({pieces} भाग)।',
    '已修复并封闭的网格:{closed}/{total}({pieces} 个零件)。',
  ],
  'realesMotor.repairAllPartial': [
    'Mallas reparadas y cerradas: {closed} de {total} ({pieces} piezas). No se pudieron cerrar: {list}; revísalas en el inspector.',
    'Meshes repaired and closed: {closed} of {total} ({pieces} parts). Could not be closed: {list}; check them in the inspector.',
    'Netze repariert und geschlossen: {closed} von {total} ({pieces} Teile). Nicht schließbar: {list}; prüfe sie im Inspektor.',
    'Maillages réparés et fermés : {closed} sur {total} ({pieces} pièces). Impossible à fermer : {list} ; vérifiez-les dans l’inspecteur.',
    'सुधारी और बंद की गई मेश: {total} में से {closed} ({pieces} भाग)। बंद नहीं हो सकीं: {list}; इंस्पेक्टर में देखें।',
    '已修复并封闭的网格:{closed}/{total}({pieces} 个零件)。无法封闭:{list};请在检查器中查看。',
  ],
  'realesMotor.repairAll': ['Reparar todas', 'Repair all', 'Alle reparieren', 'Tout réparer', 'सभी सुधारें', '全部修复'],
  'realesMotor.unitDoubt': [
    '«{name}» mide {size} mm en su lado mayor: puede que el archivo esté en otra unidad.',
    '“{name}” measures {size} mm on its longest side: the file may use another unit.',
    '„{name}“ misst an der längsten Seite {size} mm: Die Datei nutzt vielleicht eine andere Einheit.',
    '« {name} » mesure {size} mm sur son plus grand côté : le fichier utilise peut-être une autre unité.',
    '«{name}» की सबसे लंबी भुजा {size} mm है: फ़ाइल शायद किसी और इकाई में है।',
    '「{name}」最长边为 {size} mm:文件可能使用了其他单位。',
  ],
  'realesMotor.unitScale': ['Escalar ×{factor}', 'Scale ×{factor}', 'Skalieren ×{factor}', 'Mettre à l’échelle ×{factor}', '×{factor} स्केल करें', '缩放 ×{factor}'],
  'realesMotor.unitFit': ['Ajustar a {mm} mm', 'Fit to {mm} mm', 'Auf {mm} mm anpassen', 'Ajuster à {mm} mm', '{mm} mm पर फ़िट करें', '调整为 {mm} mm'],
  'realesMotor.unitRescaled': [
    '«{name}» escalado ×{factor}: ahora mide {size} mm en su lado mayor.',
    '“{name}” scaled ×{factor}: its longest side is now {size} mm.',
    '„{name}“ ×{factor} skaliert: Die längste Seite misst jetzt {size} mm.',
    '« {name} » mis à l’échelle ×{factor} : son plus grand côté mesure maintenant {size} mm.',
    '«{name}» को ×{factor} स्केल किया: अब सबसे लंबी भुजा {size} mm है।',
    '「{name}」已缩放 ×{factor}:最长边现为 {size} mm。',
  ],
  'engineWarning.HOLLOW_SHELLS_MERGED': [
    'La malla traía {count} cáscaras que se solapan sin unir; se unieron antes de ahuecar para que la cavidad quede bien.',
    'The mesh had {count} overlapping shells that were not joined; they were merged before hollowing so the cavity comes out right.',
    'Das Netz hatte {count} sich überlappende, nicht verbundene Hüllen; sie wurden vor dem Aushöhlen vereinigt, damit der Hohlraum stimmt.',
    'Le maillage avait {count} coques qui se chevauchent sans être unies ; elles ont été fusionnées avant l’évidement pour que la cavité soit correcte.',
    'मेश में {count} ओवरलैप होती खोलें थीं जो जुड़ी नहीं थीं; खोखला करने से पहले उन्हें जोड़ा गया ताकि गुहा सही बने।',
    '网格中有 {count} 个相互重叠但未合并的外壳;已在抽壳前合并,以确保空腔正确。',
  ],
  'realesMotor.simplifyResult': [
    'Simplificado: {before} → {after} triángulos · volumen {delta} %.',
    'Simplified: {before} → {after} triangles · volume {delta} %.',
    'Vereinfacht: {before} → {after} Dreiecke · Volumen {delta} %.',
    'Simplifié : {before} → {after} triangles · volume {delta} %.',
    'सरल किया: {before} → {after} त्रिभुज · आयतन {delta} %।',
    '已简化:{before} → {after} 个三角形 · 体积 {delta} %。',
  ],
} as const satisfies Record<string, Row>;

type RealesMotorKey = keyof typeof REALES_MOTOR_TABLE;

const pick = (index: number): Record<RealesMotorKey, string> =>
  Object.fromEntries(Object.entries(REALES_MOTOR_TABLE).map(([key, row]) => [key, row[index]])) as Record<RealesMotorKey, string>;

export const REALESMOTOR_ES = pick(0);
export const REALESMOTOR_EN = pick(1);
export const REALESMOTOR_DE = pick(2);
export const REALESMOTOR_FR = pick(3);
export const REALESMOTOR_HI = pick(4);
export const REALESMOTOR_ZH = pick(5);
