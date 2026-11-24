/**
 * @file src/i18n/locales/iman.ts
 * @description Textos del alojamiento de imán (panel, preajustes, avisos de pared y nombre del negativo) en los 6
 * idiomas. Cada clave lleva [es, en, de, fr, hi, zh]; `IMAN_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const IMAN_TABLE = {
  'magnet.title': ['Alojamiento de imán', 'Magnet pocket', 'Magnetaufnahme', 'Logement d’aimant', 'चुंबक खाँचा', '磁铁槽'],
  'magnet.menuTip': [
    'Hueco para un imán sobre una cara de una pieza (queda como pieza negativa).',
    'Pocket for a magnet on a face of a part (added as a negative part).',
    'Aussparung für einen Magneten auf einer Fläche eines Teils (als Negativteil).',
    'Creux pour un aimant sur une face d’une pièce (ajouté comme pièce négative).',
    'किसी भाग की सतह पर चुंबक के लिए खाँचा (नेगेटिव भाग के रूप में)।',
    '在零件的某个面上为磁铁开槽(作为负形零件添加)。',
  ],
  'magnet.needSolid': [
    'Para colocar un alojamiento de imán necesitas al menos una pieza sólida visible y sin bloquear en la escena.',
    'To place a magnet pocket you need at least one visible, unlocked solid part in the scene.',
    'Für eine Magnetaufnahme brauchst du mindestens ein sichtbares, nicht gesperrtes festes Teil in der Szene.',
    'Pour placer un logement d’aimant, il faut au moins une pièce solide visible et non verrouillée dans la scène.',
    'चुंबक खाँचा रखने के लिए दृश्य में कम से कम एक दिखाई देने वाला, बिना लॉक का ठोस भाग चाहिए।',
    '要放置磁铁槽,场景中至少需要一个可见且未锁定的实体零件。',
  ],
  'magnet.objectName': ['Imán {size}', 'Magnet {size}', 'Magnet {size}', 'Aimant {size}', 'चुंबक {size}', '磁铁 {size}'],
  'magnet.created': [
    '«{name}» agregado como pieza negativa. Usa «Aplicar restas» para abrir el hueco.',
    '“{name}” added as a negative part. Use “Apply subtractions” to open the pocket.',
    '„{name}“ als Negativteil hinzugefügt. Mit „Abzüge anwenden“ entsteht die Aussparung.',
    '« {name} » ajouté comme pièce négative. Utilise « Appliquer les soustractions » pour creuser.',
    '“{name}” नेगेटिव भाग के रूप में जोड़ा गया। खाँचा बनाने के लिए “घटाव लागू करें” चुनें।',
    '已将“{name}”添加为负形零件。使用“应用减法”开出凹槽。',
  ],
  'magnet.warn.wall': [
    'Queda poca pared alrededor del imán: {wall} mm (se recomienda al menos {min} mm).',
    'Little wall left around the magnet: {wall} mm (at least {min} mm is recommended).',
    'Wenig Wand um den Magneten: {wall} mm (empfohlen sind mindestens {min} mm).',
    'Peu de paroi autour de l’aimant : {wall} mm (au moins {min} mm recommandé).',
    'चुंबक के चारों ओर दीवार कम है: {wall} mm (कम से कम {min} mm की सलाह है)।',
    '磁铁周围的壁太薄:{wall} mm(建议至少 {min} mm)。',
  ],
  'magnet.warn.through': [
    'El hueco atraviesa la pieza o se asoma por otra cara: muévelo o usa un imán más bajo.',
    'The pocket goes through the part or breaks out of another face: move it or use a shorter magnet.',
    'Die Aussparung geht durch das Teil oder tritt an einer anderen Fläche aus: verschiebe sie oder nimm einen flacheren Magneten.',
    'Le creux traverse la pièce ou débouche sur une autre face : déplace-le ou prends un aimant moins haut.',
    'खाँचा भाग के आर-पार जाता है या दूसरी सतह से निकलता है: इसे हटाएँ या छोटा चुंबक लें।',
    '凹槽穿透了零件或从另一面露出:请移动它或使用更薄的磁铁。',
  ],
  'magnet.hint': [
    'Haz clic sobre una cara de una pieza para colocar el hueco. Cada clic agrega otro; Esc o «Listo» termina.',
    'Click a face of a part to place the pocket. Each click adds another; Esc or “Done” finishes.',
    'Klicke auf eine Fläche eines Teils, um die Aussparung zu setzen. Jeder Klick fügt eine weitere hinzu; Esc oder „Fertig“ beendet.',
    'Clique sur une face d’une pièce pour placer le creux. Chaque clic en ajoute un ; Échap ou « Terminé » arrête.',
    'खाँचा रखने के लिए किसी भाग की सतह पर क्लिक करें। हर क्लिक एक और जोड़ता है; Esc या “हो गया” से समाप्त करें।',
    '点击零件的某个面放置凹槽。每次点击再加一个;按 Esc 或“完成”结束。',
  ],
  'magnet.invalid': [
    'Corrige los campos marcados para poder colocar.',
    'Fix the marked fields to place pockets.',
    'Korrigiere die markierten Felder, um zu platzieren.',
    'Corrige les champs signalés pour pouvoir placer.',
    'रखने के लिए चिह्नित फ़ील्ड ठीक करें।',
    '请先修正标记的字段再放置。',
  ],
  'magnet.preset': ['Preajuste', 'Preset', 'Voreinstellung', 'Préréglage', 'प्रीसेट', '预设'],
  'magnet.preset.builtin': ['Incluidos', 'Built-in', 'Mitgeliefert', 'Inclus', 'शामिल', '内置'],
  'magnet.preset.mine': ['Mis preajustes', 'My presets', 'Meine Voreinstellungen', 'Mes préréglages', 'मेरे प्रीसेट', '我的预设'],
  'magnet.preset.custom': ['Personalizado', 'Custom', 'Eigene Werte', 'Personnalisé', 'कस्टम', '自定义'],
  'magnet.preset.round': ['Redondo {size}', 'Round {size}', 'Rund {size}', 'Rond {size}', 'गोल {size}', '圆形 {size}'],
  'magnet.preset.square': ['Cuadrado {size}', 'Square {size}', 'Quadratisch {size}', 'Carré {size}', 'चौकोर {size}', '方形 {size}'],
  'magnet.preset.name': ['Nombre del preajuste', 'Preset name', 'Name der Voreinstellung', 'Nom du préréglage', 'प्रीसेट का नाम', '预设名称'],
  'magnet.preset.save': ['Guardar preajuste', 'Save preset', 'Voreinstellung speichern', 'Enregistrer le préréglage', 'प्रीसेट सहेजें', '保存预设'],
  'magnet.preset.saved': ['Preajuste «{name}» guardado.', 'Preset “{name}” saved.', 'Voreinstellung „{name}“ gespeichert.', 'Préréglage « {name} » enregistré.', 'प्रीसेट “{name}” सहेजा गया।', '已保存预设“{name}”。'],
  'magnet.preset.delete': ['Eliminar preajuste', 'Delete preset', 'Voreinstellung löschen', 'Supprimer le préréglage', 'प्रीसेट हटाएँ', '删除预设'],
  'magnet.preset.deleted': ['Preajuste «{name}» eliminado.', 'Preset “{name}” deleted.', 'Voreinstellung „{name}“ gelöscht.', 'Préréglage « {name} » supprimé.', 'प्रीसेट “{name}” हटाया गया।', '已删除预设“{name}”。'],
  'magnet.preset.nameInvalid': [
    'Escribe un nombre de 1 a 40 caracteres.',
    'Enter a name of 1 to 40 characters.',
    'Gib einen Namen mit 1 bis 40 Zeichen ein.',
    'Saisis un nom de 1 à 40 caractères.',
    '1 से 40 अक्षरों का नाम लिखें।',
    '请输入 1 到 40 个字符的名称。',
  ],
  'magnet.preset.full': [
    'Llegaste al máximo de {max} preajustes: elimina uno para guardar otro.',
    'You reached the maximum of {max} presets: delete one to save another.',
    'Maximal {max} Voreinstellungen erreicht: lösche eine, um eine neue zu speichern.',
    'Maximum de {max} préréglages atteint : supprimes-en un pour en enregistrer un autre.',
    'अधिकतम {max} प्रीसेट हो गए: नया सहेजने के लिए एक हटाएँ।',
    '已达到 {max} 个预设的上限:请删除一个再保存。',
  ],
  'magnet.shape': ['Forma', 'Shape', 'Form', 'Forme', 'आकार', '形状'],
  'magnet.shape.round': ['Redondo', 'Round', 'Rund', 'Rond', 'गोल', '圆形'],
  'magnet.shape.square': ['Cuadrado', 'Square', 'Quadratisch', 'Carré', 'चौकोर', '方形'],
  'magnet.diameter': ['Diámetro del imán (mm)', 'Magnet diameter (mm)', 'Magnetdurchmesser (mm)', 'Diamètre de l’aimant (mm)', 'चुंबक का व्यास (mm)', '磁铁直径 (mm)'],
  'magnet.side': ['Lado del imán (mm)', 'Magnet side (mm)', 'Magnetseite (mm)', 'Côté de l’aimant (mm)', 'चुंबक की भुजा (mm)', '磁铁边长 (mm)'],
  'magnet.height': ['Alto del imán (mm)', 'Magnet height (mm)', 'Magnethöhe (mm)', 'Hauteur de l’aimant (mm)', 'चुंबक की ऊँचाई (mm)', '磁铁高度 (mm)'],
  'magnet.clearance': ['Holgura de ancho (mm)', 'Width clearance (mm)', 'Spiel in der Breite (mm)', 'Jeu en largeur (mm)', 'चौड़ाई में ढील (mm)', '宽度间隙 (mm)'],
  'magnet.depthClearance': ['Holgura de profundidad (mm)', 'Depth clearance (mm)', 'Spiel in der Tiefe (mm)', 'Jeu en profondeur (mm)', 'गहराई में ढील (mm)', '深度间隙 (mm)'],
  'magnet.clearanceHelp': [
    'Se suma al diámetro o lado y a la profundidad. 0,2 mm suele entrar a presión; más si lo vas a pegar.',
    'Added to the diameter or side and to the depth. 0.2 mm is usually a press fit; more if you will glue it.',
    'Wird zu Durchmesser bzw. Seite und zur Tiefe addiert. 0,2 mm passt meist mit Presssitz; mehr zum Kleben.',
    'S’ajoute au diamètre ou au côté et à la profondeur. 0,2 mm entre souvent en force ; plus si tu le colles.',
    'व्यास या भुजा और गहराई में जुड़ता है। 0.2 mm आम तौर पर दबाकर फिट होता है; चिपकाना हो तो ज़्यादा रखें।',
    '加到直径或边长以及深度上。0.2 mm 通常可压入;若要粘接可加大。',
  ],
  'magnet.hidden': ['Oculto bajo la cara', 'Hidden under the face', 'Verdeckt unter der Fläche', 'Caché sous la face', 'सतह के नीचे छिपा', '隐藏在表面下'],
  'magnet.hiddenHelp': [
    'Deja 0,6 mm de material sobre el imán. Tendrás que pausar la impresión a esa altura para insertarlo.',
    'Leaves 0.6 mm of material over the magnet. You must pause the print at that height to insert it.',
    'Lässt 0,6 mm Material über dem Magneten. Du musst den Druck auf dieser Höhe pausieren, um ihn einzulegen.',
    'Laisse 0,6 mm de matière au-dessus de l’aimant. Il faudra mettre l’impression en pause à cette hauteur pour l’insérer.',
    'चुंबक के ऊपर 0.6 mm सामग्री छोड़ता है। उसे डालने के लिए उस ऊँचाई पर प्रिंट रोकना होगा।',
    '在磁铁上方保留 0.6 mm 材料。需要在该高度暂停打印以放入磁铁。',
  ],
  'magnet.summaryRound': ['Hueco: Ø {w} × {d} mm', 'Pocket: Ø {w} × {d} mm', 'Aussparung: Ø {w} × {d} mm', 'Creux : Ø {w} × {d} mm', 'खाँचा: Ø {w} × {d} mm', '凹槽:Ø {w} × {d} mm'],
  'magnet.summarySquare': ['Hueco: {w} × {w} × {d} mm', 'Pocket: {w} × {w} × {d} mm', 'Aussparung: {w} × {w} × {d} mm', 'Creux : {w} × {w} × {d} mm', 'खाँचा: {w} × {w} × {d} mm', '凹槽:{w} × {w} × {d} mm'],
  'magnet.lastWall': [
    'Último colocado: pared mínima {wall} mm.',
    'Last placed: minimum wall {wall} mm.',
    'Zuletzt gesetzt: minimale Wand {wall} mm.',
    'Dernier placé : paroi minimale {wall} mm.',
    'पिछला रखा गया: न्यूनतम दीवार {wall} mm।',
    '上一个:最薄壁 {wall} mm。',
  ],
  'magnet.done': ['Listo', 'Done', 'Fertig', 'Terminé', 'हो गया', '完成'],
  'magnet.cmd.keywords': [
    'imán iman alojamiento hueco neodimio agregado',
    'magnet pocket hole neodymium addon',
    'magnet aufnahme aussparung neodym',
    'aimant logement creux néodyme',
    'चुंबक खाँचा छेद नियोडिमियम magnet',
    '磁铁 槽 孔 钕磁铁 magnet',
  ],
} satisfies Record<string, Row>;

type ImanKey = keyof typeof IMAN_TABLE;

const pick = (index: number) =>
  Object.fromEntries(Object.entries(IMAN_TABLE).map(([key, row]) => [key, row[index]])) as Record<ImanKey, string>;

export const IMAN_ES = pick(0);
export const IMAN_EN = pick(1);
export const IMAN_DE = pick(2);
export const IMAN_FR = pick(3);
export const IMAN_HI = pick(4);
export const IMAN_ZH = pick(5);
