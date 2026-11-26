/**
 * @file src/i18n/locales/menuIdeas.ts
 * @description Textos de las ideas tomadas de los menús de los laminadores, en los 6 idiomas: Centrar en la cama,
 * submenús Transformar y Alinear y distribuir, forma Disco, Más (reemplazar por archivo, exportar la selección
 * como STL, ocultar) y aviso de malla pesada al importar. Cada clave lleva sus 6 traducciones
 * [es, en, de, fr, hi, zh] y se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const MENU_IDEAS_TABLE = {
  'menu.shape.disc': ['Disco', 'Disc', 'Scheibe', 'Disque', 'डिस्क', '圆盘'],
  'sidebar.primitive.disc': ['Disco', 'Disc', 'Scheibe', 'Disque', 'डिस्क', '圆盘'],
  'menu.group.position': ['Posición', 'Position', 'Position', 'Position', 'स्थिति', '位置'],
  'ctx.centerOnBed': ['Centrar en la cama', 'Center on bed', 'Auf dem Bett zentrieren', 'Centrer sur le plateau', 'बेड पर केंद्रित करें', '在打印床上居中'],
  'ctx.centerOnBed.tip': [
    'Lleva el centro del objeto al centro de la cama (X e Y) sin cambiar su altura',
    'Moves the object’s center to the bed center (X and Y) without changing its height',
    'Bringt die Objektmitte in die Bettmitte (X und Y), ohne die Höhe zu ändern',
    'Place le centre de l’objet au centre du plateau (X et Y) sans changer sa hauteur',
    'ऑब्जेक्ट के केंद्र को बेड के केंद्र (X और Y) पर लाता है, ऊँचाई नहीं बदलती',
    '将对象中心移到打印床中心(X 和 Y),不改变高度',
  ],
  'repeat.name.centerOnBed': ['Centrar en la cama', 'Center on bed', 'Auf dem Bett zentrieren', 'Centrer sur le plateau', 'बेड पर केंद्रित करें', '在打印床上居中'],
  'toast.centeredOnBed': ['Centrado en la cama', 'Centered on the bed', 'Auf dem Bett zentriert', 'Centré sur le plateau', 'बेड पर केंद्रित', '已在打印床上居中'],
  'menu.transform': ['Transformar', 'Transform', 'Transformieren', 'Transformer', 'रूपांतरित करें', '变换'],
  'menu.transform.tip': ['Mover, rotar, escalar, espejar o restablecer', 'Move, rotate, scale, mirror or reset', 'Verschieben, drehen, skalieren, spiegeln oder zurücksetzen', 'Déplacer, pivoter, mettre à l’échelle, miroiter ou réinitialiser', 'हिलाएँ, घुमाएँ, स्केल करें, प्रतिबिंबित करें या रीसेट करें', '移动、旋转、缩放、镜像或重置'],
  'menu.transform.move': ['Mover', 'Move', 'Verschieben', 'Déplacer', 'हिलाएँ', '移动'],
  'menu.transform.rotate': ['Rotar', 'Rotate', 'Drehen', 'Pivoter', 'घुमाएँ', '旋转'],
  'menu.transform.scale': ['Escalar', 'Scale', 'Skalieren', 'Mettre à l’échelle', 'स्केल करें', '缩放'],
  'menu.transform.resetRotation': ['Restablecer rotación', 'Reset rotation', 'Drehung zurücksetzen', 'Réinitialiser la rotation', 'घुमाव रीसेट करें', '重置旋转'],
  'menu.transform.resetScale': ['Restablecer escala', 'Reset scale', 'Skalierung zurücksetzen', 'Réinitialiser l’échelle', 'स्केल रीसेट करें', '重置缩放'],
  'toast.rotationReset': ['Rotación restablecida', 'Rotation reset', 'Drehung zurückgesetzt', 'Rotation réinitialisée', 'घुमाव रीसेट हुआ', '旋转已重置'],
  'toast.scaleReset': ['Escala restablecida', 'Scale reset', 'Skalierung zurückgesetzt', 'Échelle réinitialisée', 'स्केल रीसेट हुआ', '缩放已重置'],
  'menu.align': ['Alinear y distribuir', 'Align and distribute', 'Ausrichten und verteilen', 'Aligner et répartir', 'संरेखित और वितरित करें', '对齐与分布'],
  'menu.align.needTwo': [
    'Selecciona 2 o más objetos para alinear o distribuir',
    'Select 2 or more objects to align or distribute',
    'Wähle 2 oder mehr Objekte zum Ausrichten oder Verteilen',
    'Sélectionne 2 objets ou plus pour aligner ou répartir',
    'संरेखित या वितरित करने के लिए 2 या अधिक ऑब्जेक्ट चुनें',
    '请选择 2 个或更多对象以对齐或分布',
  ],
  'menu.more': ['Más', 'More', 'Mehr', 'Plus', 'और', '更多'],
  'menu.more.tip': ['Reemplazar por archivo, exportar la selección, ocultar', 'Replace from file, export the selection, hide', 'Aus Datei ersetzen, Auswahl exportieren, ausblenden', 'Remplacer par un fichier, exporter la sélection, masquer', 'फ़ाइल से बदलें, चयन निर्यात करें, छिपाएँ', '用文件替换、导出所选、隐藏'],
  'menu.more.replace': ['Reemplazar por archivo…', 'Replace with file…', 'Durch Datei ersetzen…', 'Remplacer par un fichier…', 'फ़ाइल से बदलें…', '用文件替换…'],
  'menu.more.replace.tip': [
    'Cambia la geometría del objeto por la de un STL, 3MF u OBJ y conserva nombre, posición, rotación, color y tipo',
    'Swaps the object’s geometry for an STL, 3MF or OBJ and keeps its name, position, rotation, color and type',
    'Tauscht die Geometrie des Objekts gegen eine STL-, 3MF- oder OBJ-Datei und behält Name, Position, Drehung, Farbe und Typ',
    'Remplace la géométrie de l’objet par celle d’un STL, 3MF ou OBJ et garde nom, position, rotation, couleur et type',
    'ऑब्जेक्ट की ज्यामिति को STL, 3MF या OBJ से बदलता है; नाम, स्थिति, घुमाव, रंग और प्रकार रहते हैं',
    '用 STL、3MF 或 OBJ 替换对象的几何体,保留名称、位置、旋转、颜色和类型',
  ],
  'toast.replaced': ['Geometría reemplazada: {name}', 'Geometry replaced: {name}', 'Geometrie ersetzt: {name}', 'Géométrie remplacée : {name}', 'ज्यामिति बदली गई: {name}', '已替换几何体:{name}'],
  'toast.replaced.sizeChanged': [
    'El tamaño cambió {percent} % respecto del modelo anterior.',
    'The size changed by {percent} % from the previous model.',
    'Die Größe hat sich um {percent} % gegenüber dem vorherigen Modell geändert.',
    'La taille a changé de {percent} % par rapport au modèle précédent.',
    'आकार पिछले मॉडल से {percent} % बदल गया।',
    '尺寸与之前的模型相比变化了 {percent} %。',
  ],
  'toast.replaced.manyParts': [
    'El archivo tiene {count} piezas: se usó la primera. Impórtalo como objeto nuevo para conservar todas.',
    'The file has {count} parts: the first one was used. Import it as a new object to keep them all.',
    'Die Datei hat {count} Teile: das erste wurde verwendet. Importiere sie als neues Objekt, um alle zu behalten.',
    'Le fichier a {count} pièces : la première a été utilisée. Importe-le comme nouvel objet pour toutes les garder.',
    'फ़ाइल में {count} भाग हैं: पहला उपयोग हुआ। सभी रखने के लिए इसे नए ऑब्जेक्ट के रूप में आयात करें।',
    '文件有 {count} 个部件:已使用第一个。如需全部保留,请作为新对象导入。',
  ],
  'menu.more.exportStl': ['Exportar selección como un STL…', 'Export selection as one STL…', 'Auswahl als eine STL exportieren…', 'Exporter la sélection en un STL…', 'चयन को एक STL के रूप में निर्यात करें…', '将所选导出为一个 STL…'],
  'menu.more.exportStl.tip': [
    'Abre la exportación con la selección y el formato STL ya elegidos',
    'Opens the export with the selection and the STL format already chosen',
    'Öffnet den Export mit gewählter Auswahl und STL-Format',
    'Ouvre l’export avec la sélection et le format STL déjà choisis',
    'चयन और STL प्रारूप पहले से चुने हुए निर्यात खोलता है',
    '打开导出,并已选定所选对象和 STL 格式',
  ],
  'menu.more.exportStl.none': [
    'No hay sólidos visibles en la selección: los negativos y los ocultos no se exportan',
    'There are no visible solids in the selection: negatives and hidden objects are not exported',
    'Die Auswahl enthält keine sichtbaren Volumenkörper: Negative und ausgeblendete Objekte werden nicht exportiert',
    'Aucun solide visible dans la sélection : les négatifs et les objets masqués ne sont pas exportés',
    'चयन में कोई दृश्यमान ठोस नहीं है: नेगेटिव और छिपे ऑब्जेक्ट निर्यात नहीं होते',
    '所选内容中没有可见的实体:负形和隐藏的对象不会导出',
  ],
  'menu.more.hide': ['Ocultar (no se exporta)', 'Hide (not exported)', 'Ausblenden (nicht exportiert)', 'Masquer (non exporté)', 'छिपाएँ (निर्यात नहीं होता)', '隐藏(不导出)'],
  'menu.more.hide.tip': [
    'Un objeto oculto no se ve en el visor ni se exporta. Vuelve a mostrarlo con el ojo de la lista de escena',
    'A hidden object is neither shown in the viewport nor exported. Show it again with the eye in the scene list',
    'Ein ausgeblendetes Objekt wird weder im Viewport angezeigt noch exportiert. Mit dem Auge in der Szenenliste wieder einblenden',
    'Un objet masqué n’apparaît pas dans la vue et n’est pas exporté. Réaffiche-le avec l’œil de la liste de la scène',
    'छिपा ऑब्जेक्ट न दिखता है न निर्यात होता है। दृश्य सूची की आँख से फिर दिखाएँ',
    '隐藏的对象不会显示在视图中,也不会导出。可用场景列表中的眼睛图标重新显示',
  ],
  'import.heavy': [
    'Este modelo tiene {tris} triángulos y puede ir lento.',
    'This model has {tris} triangles and may run slowly.',
    'Dieses Modell hat {tris} Dreiecke und kann langsam laufen.',
    'Ce modèle a {tris} triangles et peut être lent.',
    'इस मॉडल में {tris} त्रिभुज हैं और यह धीमा चल सकता है।',
    '此模型有 {tris} 个三角形,可能运行缓慢。',
  ],
  'import.heavy.huge': [
    'Este modelo tiene {tris} triángulos, más de un millón: se verá lento y los laminadores también lo advierten. Simplificarlo suele bastar para imprimir.',
    'This model has {tris} triangles, over a million: it will feel slow and slicers warn about this too. Simplifying it is usually enough for printing.',
    'Dieses Modell hat {tris} Dreiecke, mehr als eine Million: Es wird langsam laufen, und auch Slicer warnen davor. Vereinfachen reicht zum Drucken meist aus.',
    'Ce modèle a {tris} triangles, plus d’un million : il sera lent et les logiciels de découpe le signalent aussi. Le simplifier suffit souvent pour imprimer.',
    'इस मॉडल में {tris} त्रिभुज हैं, दस लाख से अधिक: यह धीमा चलेगा और स्लाइसर भी इसकी चेतावनी देते हैं। प्रिंट के लिए अक्सर इसे सरल करना काफ़ी होता है।',
    '此模型有 {tris} 个三角形,超过一百万:运行会很慢,切片软件也会对此提示。打印前通常简化一下就够了。',
  ],
  'import.heavy.total': [
    'Lo importado suma {tris} triángulos, más de un millón: puede ir lento. Puedes simplificar la pieza más pesada.',
    'The imported files add up to {tris} triangles, over a million: it may run slowly. You can simplify the heaviest part.',
    'Das Importierte ergibt zusammen {tris} Dreiecke, mehr als eine Million: Es kann langsam laufen. Du kannst das schwerste Teil vereinfachen.',
    'Les éléments importés totalisent {tris} triangles, plus d’un million : cela peut être lent. Tu peux simplifier la pièce la plus lourde.',
    'आयात किए गए मॉडल मिलाकर {tris} त्रिभुज हैं, दस लाख से अधिक: यह धीमा चल सकता है। आप सबसे भारी भाग को सरल कर सकते हैं।',
    '导入内容合计 {tris} 个三角形,超过一百万:可能运行缓慢。可以简化最重的那个零件。',
  ],
  'import.heavy.action': ['Simplificar…', 'Simplify…', 'Vereinfachen…', 'Simplifier…', 'सरल करें…', '简化…'],
} as const satisfies Record<string, Row>;

type MenuIdeasKey = keyof typeof MENU_IDEAS_TABLE;

const pick = (index: number): Record<MenuIdeasKey, string> =>
  Object.fromEntries(Object.entries(MENU_IDEAS_TABLE).map(([key, row]) => [key, row[index]])) as Record<MenuIdeasKey, string>;

export const MENU_IDEAS_ES = pick(0);
export const MENU_IDEAS_EN = pick(1);
export const MENU_IDEAS_DE = pick(2);
export const MENU_IDEAS_FR = pick(3);
export const MENU_IDEAS_HI = pick(4);
export const MENU_IDEAS_ZH = pick(5);
