/**
 * @file src/i18n/locales/torreta.ts
 * @description Textos de la torreta para tornillo (panel, preajustes, avisos, nombres de objetos y entradas de menú).
 * Cada clave lleva [es, en, de, fr, hi, zh]; `TORRETA_<IDIOMA>` se mezcla al final de cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const TABLE = {
  'turret.title': ['Torreta para tornillo', 'Screw boss', 'Schraubdom', 'Bossage à vis', 'स्क्रू बॉस', '螺丝柱'],
  'turret.menuTip': [
    'Un poste con agujero sobre una cara, para atornillar una tapa o una placa (tornillo directo o inserto roscado).',
    'A post with a hole on a face, to screw on a lid or a plate (direct screw or threaded insert).',
    'Ein Pfosten mit Loch auf einer Fläche, um einen Deckel oder eine Platte anzuschrauben (Direktschraube oder Gewindeeinsatz).',
    'Un plot percé sur une face, pour visser un couvercle ou une plaque (vis directe ou insert fileté).',
    'किसी फलक पर छेद वाला खंभा, ढक्कन या प्लेट कसने के लिए (सीधा स्क्रू या थ्रेडेड इंसर्ट)।',
    '在面上加一个带孔的柱子，用来拧上盖子或板（直接拧螺丝或热熔螺纹嵌件）。',
  ],
  'turret.cmd.keywords': [
    'torreta tornillo poste inserto roscado latón tapa atornillar boss',
    'screw boss post threaded insert brass lid standoff',
    'schraubdom pfosten gewindeeinsatz messing deckel schraube',
    'bossage vis plot insert fileté laiton couvercle',
    'स्क्रू बॉस खंभा इंसर्ट पीतल ढक्कन',
    '螺丝柱 嵌件 铜螺母 盖子 螺丝',
  ],
  'turret.needSolid': [
    'Para colocar una torreta necesitas una pieza sólida visible y sin bloquear.',
    'To place a screw boss you need a visible, unlocked solid part.',
    'Für einen Schraubdom brauchst du ein sichtbares, nicht gesperrtes Volumenteil.',
    'Pour placer un bossage, il faut une pièce pleine visible et non verrouillée.',
    'स्क्रू बॉस रखने के लिए एक दिखने वाला, अनलॉक ठोस भाग चाहिए।',
    '放置螺丝柱需要一个可见且未锁定的实体零件。',
  ],
  'turret.hint': [
    'Haz clic sobre una cara para colocar la torreta perpendicular a ella. Puedes colocar varias; Escape o «Volver» termina.',
    'Click a face to place the boss perpendicular to it. You can place several; Escape or “Back” finishes.',
    'Klicke auf eine Fläche, um den Dom senkrecht dazu zu setzen. Du kannst mehrere setzen; Escape oder „Zurück“ beendet.',
    'Clique sur une face pour placer le bossage perpendiculairement. Tu peux en placer plusieurs ; Échap ou « Retour » termine.',
    'फलक पर क्लिक करें, बॉस उसके लंबवत लगेगा। कई लगा सकते हैं; Escape या “वापस” से समाप्त करें।',
    '点击一个面，螺丝柱会垂直于该面放置。可以连续放置多个；按 Esc 或“返回”结束。',
  ],
  'turret.invalid': [
    'Corrige las medidas marcadas para poder colocar.',
    'Fix the marked sizes to be able to place.',
    'Korrigiere die markierten Maße, um setzen zu können.',
    'Corrige les mesures signalées pour pouvoir placer.',
    'रखने के लिए चिह्नित माप ठीक करें।',
    '请先修正标记的尺寸才能放置。',
  ],
  'turret.type': ['Tipo', 'Type', 'Art', 'Type', 'प्रकार', '类型'],
  'turret.type.screw': ['Tornillo directo', 'Direct screw', 'Direktschraube', 'Vis directe', 'सीधा स्क्रू', '直接拧螺丝'],
  'turret.type.insert': ['Inserto roscado', 'Threaded insert', 'Gewindeeinsatz', 'Insert fileté', 'थ्रेडेड इंसर्ट', '螺纹嵌件'],
  'turret.preset': ['Medida', 'Size', 'Größe', 'Taille', 'माप', '规格'],
  'turret.preset.custom': ['Personalizada', 'Custom', 'Eigene', 'Personnalisée', 'कस्टम', '自定义'],
  'turret.preset.builtin': ['Incluidas (por verificar)', 'Included (to be verified)', 'Enthalten (zu prüfen)', 'Incluses (à vérifier)', 'शामिल (जाँचना बाकी)', '内置（待验证）'],
  'turret.preset.mine': ['Mis medidas', 'My sizes', 'Meine Größen', 'Mes tailles', 'मेरे माप', '我的规格'],
  'turret.preset.screw': ['{size} · agujero Ø {d}', '{size} · hole Ø {d}', '{size} · Loch Ø {d}', '{size} · trou Ø {d}', '{size} · छेद Ø {d}', '{size} · 孔 Ø {d}'],
  'turret.preset.insert': [
    '{size} · inserto Ø {d} × {len}',
    '{size} · insert Ø {d} × {len}',
    '{size} · Einsatz Ø {d} × {len}',
    '{size} · insert Ø {d} × {len}',
    '{size} · इंसर्ट Ø {d} × {len}',
    '{size} · 嵌件 Ø {d} × {len}',
  ],
  'turret.preset.name': ['Nombre del preajuste', 'Preset name', 'Name der Vorgabe', 'Nom du préréglage', 'प्रीसेट का नाम', '预设名称'],
  'turret.preset.save': ['Guardar', 'Save', 'Speichern', 'Enregistrer', 'सहेजें', '保存'],
  'turret.preset.delete': ['Eliminar el preajuste propio', 'Delete my preset', 'Eigene Vorgabe löschen', 'Supprimer mon préréglage', 'मेरा प्रीसेट हटाएँ', '删除我的预设'],
  'turret.preset.nameInvalid': [
    'Escribe un nombre de 1 a 40 caracteres.',
    'Type a name of 1 to 40 characters.',
    'Gib einen Namen mit 1 bis 40 Zeichen ein.',
    'Saisis un nom de 1 à 40 caractères.',
    '1 से 40 अक्षरों का नाम लिखें।',
    '请输入 1 到 40 个字符的名称。',
  ],
  'turret.preset.full': [
    'Ya tienes {max} preajustes: elimina uno para guardar otro.',
    'You already have {max} presets: delete one to save another.',
    'Du hast bereits {max} Vorgaben: lösche eine, um eine neue zu speichern.',
    'Tu as déjà {max} préréglages : supprimes-en un pour en enregistrer un autre.',
    'आपके पास पहले से {max} प्रीसेट हैं: नया सहेजने के लिए एक हटाएँ।',
    '已有 {max} 个预设：请先删除一个再保存。',
  ],
  'turret.preset.storageFailed': [
    'No se pudo guardar en este navegador (almacenamiento lleno o bloqueado).',
    'Could not save in this browser (storage full or blocked).',
    'Speichern in diesem Browser nicht möglich (Speicher voll oder gesperrt).',
    'Impossible d’enregistrer dans ce navigateur (stockage plein ou bloqué).',
    'इस ब्राउज़र में सहेजा नहीं जा सका (स्टोरेज भरा या अवरुद्ध)।',
    '无法在此浏览器中保存（存储已满或被阻止）。',
  ],
  'turret.preset.valuesInvalid': [
    'Las medidas actuales no son válidas: corrígelas antes de guardar.',
    'The current sizes are not valid: fix them before saving.',
    'Die aktuellen Maße sind ungültig: korrigiere sie vor dem Speichern.',
    'Les mesures actuelles ne sont pas valides : corrige-les avant d’enregistrer.',
    'मौजूदा माप मान्य नहीं हैं: सहेजने से पहले ठीक करें।',
    '当前尺寸无效：请先修正再保存。',
  ],
  'turret.preset.saved': ['Preajuste «{name}» guardado.', 'Preset “{name}” saved.', 'Vorgabe „{name}“ gespeichert.', 'Préréglage « {name} » enregistré.', 'प्रीसेट “{name}” सहेजा गया।', '已保存预设“{name}”。'],
  'turret.preset.deleted': ['Preajuste «{name}» eliminado.', 'Preset “{name}” deleted.', 'Vorgabe „{name}“ gelöscht.', 'Préréglage « {name} » supprimé.', 'प्रीसेट “{name}” हटाया गया।', '已删除预设“{name}”。'],
  'turret.preset.undoDelete': [
    'Deshacer eliminación del preajuste {name}',
    'Undo deletion of preset {name}',
    'Löschen der Vorgabe {name} rückgängig machen',
    'Annuler la suppression du préréglage {name}',
    'प्रीसेट {name} हटाना पूर्ववत करें',
    '撤销删除预设 {name}',
  ],
  'turret.height': ['Alto del poste (mm)', 'Post height (mm)', 'Pfostenhöhe (mm)', 'Hauteur du plot (mm)', 'खंभे की ऊँचाई (mm)', '柱高 (mm)'],
  'turret.outer': ['Diámetro exterior (mm)', 'Outer diameter (mm)', 'Außendurchmesser (mm)', 'Diamètre extérieur (mm)', 'बाहरी व्यास (mm)', '外径 (mm)'],
  'turret.holeDiameter': ['Diámetro del agujero (mm)', 'Hole diameter (mm)', 'Lochdurchmesser (mm)', 'Diamètre du trou (mm)', 'छेद का व्यास (mm)', '孔径 (mm)'],
  'turret.holeDepth': ['Profundidad del agujero (mm)', 'Hole depth (mm)', 'Lochtiefe (mm)', 'Profondeur du trou (mm)', 'छेद की गहराई (mm)', '孔深 (mm)'],
  'turret.startNote': [
    'Son valores de partida típicos, por verificar: conviene imprimir una torreta de prueba con tu tornillo o inserto antes de la pieza final.',
    'These are typical starting values, to be verified: print a test boss with your screw or insert before the final part.',
    'Das sind typische Startwerte, noch zu prüfen: Drucke vor dem fertigen Teil einen Testdom mit deiner Schraube oder deinem Einsatz.',
    'Ce sont des valeurs de départ typiques, à vérifier : imprime un bossage d’essai avec ta vis ou ton insert avant la pièce finale.',
    'ये सामान्य शुरुआती मान हैं, जाँचना बाकी है: अंतिम भाग से पहले अपने स्क्रू या इंसर्ट के साथ एक परीक्षण बॉस प्रिंट करें।',
    '这些是常见的起始值，有待验证：在打印正式零件前，先用你的螺丝或嵌件打印一个测试螺丝柱。',
  ],
  'turret.summary': [
    'Poste Ø {od} × {h} mm, agujero Ø {d} × {depth} mm',
    'Post Ø {od} × {h} mm, hole Ø {d} × {depth} mm',
    'Pfosten Ø {od} × {h} mm, Loch Ø {d} × {depth} mm',
    'Plot Ø {od} × {h} mm, trou Ø {d} × {depth} mm',
    'खंभा Ø {od} × {h} mm, छेद Ø {d} × {depth} mm',
    '柱 Ø {od} × {h} mm，孔 Ø {d} × {depth} mm',
  ],
  'turret.summaryInvalid': [
    'Revisa las medidas: el poste debe ser más ancho que el agujero.',
    'Check the sizes: the post must be wider than the hole.',
    'Prüfe die Maße: Der Pfosten muss breiter als das Loch sein.',
    'Vérifie les mesures : le plot doit être plus large que le trou.',
    'माप जाँचें: खंभा छेद से चौड़ा होना चाहिए।',
    '请检查尺寸：柱子必须比孔宽。',
  ],
  'turret.objectName.screw': ['Torreta {size}', 'Screw boss {size}', 'Schraubdom {size}', 'Bossage {size}', 'स्क्रू बॉस {size}', '螺丝柱 {size}'],
  'turret.objectName.insert': ['Torreta {size} inserto', 'Insert boss {size}', 'Einsatzdom {size}', 'Bossage insert {size}', 'इंसर्ट बॉस {size}', '嵌件柱 {size}'],
  'turret.objectName.hole': ['Agujero torreta {size} Ø {d}', 'Boss hole {size} Ø {d}', 'Domloch {size} Ø {d}', 'Trou de bossage {size} Ø {d}', 'बॉस छेद {size} Ø {d}', '柱孔 {size} Ø {d}'],
  'turret.created': [
    '{name} agregada. «Aplicar restas» la une a la pieza y abre el agujero.',
    '{name} added. “Apply subtractions” joins it to the part and opens the hole.',
    '{name} hinzugefügt. „Abzüge anwenden“ verbindet ihn mit dem Teil und öffnet das Loch.',
    '{name} ajouté. « Appliquer les soustractions » l’unit à la pièce et ouvre le trou.',
    '{name} जोड़ा गया। “घटाव लागू करें” इसे भाग से जोड़ता है और छेद खोलता है।',
    '已添加 {name}。“应用减法”会把它并入零件并打出孔。',
  ],
  'turret.placed': ['{name} agregada.', '{name} added.', '{name} hinzugefügt.', '{name} ajouté.', '{name} जोड़ा गया।', '已添加 {name}。'],
  'turret.error.tooWide': [
    'La torreta no cabe ahí: el poste es más ancho que la cara en esa zona. Elige una zona más amplia o un diámetro menor.',
    'The boss does not fit there: the post is wider than the face in that area. Pick a wider area or a smaller diameter.',
    'Der Dom passt dort nicht: Der Pfosten ist breiter als die Fläche an dieser Stelle. Wähle eine breitere Stelle oder einen kleineren Durchmesser.',
    'Le bossage ne tient pas là : le plot est plus large que la face à cet endroit. Choisis une zone plus large ou un diamètre plus petit.',
    'बॉस वहाँ नहीं समाता: उस जगह खंभा फलक से चौड़ा है। चौड़ी जगह या छोटा व्यास चुनें।',
    '这里放不下：柱子比该处的面更宽。请选更宽的位置或更小的直径。',
  ],
  'turret.warn.exits': [
    'El agujero atraviesa la pieza y sale por el otro lado: sube el poste o acorta el agujero.',
    'The hole goes through the part and comes out the other side: raise the post or shorten the hole.',
    'Das Loch geht durch das Teil und tritt auf der anderen Seite aus: Erhöhe den Pfosten oder kürze das Loch.',
    'Le trou traverse la pièce et ressort de l’autre côté : rehausse le plot ou raccourcis le trou.',
    'छेद भाग के आर-पार दूसरी ओर निकल जाता है: खंभा ऊँचा करें या छेद छोटा करें।',
    '孔穿透零件从另一侧露出：请加高柱子或缩短孔深。',
  ],
  'turret.warn.into': [
    'El agujero atraviesa el poste y entra {mm} mm en la pieza: revisa que ahí haya material de sobra.',
    'The hole goes through the post and {mm} mm into the part: check there is enough material there.',
    'Das Loch geht durch den Pfosten und {mm} mm ins Teil: Prüfe, ob dort genug Material ist.',
    'Le trou traverse le plot et entre de {mm} mm dans la pièce : vérifie qu’il y a assez de matière.',
    'छेद खंभे के आर-पार {mm} mm भाग में जाता है: जाँचें कि वहाँ पर्याप्त सामग्री है।',
    '孔穿过柱子并深入零件 {mm} mm：请确认那里材料足够。',
  ],
  'turret.warn.wall': [
    'La pared del poste queda en {wall} mm (mínimo recomendado {min} mm): aumenta el diámetro exterior.',
    'The post wall is {wall} mm (recommended minimum {min} mm): increase the outer diameter.',
    'Die Pfostenwand ist {wall} mm (empfohlenes Minimum {min} mm): Erhöhe den Außendurchmesser.',
    'La paroi du plot fait {wall} mm (minimum conseillé {min} mm) : augmente le diamètre extérieur.',
    'खंभे की दीवार {wall} mm है (अनुशंसित न्यूनतम {min} mm): बाहरी व्यास बढ़ाएँ।',
    '柱壁只有 {wall} mm（建议至少 {min} mm）：请加大外径。',
  ],
  'turret.warn.collide': [
    'Choca con otra torreta o con un imán pendiente: sepáralos antes de aplicar las restas.',
    'It overlaps another boss or a pending magnet: move them apart before applying subtractions.',
    'Er überschneidet sich mit einem anderen Dom oder einem ausstehenden Magneten: Trenne sie vor dem Anwenden der Abzüge.',
    'Il chevauche un autre bossage ou un aimant en attente : écarte-les avant d’appliquer les soustractions.',
    'यह किसी दूसरे बॉस या लंबित चुंबक से टकराता है: घटाव लागू करने से पहले उन्हें अलग करें।',
    '与另一个螺丝柱或待减的磁铁重叠：应用减法前请把它们分开。',
  ],
  'turret.short.exits': ['El agujero sale por el otro lado.', 'The hole comes out the other side.', 'Das Loch tritt auf der anderen Seite aus.', 'Le trou ressort de l’autre côté.', 'छेद दूसरी ओर निकलता है।', '孔从另一侧露出。'],
  'turret.short.into': ['El agujero entra en la pieza.', 'The hole goes into the part.', 'Das Loch reicht ins Teil.', 'Le trou entre dans la pièce.', 'छेद भाग में जाता है।', '孔深入零件。'],
  'turret.short.wall': ['Pared delgada.', 'Thin wall.', 'Dünne Wand.', 'Paroi fine.', 'पतली दीवार।', '柱壁过薄。'],
  'turret.warn.belowBase': [
    'La torreta está en la cara de apoyo: sobresale {mm} mm bajo la base y la pieza ya no apoyará plana en la cama. Ponla en otra cara o gira la pieza para imprimirla.',
    'The boss is on the resting face: it sticks out {mm} mm below the base and the part will no longer sit flat on the bed. Put it on another face or turn the part to print it.',
    'Der Schraubdom sitzt auf der Auflagefläche: Er ragt {mm} mm unter die Basis und das Teil liegt nicht mehr flach auf dem Druckbett. Setze ihn auf eine andere Fläche oder drehe das Teil zum Drucken.',
    'La tourelle est sur la face d’appui : elle dépasse de {mm} mm sous la base et la pièce ne reposera plus à plat sur le plateau. Place-la sur une autre face ou tourne la pièce pour l’imprimer.',
    'बॉस टिकने वाले फलक पर है: यह आधार के नीचे {mm} mm बाहर निकलता है और भाग बेड पर सपाट नहीं टिकेगा। इसे दूसरे फलक पर रखें या प्रिंट के लिए भाग घुमाएँ।',
    '螺柱位于支撑面上：它在底面以下伸出 {mm} mm，零件将无法平放在热床上。请放到其他面，或旋转零件后再打印。',
  ],
  'turret.short.belowBase': ['Sobresale bajo la base.', 'Sticks out below the base.', 'Ragt unter die Basis.', 'Dépasse sous la base.', 'आधार के नीचे निकलता है।', '伸出底面。'],
  'turret.short.collide': ['Choca con otra.', 'Overlaps another.', 'Überschneidet sich.', 'Chevauche un autre.', 'दूसरे से टकराता है।', '与其他重叠。'],
  'turret.lastOk': [
    'Última torreta sin avisos: pared de {wall} mm.',
    'Last boss has no warnings: {wall} mm wall.',
    'Letzter Dom ohne Warnungen: {wall} mm Wand.',
    'Dernier bossage sans alerte : paroi de {wall} mm.',
    'पिछले बॉस में कोई चेतावनी नहीं: {wall} mm दीवार।',
    '上一个螺丝柱无警告：柱壁 {wall} mm。',
  ],
  'turret.fold.label': ['Torreta para tornillo', 'Screw boss', 'Schraubdom', 'Bossage à vis', 'स्क्रू बॉस', '螺丝柱'],
  'turret.fold.empty': ['Haz clic sobre una cara para colocar.', 'Click a face to place.', 'Klicke auf eine Fläche zum Setzen.', 'Clique sur une face pour placer.', 'रखने के लिए फलक पर क्लिक करें।', '点击一个面来放置。'],
} satisfies Record<string, Row>;

type TorretaKey = keyof typeof TABLE;

const pick = (index: number) =>
  Object.fromEntries(Object.entries(TABLE).map(([key, row]) => [key, row[index]])) as Record<TorretaKey, string>;

export const TORRETA_ES = pick(0);
export const TORRETA_EN = pick(1);
export const TORRETA_DE = pick(2);
export const TORRETA_FR = pick(3);
export const TORRETA_HI = pick(4);
export const TORRETA_ZH = pick(5);
