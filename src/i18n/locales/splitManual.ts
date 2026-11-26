/**
 * @file src/i18n/locales/splitManual.ts
 * @description Textos de los cortes a mano de "Dividir para imprimir" en los 6 idiomas: modo de cortes, lista de
 * planos (agregar, quitar, duplicar, eje, posición, inclinación), partir desde el automático, conmutador de la vista
 * y avisos y errores del motor. Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const SPLIT_MANUAL_TABLE = {
  'split.mode.legend': ['Cortes', 'Cuts', 'Schnitte', 'Coupes', 'कट', '切割'],
  'split.mode.auto': ['Automático', 'Automatic', 'Automatisch', 'Automatique', 'स्वचालित', '自动'],
  'split.mode.autoTip': [
    'La app calcula una rejilla de cortes rectos para que cada pieza quepa en la cama',
    'The app computes a grid of straight cuts so every part fits on the bed',
    'Die App berechnet ein Raster gerader Schnitte, damit jedes Teil aufs Bett passt',
    'L’app calcule une grille de coupes droites pour que chaque pièce tienne sur le plateau',
    'ऐप सीधे कटों का ग्रिड बनाता है ताकि हर भाग बेड पर आ जाए',
    '应用计算一组直切网格，使每个零件都能放上打印平台',
  ],
  'split.mode.manual': ['A mano', 'Manual', 'Von Hand', 'À la main', 'हाथ से', '手动'],
  'split.mode.manualTip': [
    'Tú decides cada plano: cuántos, dónde y con qué inclinación',
    'You decide every plane: how many, where and how tilted',
    'Du bestimmst jede Ebene: wie viele, wo und wie geneigt',
    'Vous décidez chaque plan : combien, où et avec quelle inclinaison',
    'हर तल आप तय करें: कितने, कहाँ और कितना झुका',
    '由你决定每个平面：数量、位置和倾斜角度',
  ],
  'split.manual.fromAuto': ['Editar estos cortes a mano', 'Edit these cuts by hand', 'Diese Schnitte von Hand bearbeiten', 'Modifier ces coupes à la main', 'इन कटों को हाथ से बदलें', '手动编辑这些切割'],
  'split.manual.fromAutoTip': [
    'Copia los planos de la rejilla automática a la lista para ajustarlos sin empezar de cero',
    'Copies the automatic grid planes into the list so you can adjust them without starting over',
    'Übernimmt die Ebenen des automatischen Rasters in die Liste, um sie anzupassen',
    'Copie les plans de la grille automatique dans la liste pour les ajuster sans repartir de zéro',
    'स्वचालित ग्रिड के तल सूची में कॉपी करता है ताकि शुरू से न करना पड़े',
    '将自动网格的平面复制到列表中，便于直接调整',
  ],
  'split.manual.reset': ['Volver al automático', 'Back to automatic', 'Zurück zu automatisch', 'Revenir à l’automatique', 'स्वचालित पर लौटें', '恢复自动'],
  'split.manual.resetTip': [
    'Descarta los planos a mano y vuelve a la rejilla calculada',
    'Discards the manual planes and returns to the computed grid',
    'Verwirft die Ebenen von Hand und kehrt zum berechneten Raster zurück',
    'Abandonne les plans à la main et revient à la grille calculée',
    'हाथ के तल हटाकर गणना किए ग्रिड पर लौटता है',
    '放弃手动平面，恢复计算出的网格',
  ],
  'split.manual.list': ['Planos de corte a mano', 'Manual cut planes', 'Schnittebenen von Hand', 'Plans de coupe à la main', 'हाथ के कट तल', '手动切割平面'],
  'split.manual.empty': [
    'Sin planos: agrega uno o parte desde el automático.',
    'No planes yet: add one or start from the automatic grid.',
    'Keine Ebenen: füge eine hinzu oder starte vom automatischen Raster.',
    'Aucun plan : ajoutez-en un ou partez de l’automatique.',
    'कोई तल नहीं: एक जोड़ें या स्वचालित से शुरू करें।',
    '暂无平面：添加一个或从自动网格开始。',
  ],
  'split.manual.add': ['Agregar plano', 'Add plane', 'Ebene hinzufügen', 'Ajouter un plan', 'तल जोड़ें', '添加平面'],
  'split.manual.max': ['Máximo {max} planos.', 'Up to {max} planes.', 'Höchstens {max} Ebenen.', '{max} plans au maximum.', 'अधिकतम {max} तल।', '最多 {max} 个平面。'],
  'split.manual.plane': ['Plano {n}', 'Plane {n}', 'Ebene {n}', 'Plan {n}', 'तल {n}', '平面 {n}'],
  'split.manual.pick': ['Ver', 'Show', 'Zeigen', 'Voir', 'दिखाएँ', '显示'],
  'split.manual.pickAria': ['Resaltar el plano {n} en el visor', 'Highlight plane {n} in the viewport', 'Ebene {n} in der Ansicht hervorheben', 'Mettre en évidence le plan {n} dans la vue', 'दृश्य में तल {n} उभारें', '在视图中突出显示平面 {n}'],
  'split.manual.duplicate': ['Duplicar', 'Duplicate', 'Duplizieren', 'Dupliquer', 'दोहराएँ', '复制'],
  'split.manual.duplicateAria': ['Duplicar el plano {n}', 'Duplicate plane {n}', 'Ebene {n} duplizieren', 'Dupliquer le plan {n}', 'तल {n} दोहराएँ', '复制平面 {n}'],
  'split.manual.remove': ['Quitar', 'Remove', 'Entfernen', 'Retirer', 'हटाएँ', '移除'],
  'split.manual.removeAria': ['Quitar el plano {n}', 'Remove plane {n}', 'Ebene {n} entfernen', 'Retirer le plan {n}', 'तल {n} हटाएँ', '移除平面 {n}'],
  'split.manual.axis': ['Eje', 'Axis', 'Achse', 'Axe', 'अक्ष', '轴'],
  'split.manual.axisAria': ['Eje base del plano {n}', 'Base axis of plane {n}', 'Grundachse der Ebene {n}', 'Axe de base du plan {n}', 'तल {n} का आधार अक्ष', '平面 {n} 的基准轴'],
  'split.manual.position': ['Posición (mm)', 'Position (mm)', 'Position (mm)', 'Position (mm)', 'स्थिति (mm)', '位置 (mm)'],
  'split.manual.positionAria': ['Posición del plano {n} en {axis} (mm)', 'Position of plane {n} along {axis} (mm)', 'Position der Ebene {n} in {axis} (mm)', 'Position du plan {n} sur {axis} (mm)', '{axis} में तल {n} की स्थिति (mm)', '平面 {n} 沿 {axis} 的位置 (mm)'],
  'split.manual.tilt': ['Inclinación hacia {axis} (°)', 'Tilt toward {axis} (°)', 'Neigung zu {axis} (°)', 'Inclinaison vers {axis} (°)', '{axis} की ओर झुकाव (°)', '向 {axis} 倾斜 (°)'],
  'split.manual.tiltAria': ['Inclinación del plano {n} hacia {axis} (grados)', 'Tilt of plane {n} toward {axis} (degrees)', 'Neigung der Ebene {n} zu {axis} (Grad)', 'Inclinaison du plan {n} vers {axis} (degrés)', 'तल {n} का {axis} की ओर झुकाव (डिग्री)', '平面 {n} 向 {axis} 的倾斜（度）'],
  'split.manual.tilted': ['inclinado', 'tilted', 'geneigt', 'incliné', 'झुका', '倾斜'],
  'split.view.legend': ['Vista', 'View', 'Ansicht', 'Vue', 'दृश्य', '视图'],
  'split.view.showCuts': ['Mostrar cortes', 'Show cuts', 'Schnitte zeigen', 'Afficher les coupes', 'कट दिखाएँ', '显示切割'],
  'split.view.onlyParts': ['Solo las piezas', 'Parts only', 'Nur die Teile', 'Pièces seules', 'केवल भाग', '仅零件'],
  'engineError.SPLIT_MANUAL_CUTS_CROSS': [
    'Los planos en {axis} = {a} mm y {axis} = {b} mm se cruzan dentro del modelo: sepáralos o cambia su inclinación.',
    'The planes at {axis} = {a} mm and {axis} = {b} mm cross inside the model: move them apart or change their tilt.',
    'Die Ebenen bei {axis} = {a} mm und {axis} = {b} mm kreuzen sich im Modell: trenne sie oder ändere ihre Neigung.',
    'Les plans à {axis} = {a} mm et {axis} = {b} mm se croisent dans le modèle : écartez-les ou changez leur inclinaison.',
    '{axis} = {a} mm और {axis} = {b} mm वाले तल मॉडल के भीतर कटते हैं: उन्हें अलग करें या झुकाव बदलें।',
    '位于 {axis} = {a} mm 与 {axis} = {b} mm 的平面在模型内相交：请拉开距离或改变倾斜。',
  ],
  'engineWarning.SPLIT_MANUAL_PIECE_TOO_BIG': [
    '{count?La pieza|Las piezas} {codes} no {count?cabe|caben} en la cama ({size} mm; útil {usable} mm): agrega o mueve planos.',
    '{count?Part|Parts} {codes} {count?does|do} not fit on the bed ({size} mm; usable {usable} mm): add or move planes.',
    '{count?Teil|Teile} {codes} {count?passt|passen} nicht aufs Bett ({size} mm; nutzbar {usable} mm): füge Ebenen hinzu oder verschiebe sie.',
    '{count?La pièce|Les pièces} {codes} ne {count?tient|tiennent} pas sur le plateau ({size} mm ; utile {usable} mm) : ajoutez ou déplacez des plans.',
    'भाग {codes} बेड पर नहीं आते ({size} mm; उपयोगी {usable} mm): तल जोड़ें या खिसकाएँ।',
    '零件 {codes} 放不进打印平台（{size} mm；可用 {usable} mm）：请添加或移动平面。',
  ],
  'engineWarning.SPLIT_MANUAL_PIECE_THIN': [
    '{count?La pieza|Las piezas} {codes} {count?queda|quedan} muy {count?delgada|delgadas} para unir ({thickness} mm; el alojamiento con su pared pide {min} mm): sus uniones pueden quedar para pegar.',
    '{count?Part|Parts} {codes} {count?is|are} too thin to join ({thickness} mm; the socket with its wall needs {min} mm): their joints may be left to glue.',
    '{count?Teil|Teile} {codes} {count?ist|sind} zu dünn zum Verbinden ({thickness} mm; die Aufnahme mit Wand braucht {min} mm): die Verbindungen werden evtl. geklebt.',
    '{count?La pièce|Les pièces} {codes} {count?est trop fine|sont trop fines} pour être {count?assemblée|assemblées} ({thickness} mm ; le logement et sa paroi demandent {min} mm) : leurs jonctions peuvent rester à coller.',
    'भाग {codes} जोड़ने के लिए बहुत पतले हैं ({thickness} mm; दीवार सहित खाँचे को {min} mm चाहिए): जोड़ चिपकाने वाले रह सकते हैं।',
    '零件 {codes} 太薄无法连接（{thickness} mm；带壁的插孔需要 {min} mm）：其接缝可能只能粘合。',
  ],
  'engineWarning.SPLIT_MANUAL_TILT_GLUE': [
    '{count?El plano inclinado|Los planos inclinados} {cuts} se {count?cruza|cruzan} con cortes de otra dirección: esas uniones irán para pegar, porque la pieza no tendría una dirección de entrada común. Con imanes o planos paralelos se conservan.',
    '{count?Tilted plane|Tilted planes} {cuts} {count?crosses|cross} cuts in another direction: those joints will be left to glue, because the part would have no common way in. Magnets or parallel planes keep them.',
    '{count?Geneigte Ebene|Geneigte Ebenen} {cuts} {count?kreuzt|kreuzen} Schnitte anderer Richtung: diese Verbindungen werden geklebt, da das Teil keine gemeinsame Einschubrichtung hätte. Mit Magneten oder parallelen Ebenen bleiben sie.',
    '{count?Le plan incliné|Les plans inclinés} {cuts} {count?croise|croisent} des coupes d’une autre direction : ces jonctions resteront à coller, car la pièce n’aurait pas de sens d’entrée commun. Avec des aimants ou des plans parallèles, elles sont conservées.',
    'झुके तल {cuts} दूसरी दिशा के कटों से कटते हैं: ये जोड़ चिपकाने वाले रहेंगे, क्योंकि भाग के अंदर जाने की एक साझा दिशा नहीं होगी। चुंबक या समांतर तलों से ये बने रहते हैं।',
    '倾斜平面 {cuts} 与其他方向的切割相交：这些接缝将只能粘合，因为零件没有共同的插入方向。使用磁铁或平行平面可保留。',
  ],
  'engineWarning.SPLIT_MANUAL_TILT_GLUED': [
    '{count} {count?unión inclinada quedó|uniones inclinadas quedaron} para pegar ({pairs}): esas piezas tienen caras de unión en direcciones distintas y no hay una entrada común.',
    '{count} tilted {count?joint was|joints were} left to glue ({pairs}): those parts have joint faces in different directions and no common way in.',
    '{count} geneigte {count?Verbindung wird|Verbindungen werden} geklebt ({pairs}): diese Teile haben Verbindungsflächen in verschiedenen Richtungen.',
    '{count} {count?jonction inclinée reste|jonctions inclinées restent} à coller ({pairs}) : ces pièces ont des faces de jonction dans des directions différentes.',
    '{count} झुके जोड़ चिपकाने वाले रहे ({pairs}): इन भागों के जोड़ फलक अलग दिशाओं में हैं।',
    '{count} 个倾斜接缝改为粘合（{pairs}）：这些零件的接合面方向不同，没有共同的插入方向。',
  ],
} as const satisfies Record<string, Row>;

type SplitManualKey = keyof typeof SPLIT_MANUAL_TABLE;

const pick = (index: number): Record<SplitManualKey, string> =>
  Object.fromEntries(Object.entries(SPLIT_MANUAL_TABLE).map(([key, row]) => [key, row[index]])) as Record<SplitManualKey, string>;

export const SPLIT_MANUAL_ES = pick(0);
export const SPLIT_MANUAL_EN = pick(1);
export const SPLIT_MANUAL_DE = pick(2);
export const SPLIT_MANUAL_FR = pick(3);
export const SPLIT_MANUAL_HI = pick(4);
export const SPLIT_MANUAL_ZH = pick(5);
