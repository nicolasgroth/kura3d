/**
 * @file src/i18n/locales/repair.ts
 * @description Textos de "Reparar malla" en los 6 idiomas: acción, resultado, diagnóstico del panel de
 * análisis y avisos y errores del motor relacionados (cierre de malla, agujeros que quedan, pared no
 * medida, ahuecado sin cavidad, división de modelos pesados). Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const REPAIR_TABLE = {
  'repair.action': ['Reparar malla', 'Repair mesh', 'Netz reparieren', 'Réparer le maillage', 'मेश ठीक करें', '修复网格'],
  'repair.actionTip': [
    'Cierra agujeros, quita caras duplicadas o degeneradas y orienta las normales para que la malla sea un sólido imprimible',
    'Closes holes, removes duplicate or degenerate faces and orients normals so the mesh becomes a printable solid',
    'Schließt Löcher, entfernt doppelte oder entartete Flächen und richtet Normalen aus, damit das Netz ein druckbarer Körper wird',
    'Ferme les trous, supprime les faces dupliquées ou dégénérées et oriente les normales pour obtenir un solide imprimable',
    'छेद बंद करता है, दोहरे या खराब फलक हटाता है और नॉर्मल सही करता है ताकि मेश प्रिंट योग्य ठोस बने',
    '封闭孔洞、删除重复或退化面并统一法线方向，使网格成为可打印的实体',
  ],
  'cmd.repairMesh': ['Reparar malla del objeto', 'Repair object mesh', 'Netz des Objekts reparieren', 'Réparer le maillage de l’objet', 'ऑब्जेक्ट का मेश ठीक करें', '修复对象网格'],
  'toast.repairDone': ['Malla reparada: {summary}', 'Mesh repaired: {summary}', 'Netz repariert: {summary}', 'Maillage réparé : {summary}', 'मेश ठीक हुआ: {summary}', '网格已修复：{summary}'],
  'toast.repairNothing': [
    'La malla ya era un sólido cerrado: no hubo nada que reparar.',
    'The mesh was already a closed solid: nothing to repair.',
    'Das Netz war bereits ein geschlossener Körper: nichts zu reparieren.',
    'Le maillage était déjà un solide fermé : rien à réparer.',
    'मेश पहले से बंद ठोस था: ठीक करने को कुछ नहीं।',
    '网格已是封闭实体：无需修复。',
  ],
  'repair.part.holes': ['{count} agujeros cerrados', '{count} holes closed', '{count} Löcher geschlossen', '{count} trous fermés', '{count} छेद बंद', '封闭 {count} 个孔'],
  'repair.part.faces': ['{count} caras duplicadas o degeneradas quitadas', '{count} duplicate or degenerate faces removed', '{count} doppelte oder entartete Flächen entfernt', '{count} faces dupliquées ou dégénérées supprimées', '{count} दोहरे या खराब फलक हटाए', '删除 {count} 个重复或退化面'],
  'repair.part.flipped': ['{count} caras reorientadas', '{count} faces reoriented', '{count} Flächen neu ausgerichtet', '{count} faces réorientées', '{count} फलक पलटे', '重新定向 {count} 个面'],
  'repair.part.nonManifold': ['{count} aristas con más de dos caras resueltas', '{count} edges with more than two faces resolved', '{count} Kanten mit mehr als zwei Flächen gelöst', '{count} arêtes à plus de deux faces résolues', 'दो से अधिक फलकों वाले {count} किनारे सुलझाए', '处理 {count} 条多于两面的边'],
  'repair.part.shells': ['{count} astillas quitadas', '{count} slivers removed', '{count} Splitter entfernt', '{count} éclats supprimés', '{count} छोटे टुकड़े हटाए', '删除 {count} 个碎片'],
  'repair.part.welded': ['vértices sueltos soldados', 'loose vertices welded', 'lose Eckpunkte verschweißt', 'sommets libres soudés', 'ढीले शीर्ष जोड़े', '焊接松散顶点'],
  'repair.diag.title': ['Malla', 'Mesh', 'Netz', 'Maillage', 'मेश', '网格'],
  'repair.diag.closed': ['Sólido cerrado', 'Closed solid', 'Geschlossener Körper', 'Solide fermé', 'बंद ठोस', '封闭实体'],
  'repair.diag.open': [
    '{edges} bordes abiertos en {holes} agujeros (el mayor de {sizeMm} mm), resaltados en el visor',
    '{edges} open edges in {holes} holes (largest {sizeMm} mm), highlighted in the viewport',
    '{edges} offene Kanten in {holes} Löchern (größtes {sizeMm} mm), im Ansichtsfenster markiert',
    '{edges} arêtes ouvertes dans {holes} trous (le plus grand {sizeMm} mm), surlignées dans la vue',
    '{holes} छेदों में {edges} खुले किनारे (सबसे बड़ा {sizeMm} mm), दृश्य में चिह्नित',
    '{holes} 个孔中有 {edges} 条开放边（最大 {sizeMm} mm），已在视图中高亮',
  ],
  'repair.diag.nonManifold': ['{count} aristas con más de dos caras', '{count} edges with more than two faces', '{count} Kanten mit mehr als zwei Flächen', '{count} arêtes à plus de deux faces', 'दो से अधिक फलकों वाले {count} किनारे', '{count} 条多于两面的边'],
  'repair.diag.faces': ['{count} caras duplicadas o degeneradas', '{count} duplicate or degenerate faces', '{count} doppelte oder entartete Flächen', '{count} faces dupliquées ou dégénérées', '{count} दोहरे या खराब फलक', '{count} 个重复或退化面'],
  'repair.diag.orientation': ['Normales incoherentes o invertidas', 'Inconsistent or inverted normals', 'Uneinheitliche oder umgekehrte Normalen', 'Normales incohérentes ou inversées', 'असंगत या उलटे नॉर्मल', '法线不一致或反向'],
  'repair.diag.tiny': ['{count} cuerpos sueltos diminutos', '{count} tiny loose bodies', '{count} winzige lose Körper', '{count} minuscules corps isolés', '{count} बहुत छोटे अलग टुकड़े', '{count} 个微小游离体'],

  'engineError.MESH_REPAIR_FAILED': [
    'La reparación no logró un sólido cerrado: quedan {holes} agujeros ({boundary} bordes abiertos, el mayor de {sizeMm} mm) y {nonManifold} aristas con más de dos caras. Revisa el modelo en tu editor.',
    'Repair could not produce a closed solid: {holes} holes remain ({boundary} open edges, largest {sizeMm} mm) and {nonManifold} edges with more than two faces. Check the model in your editor.',
    'Die Reparatur ergab keinen geschlossenen Körper: {holes} Löcher bleiben ({boundary} offene Kanten, größtes {sizeMm} mm) und {nonManifold} Kanten mit mehr als zwei Flächen. Prüfe das Modell im Editor.',
    'La réparation n’a pas produit de solide fermé : il reste {holes} trous ({boundary} arêtes ouvertes, le plus grand {sizeMm} mm) et {nonManifold} arêtes à plus de deux faces. Vérifiez le modèle dans votre éditeur.',
    'मरम्मत से बंद ठोस नहीं बना: {holes} छेद बचे ({boundary} खुले किनारे, सबसे बड़ा {sizeMm} mm) और दो से अधिक फलकों वाले {nonManifold} किनारे। मॉडल को अपने एडिटर में जाँचें।',
    '修复未能得到封闭实体：仍有 {holes} 个孔（{boundary} 条开放边，最大 {sizeMm} mm）和 {nonManifold} 条多于两面的边。请在编辑器中检查模型。',
  ],
  'engineError.HOLLOW_NO_CAVITY': [
    'Con una pared de {thickness} mm no queda cavidad interior: la pieza es más delgada que dos paredes en todas partes. Prueba con una pared menor.',
    'A {thickness} mm wall leaves no inner cavity: the part is thinner than two walls everywhere. Try a thinner wall.',
    'Eine Wand von {thickness} mm lässt keinen Innenraum: das Teil ist überall dünner als zwei Wände. Versuche eine dünnere Wand.',
    'Une paroi de {thickness} mm ne laisse aucune cavité intérieure : la pièce est partout plus fine que deux parois. Essayez une paroi plus fine.',
    '{thickness} mm की दीवार से अंदर कोई खाली जगह नहीं बचती: भाग हर जगह दो दीवारों से पतला है। पतली दीवार आज़माएँ।',
    '{thickness} mm 的壁厚不会留下内部空腔：零件各处都比两层壁薄。请尝试更薄的壁厚。',
  ],
  'engineWarning.MESH_WELDED_IMPLICITLY': [
    'La malla tenía {edges} bordes abiertos que se cerraron al soldar vértices cercanos (hasta {tol} mm). Usa «Reparar malla» para dejarla corregida.',
    'The mesh had {edges} open edges that closed when welding nearby vertices (up to {tol} mm). Use “Repair mesh” to keep it fixed.',
    'Das Netz hatte {edges} offene Kanten, die sich beim Verschweißen naher Eckpunkte (bis {tol} mm) schlossen. Nutze „Netz reparieren“, um es dauerhaft zu korrigieren.',
    'Le maillage avait {edges} arêtes ouvertes, fermées en soudant des sommets proches (jusqu’à {tol} mm). Utilisez « Réparer le maillage » pour le corriger durablement.',
    'मेश में {edges} खुले किनारे थे जो पास के शीर्ष ({tol} mm तक) जोड़ने पर बंद हुए। इसे स्थायी रूप से ठीक करने के लिए “मेश ठीक करें” चुनें।',
    '网格有 {edges} 条开放边，在焊接邻近顶点（最多 {tol} mm）后闭合。使用“修复网格”可永久修正。',
  ],
  'engineWarning.REPAIR_HOLES_LEFT': [
    'Quedaron {count} agujeros sin cerrar (el mayor de {sizeMm} mm): revisa el modelo.',
    '{count} holes were left open (largest {sizeMm} mm): check the model.',
    '{count} Löcher blieben offen (größtes {sizeMm} mm): prüfe das Modell.',
    '{count} trous sont restés ouverts (le plus grand {sizeMm} mm) : vérifiez le modèle.',
    '{count} छेद खुले रह गए (सबसे बड़ा {sizeMm} mm): मॉडल जाँचें।',
    '仍有 {count} 个孔未封闭（最大 {sizeMm} mm）：请检查模型。',
  ],
  'engineWarning.REPAIR_LARGE_HOLES_FILLED': [
    'Se cerraron {count} agujeros grandes (el mayor de {sizeMm} mm) con una tapa: revisa que la forma sea la esperada.',
    '{count} large holes (largest {sizeMm} mm) were closed with a cap: check the shape is what you expect.',
    '{count} große Löcher (größtes {sizeMm} mm) wurden mit einem Deckel geschlossen: prüfe die Form.',
    '{count} grands trous (le plus grand {sizeMm} mm) ont été fermés par un capuchon : vérifiez la forme.',
    '{count} बड़े छेद (सबसे बड़ा {sizeMm} mm) ढक्कन से बंद किए गए: आकार जाँचें।',
    '已用封盖封闭 {count} 个大孔（最大 {sizeMm} mm）：请检查形状是否符合预期。',
  ],
  'engineWarning.SPLIT_PART_REPAIRED': [
    'La pieza {code} quedó con la malla abierta al cortar y se reparó antes de entregarla.',
    'Part {code} had an open mesh after cutting and was repaired before delivery.',
    'Teil {code} hatte nach dem Schneiden ein offenes Netz und wurde vor der Ausgabe repariert.',
    'La pièce {code} avait un maillage ouvert après la découpe et a été réparée avant livraison.',
    'काटने के बाद हिस्सा {code} का मेश खुला था और देने से पहले ठीक किया गया।',
    '零件 {code} 切割后网格开放，交付前已修复。',
  ],
  'engineWarning.PRINTABILITY_WALL_NOT_MEASURED': [
    'No se pudo medir la pared porque la malla no está cerrada: repárala con «Reparar malla».',
    'The wall could not be measured because the mesh is not closed: repair it with “Repair mesh”.',
    'Die Wand konnte nicht gemessen werden, weil das Netz nicht geschlossen ist: repariere es mit „Netz reparieren“.',
    'La paroi n’a pas pu être mesurée car le maillage n’est pas fermé : réparez-le avec « Réparer le maillage ».',
    'मेश बंद नहीं है इसलिए दीवार नहीं मापी जा सकी: “मेश ठीक करें” से ठीक करें।',
    '网格未封闭，无法测量壁厚：请使用“修复网格”修复。',
  ],
  'engineWarning.SPLIT_HEAVY_MESH': [
    'Modelo de {tris} triángulos: dividirlo puede tardar minutos. Simplifícalo antes para acelerar.',
    '{tris}-triangle model: splitting it may take minutes. Simplify it first to speed up.',
    'Modell mit {tris} Dreiecken: das Teilen kann Minuten dauern. Vereinfache es zuerst.',
    'Modèle de {tris} triangles : la division peut prendre des minutes. Simplifiez-le d’abord.',
    '{tris} त्रिभुज वाला मॉडल: बाँटने में मिनट लग सकते हैं। पहले सरल करें।',
    '{tris} 个三角形的模型：分割可能需要数分钟。请先简化以加快速度。',
  ],
} as const satisfies Record<string, Row>;

type RepairKey = keyof typeof REPAIR_TABLE;

const pick = (index: number): Record<RepairKey, string> =>
  Object.fromEntries(Object.entries(REPAIR_TABLE).map(([key, row]) => [key, row[index]])) as Record<RepairKey, string>;

export const REPAIR_ES = pick(0);
export const REPAIR_EN = pick(1);
export const REPAIR_DE = pick(2);
export const REPAIR_FR = pick(3);
export const REPAIR_HI = pick(4);
export const REPAIR_ZH = pick(5);
