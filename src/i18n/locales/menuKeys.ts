/**
 * @file src/i18n/locales/menuKeys.ts
 * @description Textos del menú contextual ordenado (Agregar, Tipo, Geometría, Analizar, Objeto), de la
 * búsqueda en la escena (F3), de repetir la última acción (F4), de recalcular (F5) y de F2/atajos, en
 * los 6 idiomas. Se define por clave con sus 6 traducciones [es, en, de, fr, hi, zh] y se mezcla en
 * cada diccionario de `translations.ts` y `locales/*.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const MENU_TABLE = {
  'menu.label': ['Menú del objeto {name}', 'Menu for object {name}', 'Menü für Objekt {name}', 'Menu de l’objet {name}', 'ऑब्जेक्ट {name} का मेनू', '对象 {name} 的菜单'],
  'menu.bg.label': ['Menú de la escena', 'Scene menu', 'Szenenmenü', 'Menu de la scène', 'दृश्य मेनू', '场景菜单'],
  'menu.group.add': ['Agregar', 'Add', 'Hinzufügen', 'Ajouter', 'जोड़ें', '添加'],
  'menu.group.type': ['Tipo', 'Type', 'Typ', 'Type', 'प्रकार', '类型'],
  'menu.group.geometry': ['Geometría', 'Geometry', 'Geometrie', 'Géométrie', 'ज्यामिति', '几何'],
  'menu.group.analyze': ['Analizar', 'Analyze', 'Analysieren', 'Analyser', 'विश्लेषण', '分析'],
  'menu.group.object': ['Objeto', 'Object', 'Objekt', 'Objet', 'ऑब्जेक्ट', '对象'],
  'menu.group.help': ['Ayuda', 'Help', 'Hilfe', 'Aide', 'सहायता', '帮助'],
  'menu.addPart': ['Agregar pieza', 'Add part', 'Teil hinzufügen', 'Ajouter une pièce', 'भाग जोड़ें', '添加部件'],
  'menu.addPart.tip': ['Agrega un sólido que se suma a este objeto, apoyado sobre su cara superior', 'Adds a solid that joins this object, resting on its top face', 'Fügt einen Volumenkörper hinzu, der auf der Oberseite dieses Objekts aufliegt', 'Ajoute un solide qui s’ajoute à cet objet, posé sur sa face supérieure', 'इस ऑब्जेक्ट में जुड़ने वाला ठोस जोड़ता है, उसकी ऊपरी सतह पर रखा हुआ', '添加与该对象合并的实体,放在其顶面上'],
  'menu.addNegative': ['Agregar pieza negativa', 'Add negative part', 'Negatives Teil hinzufügen', 'Ajouter une pièce négative', 'ऋणात्मक भाग जोड़ें', '添加负形部件'],
  'menu.addNegative.tip': ['Agrega una pieza negativa (resta) centrada en este objeto; muévela y luego aplica las restas', 'Adds a negative part (subtraction) centered on this object; move it and then apply the subtractions', 'Fügt einen abziehenden Hohlkörper in der Mitte dieses Objekts hinzu; verschieben und Abzüge anwenden', 'Ajoute un creux soustractif centré sur cet objet ; déplacez-le puis appliquez les soustractions', 'इस ऑब्जेक्ट के केंद्र में घटाने वाला खोखला भाग जोड़ता है; उसे हिलाएँ और घटाव लागू करें', '在该对象中心添加用于减去的空腔;移动后应用减法'],
  'menu.shape.box': ['Cubo', 'Cube', 'Würfel', 'Cube', 'घन', '立方体'],
  'menu.shape.cylinder': ['Cilindro', 'Cylinder', 'Zylinder', 'Cylindre', 'बेलन', '圆柱体'],
  'menu.shape.sphere': ['Esfera', 'Sphere', 'Kugel', 'Sphère', 'गोला', '球体'],
  'menu.shape.cone': ['Cono', 'Cone', 'Kegel', 'Cône', 'शंकु', '圆锥体'],
  'menu.shape.torus': ['Toroide', 'Torus', 'Torus', 'Tore', 'टोरस', '圆环体'],
  'menu.shape.prism': ['Prisma', 'Prism', 'Prisma', 'Prisme', 'प्रिज़्म', '棱柱'],
  'menu.shape.tube': ['Tubo hueco', 'Hollow tube', 'Hohlrohr', 'Tube creux', 'खोखली नली', '空心管'],
  'menu.shape.text': ['Texto 3D', '3D text', '3D-Text', 'Texte 3D', '3D पाठ', '3D 文字'],
  'menu.shape.svg': ['SVG…', 'SVG…', 'SVG…', 'SVG…', 'SVG…', 'SVG…'],
  'menu.shape.import': ['Importar STL/3MF…', 'Import STL/3MF…', 'STL/3MF importieren…', 'Importer STL/3MF…', 'STL/3MF आयात करें…', '导入 STL/3MF…'],
  'menu.changeType': ['Convertir en', 'Convert to', 'Umwandeln in', 'Convertir en', 'में बदलें', '转换为'],
  'menu.changeType.tip': ['Sólido (se imprime), Negativo (se resta de los sólidos) o Referencia (se ve, no se imprime); H alterna Sólido / Negativo', 'Solid (printed), Negative (cutter) or Reference (visible, never printed); H toggles Solid / Negative', 'Volumenkörper (gedruckt), Negativ (Abzug) oder Referenz (sichtbar, nie gedruckt); H wechselt Volumenkörper / Negativ', 'Solide (imprimé), négatif (creux soustractif) ou référence (visible, jamais imprimée) ; H bascule solide / négatif', 'ठोस (मुद्रित), ऋणात्मक (घटाने वाला) या संदर्भ (दिखता है, प्रिंट नहीं होता); H ठोस / ऋणात्मक बदलता है', '实体(打印)、负形(减去的空腔)或参考(可见,不打印);H 在实体 / 负形之间切换'],
  'menu.type.solid': ['Sólido', 'Solid', 'Volumenkörper', 'Solide', 'ठोस', '实体'],
  'menu.type.negative': ['Negativo', 'Negative', 'Negativ', 'Négatif', 'ऋणात्मक', '负形'],
  'menu.type.current': ['actual', 'current', 'aktuell', 'actuel', 'वर्तमान', '当前'],
  'menu.mirror': ['Espejar', 'Mirror', 'Spiegeln', 'Miroir', 'प्रतिबिंबित करें', '镜像'],
  'menu.mirror.axis': ['Eje {axis}', 'Axis {axis}', 'Achse {axis}', 'Axe {axis}', 'अक्ष {axis}', '{axis} 轴'],
  'menu.rename': ['Renombrar', 'Rename', 'Umbenennen', 'Renommer', 'नाम बदलें', '重命名'],
  'menu.recompute': ['Recalcular objeto', 'Recompute object', 'Objekt neu berechnen', 'Recalculer l’objet', 'ऑब्जेक्ट पुनर्गणना', '重新计算对象'],
  'menu.recompute.tip': ['Regenera la geometría paramétrica del objeto seleccionado', 'Regenerates the geometry of the selected parametric object', 'Erzeugt die Geometrie des gewählten parametrischen Objekts neu', 'Régénère la géométrie de l’objet paramétrique sélectionné', 'चयनित पैरामीट्रिक ऑब्जेक्ट की ज्यामिति पुनः बनाता है', '重新生成所选参数化对象的几何'],
  'menu.recompute.done': ['Recalculado: {count}', 'Recomputed: {count}', 'Neu berechnet: {count}', 'Recalculé : {count}', 'पुनर्गणना: {count}', '已重新计算:{count}'],
  'menu.recompute.none': ['Selecciona una primitiva o rosca paramétrica para recalcularla.', 'Select a parametric primitive or thread to recompute it.', 'Wähle ein parametrisches Primitiv oder Gewinde zum Neuberechnen.', 'Sélectionnez une primitive ou un filetage paramétrique à recalculer.', 'पुनर्गणना के लिए पैरामीट्रिक आकृति या थ्रेड चुनें।', '请选择参数化图元或螺纹以重新计算。'],
  'menu.rename.none': ['Selecciona un objeto desbloqueado para renombrarlo.', 'Select an unlocked object to rename it.', 'Wähle ein entsperrtes Objekt zum Umbenennen.', 'Sélectionnez un objet déverrouillé à renommer.', 'नाम बदलने के लिए अनलॉक ऑब्जेक्ट चुनें।', '请选择未锁定的对象进行重命名。'],
  'menu.bg.add': ['Agregar forma', 'Add shape', 'Form hinzufügen', 'Ajouter une forme', 'आकृति जोड़ें', '添加形状'],
  'menu.bg.addTip': ['Agrega una forma en un lugar libre de la cama', 'Adds a shape in a free spot on the bed', 'Fügt eine Form an einer freien Stelle des Druckbetts hinzu', 'Ajoute une forme à un emplacement libre du plateau', 'बेड पर खाली जगह में आकृति जोड़ता है', '在打印床的空闲位置添加形状'],
  'repeat.label': ['Repetir: {name}', 'Repeat: {name}', 'Wiederholen: {name}', 'Répéter : {name}', 'दोहराएँ: {name}', '重复:{name}'],
  'repeat.tip': ['Repite la última acción sobre la selección actual (F4)', 'Repeats the last action on the current selection (F4)', 'Wiederholt die letzte Aktion auf der aktuellen Auswahl (F4)', 'Répète la dernière action sur la sélection actuelle (F4)', 'वर्तमान चयन पर अंतिम क्रिया दोहराता है (F4)', '对当前选择重复上一次操作(F4)'],
  'repeat.none': ['No hay una acción para repetir todavía.', 'There is no action to repeat yet.', 'Es gibt noch keine Aktion zum Wiederholen.', 'Il n’y a pas encore d’action à répéter.', 'अभी दोहराने के लिए कोई क्रिया नहीं है।', '还没有可重复的操作。'],
  'repeat.notApplicable': ['«{name}» no se aplica a la selección actual.', '“{name}” does not apply to the current selection.', '„{name}“ ist auf die aktuelle Auswahl nicht anwendbar.', '« {name} » ne s’applique pas à la sélection actuelle.', '“{name}” वर्तमान चयन पर लागू नहीं होता।', '“{name}”不适用于当前选择。'],
  'repeat.name.duplicate': ['Duplicar', 'Duplicate', 'Duplizieren', 'Dupliquer', 'डुप्लिकेट करें', '复制'],
  'repeat.name.move': ['Mover', 'Move', 'Verschieben', 'Déplacer', 'हिलाएँ', '移动'],
  'repeat.name.rotate': ['Rotar', 'Rotate', 'Drehen', 'Pivoter', 'घुमाएँ', '旋转'],
  'repeat.name.scale': ['Escalar', 'Scale', 'Skalieren', 'Mettre à l’échelle', 'स्केल करें', '缩放'],
  'repeat.name.hollow': ['Ahuecar ({mm} mm)', 'Hollow ({mm} mm)', 'Aushöhlen ({mm} mm)', 'Évider ({mm} mm)', 'खोखला करें ({mm} मिमी)', '抽壳({mm} mm)'],
  'repeat.name.mirror': ['Espejar (eje {axis})', 'Mirror (axis {axis})', 'Spiegeln (Achse {axis})', 'Miroir (axe {axis})', 'प्रतिबिंब (अक्ष {axis})', '镜像({axis} 轴)'],
  'repeat.name.applyHoles': ['Aplicar restas', 'Apply subtractions', 'Abzüge anwenden', 'Appliquer les soustractions', 'घटाव लागू करें', '应用减法'],
  'repeat.name.addPart': ['Agregar pieza: {shape}', 'Add part: {shape}', 'Teil hinzufügen: {shape}', 'Ajouter une pièce : {shape}', 'भाग जोड़ें: {shape}', '添加部件:{shape}'],
  'repeat.name.addNegative': ['Agregar pieza negativa: {shape}', 'Add negative part: {shape}', 'Negatives Teil hinzufügen: {shape}', 'Ajouter une pièce négative : {shape}', 'ऋणात्मक भाग जोड़ें: {shape}', '添加负形部件:{shape}'],
  'repeat.name.simplify': ['Simplificar malla', 'Simplify mesh', 'Netz vereinfachen', 'Simplifier le maillage', 'मेश सरल करें', '简化网格'],
  'repeat.name.color': ['Aplicar color', 'Apply color', 'Farbe anwenden', 'Appliquer la couleur', 'रंग लागू करें', '应用颜色'],
  'repeat.name.setType': ['Cambiar tipo a {type}', 'Change type to {type}', 'Typ ändern zu {type}', 'Changer le type en {type}', 'प्रकार बदलकर {type} करें', '将类型改为 {type}'],
  'scene.search.label': ['Buscar en la escena', 'Search the scene', 'Szene durchsuchen', 'Rechercher dans la scène', 'दृश्य में खोजें', '在场景中搜索'],
  'scene.search.placeholder': ['Buscar objeto…', 'Find object…', 'Objekt suchen…', 'Chercher un objet…', 'ऑब्जेक्ट खोजें…', '查找对象…'],
  'scene.search.tip': ['Filtra por nombre (F3). Enter selecciona y encuadra el primero; F3 pasa al siguiente', 'Filters by name (F3). Enter selects and frames the first; F3 goes to the next', 'Filtert nach Namen (F3). Enter wählt und zeigt den ersten; F3 springt zum nächsten', 'Filtre par nom (F3). Entrée sélectionne et cadre le premier ; F3 passe au suivant', 'नाम से फ़िल्टर करता है (F3)। Enter पहले को चुनता है; F3 अगले पर जाता है', '按名称过滤(F3)。Enter 选中并取景第一个;F3 跳到下一个'],
  'scene.search.clear': ['Borrar búsqueda', 'Clear search', 'Suche löschen', 'Effacer la recherche', 'खोज साफ़ करें', '清除搜索'],
  'scene.search.count': ['{count} de {total} objetos', '{count} of {total} objects', '{count} von {total} Objekten', '{count} objets sur {total}', '{total} में से {count} ऑब्जेक्ट', '{total} 个对象中的 {count} 个'],
  'scene.search.none': ['Sin resultados', 'No results', 'Keine Treffer', 'Aucun résultat', 'कोई परिणाम नहीं', '无结果'],
  'dialog.shortcuts.rename': ['Renombrar el objeto seleccionado', 'Rename the selected object', 'Gewähltes Objekt umbenennen', 'Renommer l’objet sélectionné', 'चयनित ऑब्जेक्ट का नाम बदलें', '重命名所选对象'],
  'dialog.shortcuts.find': ['Buscar en la escena (repetir: siguiente)', 'Search the scene (repeat: next)', 'Szene durchsuchen (erneut: nächster)', 'Rechercher dans la scène (répéter : suivant)', 'दृश्य में खोजें (दोहराएँ: अगला)', '搜索场景(重复:下一个)'],
  'dialog.shortcuts.repeat': ['Repetir la última acción sobre la selección', 'Repeat the last action on the selection', 'Letzte Aktion auf der Auswahl wiederholen', 'Répéter la dernière action sur la sélection', 'चयन पर अंतिम क्रिया दोहराएँ', '对所选内容重复上一次操作'],
  'dialog.shortcuts.recompute': ['Recalcular el paramétrico (F5 solo en escritorio)', 'Recompute the parametric object (F5 desktop only)', 'Parametrisches Objekt neu berechnen (F5 nur Desktop)', 'Recalculer le paramétrique (F5 sur bureau seulement)', 'पैरामीट्रिक पुनर्गणना (F5 केवल डेस्कटॉप)', '重新计算参数化对象(F5 仅桌面版)'],
} as const satisfies Record<string, Row>;

type MenuKey = keyof typeof MENU_TABLE;

const pick = (index: number): Record<MenuKey, string> =>
  Object.fromEntries(Object.entries(MENU_TABLE).map(([key, row]) => [key, row[index]])) as Record<MenuKey, string>;

export const MENU_ES = pick(0);
export const MENU_EN = pick(1);
export const MENU_DE = pick(2);
export const MENU_FR = pick(3);
export const MENU_HI = pick(4);
export const MENU_ZH = pick(5);
