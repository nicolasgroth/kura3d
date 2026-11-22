/**
 * @file src/i18n/locales/groups.ts
 * @description Textos de grupos y organización de la escena en los 6 idiomas: Agrupar, Desagrupar,
 * Combinar en un objeto, Separar cuerpos, árbol de la escena (capas), confirmación al eliminar un
 * grupo, tarjeta del conjunto en el inspector y atajos. Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const GROUPS_TABLE = {
  'groups.defaultName': ['Grupo {n}', 'Group {n}', 'Gruppe {n}', 'Groupe {n}', 'समूह {n}', '组 {n}'],
  'groups.combinedName': ['{name} combinado', '{name} combined', '{name} kombiniert', '{name} combiné', '{name} संयुक्त', '{name} 合并'],
  'inspector.source.combined': ['Objeto combinado', 'Combined object', 'Kombiniertes Objekt', 'Objet combiné', 'संयुक्त ऑब्जेक्ट', '合并对象'],

  'groups.action.group': ['Agrupar', 'Group', 'Gruppieren', 'Grouper', 'समूह बनाएँ', '编组'],
  'groups.action.ungroup': ['Desagrupar', 'Ungroup', 'Gruppierung aufheben', 'Dégrouper', 'समूह हटाएँ', '取消编组'],
  'groups.action.combine': ['Combinar en un objeto', 'Combine into one object', 'Zu einem Objekt kombinieren', 'Combiner en un objet', 'एक ऑब्जेक्ट में मिलाएँ', '合并为一个对象'],
  'groups.action.separate': ['Separar cuerpos', 'Separate bodies', 'Körper trennen', 'Séparer les corps', 'बॉडी अलग करें', '分离实体'],
  'groups.action.group.tip': [
    'Siguen siendo objetos independientes; se seleccionan, mueven y escalan juntos',
    'They stay independent objects; they are selected, moved and scaled together',
    'Sie bleiben eigenständige Objekte; sie werden gemeinsam ausgewählt, verschoben und skaliert',
    'Ils restent des objets indépendants ; ils sont sélectionnés, déplacés et mis à l’échelle ensemble',
    'ये अलग ऑब्जेक्ट ही रहते हैं; साथ में चुने, हिलाए और स्केल किए जाते हैं',
    '仍是独立对象;一起选择、移动和缩放',
  ],
  'groups.action.ungroup.tip': [
    'Deshace el grupo; los objetos quedan como estaban',
    'Removes the group; the objects stay as they were',
    'Löst die Gruppe auf; die Objekte bleiben unverändert',
    'Supprime le groupe ; les objets restent tels quels',
    'समूह हटाता है; ऑब्जेक्ट जैसे थे वैसे रहते हैं',
    '解除编组;对象保持原样',
  ],
  'groups.action.combine.tip': [
    'Un solo objeto con varios cuerpos, sin fundir la geometría; se exporta como un STL',
    'One object with several bodies, without merging the geometry; exports as one STL',
    'Ein Objekt mit mehreren Körpern, ohne die Geometrie zu verschmelzen; Export als eine STL',
    'Un seul objet à plusieurs corps, sans fusionner la géométrie ; s’exporte en un STL',
    'कई बॉडी वाला एक ऑब्जेक्ट, ज्यामिति मिलाए बिना; एक STL के रूप में निर्यात',
    '一个含多个实体的对象,不融合几何;导出为一个 STL',
  ],
  'groups.action.separate.tip': [
    'Divide un objeto con varios cuerpos sueltos en objetos separados',
    'Splits an object with several loose bodies into separate objects',
    'Teilt ein Objekt mit mehreren losen Körpern in getrennte Objekte',
    'Divise un objet à plusieurs corps séparés en objets distincts',
    'कई अलग बॉडी वाले ऑब्जेक्ट को अलग ऑब्जेक्ट में बाँटता है',
    '将含多个分离实体的对象拆成独立对象',
  ],
  'groups.action.union.tip': [
    'Funde la geometría en un sólido (solo se revierte con Deshacer)',
    'Merges the geometry into one solid (only Undo reverts it)',
    'Verschmilzt die Geometrie zu einem Körper (nur Rückgängig macht es ungeschehen)',
    'Fusionne la géométrie en un solide (seul Annuler le défait)',
    'ज्यामिति को एक ठोस में मिलाता है (केवल पूर्ववत से वापस)',
    '将几何融合为一个实体(只能撤销恢复)',
  ],
  'menu.group.organize': ['Organizar', 'Organize', 'Organisieren', 'Organiser', 'व्यवस्थित करें', '整理'],
  'groups.menu.help': [
    'Agrupar: siguen separados · Combinar: un objeto sin fundir · Unir: funde la geometría',
    'Group: they stay separate · Combine: one object, not merged · Union: merges the geometry',
    'Gruppieren: bleiben getrennt · Kombinieren: ein Objekt, nicht verschmolzen · Vereinigen: verschmilzt',
    'Grouper : restent séparés · Combiner : un objet non fusionné · Unir : fusionne la géométrie',
    'समूह: अलग रहते हैं · मिलाएँ: एक ऑब्जेक्ट, बिना जोड़े · जोड़ें: ज्यामिति मिलती है',
    '编组:保持独立 · 合并:一个对象,不融合 · 并集:融合几何',
  ],

  'groups.toast.needSelection': ['Selecciona uno o más objetos', 'Select one or more objects', 'Wähle ein oder mehrere Objekte', 'Sélectionne un ou plusieurs objets', 'एक या अधिक ऑब्जेक्ट चुनें', '请选择一个或多个对象'],
  'groups.toast.locked': ['Hay objetos bloqueados en la selección', 'The selection has locked objects', 'Die Auswahl enthält gesperrte Objekte', 'La sélection contient des objets verrouillés', 'चयन में लॉक ऑब्जेक्ट हैं', '所选内容包含已锁定对象'],
  'groups.toast.lockedUngroup': [
    'Un grupo bloqueado no se desagrupa: desbloquéalo primero',
    'A locked group cannot be ungrouped: unlock it first',
    'Eine gesperrte Gruppe lässt sich nicht auflösen: entsperre sie zuerst',
    'Un groupe verrouillé ne peut pas être dégroupé : déverrouille-le d’abord',
    'लॉक समूह को अलग नहीं किया जा सकता: पहले अनलॉक करें',
    '已锁定的组无法取消编组:请先解锁',
  ],
  'groups.toast.needTwo': ['Selecciona 2 o más objetos para agrupar', 'Select 2 or more objects to group', 'Wähle 2 oder mehr Objekte zum Gruppieren', 'Sélectionne 2 objets ou plus à grouper', 'समूह के लिए 2 या अधिक ऑब्जेक्ट चुनें', '请选择 2 个或以上对象进行编组'],
  'groups.toast.tooDeep': ['No se puede anidar más: máximo 16 niveles', 'Cannot nest further: 16 levels at most', 'Keine tiefere Verschachtelung: höchstens 16 Ebenen', 'Impossible d’imbriquer davantage : 16 niveaux maximum', 'और नेस्ट नहीं हो सकता: अधिकतम 16 स्तर', '无法继续嵌套:最多 16 层'],
  'groups.toast.grouped.one': ['{count} objeto agrupado', '{count} object grouped', '{count} Objekt gruppiert', '{count} objet groupé', '{count} ऑब्जेक्ट समूहित', '已编组 {count} 个对象'],
  'groups.toast.grouped.other': ['{count} objetos agrupados', '{count} objects grouped', '{count} Objekte gruppiert', '{count} objets groupés', '{count} ऑब्जेक्ट समूहित', '已编组 {count} 个对象'],
  'groups.toast.noGroup': ['La selección no está en un grupo', 'The selection is not in a group', 'Die Auswahl ist in keiner Gruppe', 'La sélection n’est dans aucun groupe', 'चयन किसी समूह में नहीं है', '所选内容不在组中'],
  'groups.toast.ungrouped': ['Grupo deshecho', 'Group removed', 'Gruppe aufgelöst', 'Groupe supprimé', 'समूह हटाया गया', '已取消编组'],
  'groups.toast.combineNeedTwo': ['Selecciona 2 o más objetos para combinar', 'Select 2 or more objects to combine', 'Wähle 2 oder mehr Objekte zum Kombinieren', 'Sélectionne 2 objets ou plus à combiner', 'मिलाने के लिए 2 या अधिक ऑब्जेक्ट चुनें', '请选择 2 个或以上对象进行合并'],
  'groups.toast.combineMixed': [
    'No se combinan sólidos con negativos: aplica las restas o combínalos por separado',
    'Solids and negatives are not combined: apply the negatives or combine them separately',
    'Körper und Negative werden nicht kombiniert: wende die Negative an oder kombiniere getrennt',
    'Solides et négatifs ne se combinent pas : applique les négatifs ou combine-les à part',
    'ठोस और नेगेटिव नहीं मिलते: नेगेटिव लागू करें या अलग से मिलाएँ',
    '实体与负体不能合并:请先应用负体,或分别合并',
  ],
  'groups.toast.combined.one': ['{count} objeto combinado en uno', '{count} object combined into one', '{count} Objekt zu einem kombiniert', '{count} objet combiné en un', '{count} ऑब्जेक्ट एक में मिला', '已将 {count} 个对象合并为一个'],
  'groups.toast.combined.other': ['{count} objetos combinados en uno', '{count} objects combined into one', '{count} Objekte zu einem kombiniert', '{count} objets combinés en un', '{count} ऑब्जेक्ट एक में मिले', '已将 {count} 个对象合并为一个'],

  'groups.tree.label': ['Árbol de la escena', 'Scene tree', 'Szenenbaum', 'Arborescence de la scène', 'दृश्य ट्री', '场景树'],
  'groups.tree.members.one': ['{count} objeto', '{count} object', '{count} Objekt', '{count} objet', '{count} ऑब्जेक्ट', '{count} 个对象'],
  'groups.tree.members.other': ['{count} objetos', '{count} objects', '{count} Objekte', '{count} objets', '{count} ऑब्जेक्ट', '{count} 个对象'],
  'groups.tree.splitNode': ['División de {name}', 'Split of {name}', 'Teilung von {name}', 'Découpe de {name}', '{name} का विभाजन', '{name} 的分割'],
  'groups.tree.expand': ['Desplegar', 'Expand', 'Aufklappen', 'Déplier', 'खोलें', '展开'],
  'groups.tree.collapse': ['Plegar', 'Collapse', 'Zuklappen', 'Replier', 'बंद करें', '折叠'],
  'groups.tree.type.group': ['Grupo', 'Group', 'Gruppe', 'Groupe', 'समूह', '组'],
  'groups.tree.type.solid': ['Sólido', 'Solid', 'Körper', 'Solide', 'ठोस', '实体'],
  'groups.tree.type.negative': ['Negativo', 'Negative', 'Negativ', 'Négatif', 'नेगेटिव', '负体'],
  'groups.tree.type.text': ['Texto', 'Text', 'Text', 'Texte', 'टेक्स्ट', '文字'],
  'groups.tree.type.split': ['Pieza de división', 'Split piece', 'Teilstück', 'Pièce de découpe', 'विभाजन का भाग', '分割件'],
  'groups.tree.type.combined': ['Objeto combinado', 'Combined object', 'Kombiniertes Objekt', 'Objet combiné', 'संयुक्त ऑब्जेक्ट', '合并对象'],
  'groups.tree.toggleVisible': ['Mostrar u ocultar el grupo', 'Show or hide the group', 'Gruppe ein- oder ausblenden', 'Afficher ou masquer le groupe', 'समूह दिखाएँ या छिपाएँ', '显示或隐藏组'],
  'groups.tree.toggleLock': ['Bloquear o desbloquear el grupo', 'Lock or unlock the group', 'Gruppe sperren oder entsperren', 'Verrouiller ou déverrouiller le groupe', 'समूह लॉक या अनलॉक करें', '锁定或解锁组'],
  'groups.tree.renameGroup': ['Nombre del grupo', 'Group name', 'Gruppenname', 'Nom du groupe', 'समूह का नाम', '组名称'],
  'groups.tree.hint': [
    '↑/↓ recorren; →/← despliegan, pliegan o suben; Enter selecciona; Mayús+H oculta; Mayús+L bloquea; Alt+↑/↓ reordena; Alt+→ mete en el grupo de arriba; Alt+← saca; arrastra para mover.',
    '↑/↓ move; →/← expand, collapse or go up; Enter selects; Shift+H hides; Shift+L locks; Alt+↑/↓ reorder; Alt+→ puts into the group above; Alt+← takes out; drag to move.',
    '↑/↓ bewegen; →/← auf-, zuklappen oder hoch; Enter wählt; Umschalt+H blendet aus; Umschalt+L sperrt; Alt+↑/↓ ordnet; Alt+→ in die Gruppe darüber; Alt+← heraus; ziehen zum Verschieben.',
    '↑/↓ : parcourir ; →/← : déplier, replier ou remonter ; Entrée : sélectionner ; Maj+H : masquer ; Maj+L : verrouiller ; Alt+↑/↓ : réordonner ; Alt+→ : dans le groupe au-dessus ; Alt+← : sortir ; glisser pour déplacer.',
    '↑/↓ चलाते हैं; →/← खोलें, बंद या ऊपर; Enter चुनता है; Shift+H छिपाता है; Shift+L लॉक करता है; Alt+↑/↓ क्रम; Alt+→ ऊपर के समूह में; Alt+← बाहर; खींचकर ले जाएँ।',
    '↑/↓ 浏览;→/← 展开、折叠或返回上级;Enter 选择;Shift+H 隐藏;Shift+L 锁定;Alt+↑/↓ 排序;Alt+→ 放入上方组;Alt+← 移出;拖动以移动。',
  ],
  'groups.row.hide': ['Ocultar {name}', 'Hide {name}', '{name} ausblenden', 'Masquer {name}', '{name} छिपाएँ', '隐藏 {name}'],
  'groups.row.show': ['Mostrar {name}', 'Show {name}', '{name} einblenden', 'Afficher {name}', '{name} दिखाएँ', '显示 {name}'],
  'groups.row.lock': ['Bloquear {name}', 'Lock {name}', '{name} sperren', 'Verrouiller {name}', '{name} लॉक करें', '锁定 {name}'],
  'groups.row.unlock': ['Desbloquear {name}', 'Unlock {name}', '{name} entsperren', 'Déverrouiller {name}', '{name} अनलॉक करें', '解锁 {name}'],
  'groups.row.drop': ['Bajar {name} a la cama', 'Drop {name} to the bed', '{name} aufs Bett absenken', 'Poser {name} sur le plateau', '{name} को बेड पर रखें', '将 {name} 落到打印床'],
  'groups.row.duplicate': ['Duplicar {name}', 'Duplicate {name}', '{name} duplizieren', 'Dupliquer {name}', '{name} की प्रतिलिपि', '复制 {name}'],
  'groups.row.delete': ['Eliminar {name}', 'Delete {name}', '{name} löschen', 'Supprimer {name}', '{name} हटाएँ', '删除 {name}'],
  'groups.tree.inside': ['Dentro de «{name}» · Esc sale', 'Inside “{name}” · Esc exits', 'In „{name}“ · Esc verlässt', 'Dans « {name} » · Échap pour sortir', '“{name}” के अंदर · Esc से बाहर', '在“{name}”内 · Esc 退出'],
  'groups.tree.exit': ['Salir del grupo', 'Exit group', 'Gruppe verlassen', 'Sortir du groupe', 'समूह से बाहर', '退出组'],

  'groups.delete.title': ['Eliminar grupo', 'Delete group', 'Gruppe löschen', 'Supprimer le groupe', 'समूह हटाएँ', '删除组'],
  'groups.delete.message.one': [
    'Se eliminará «{name}» con {count} objeto. Puedes deshacerlo.',
    '“{name}” will be deleted with {count} object. You can undo it.',
    '„{name}“ wird mit {count} Objekt gelöscht. Du kannst es rückgängig machen.',
    '« {name} » sera supprimé avec {count} objet. Tu peux annuler.',
    '“{name}” {count} ऑब्जेक्ट के साथ हटेगा। आप पूर्ववत कर सकते हैं।',
    '将删除“{name}”及其 {count} 个对象。可以撤销。',
  ],
  'groups.delete.message.other': [
    'Se eliminará «{name}» con {count} objetos. Puedes deshacerlo.',
    '“{name}” will be deleted with {count} objects. You can undo it.',
    '„{name}“ wird mit {count} Objekten gelöscht. Du kannst es rückgängig machen.',
    '« {name} » sera supprimé avec {count} objets. Tu peux annuler.',
    '“{name}” {count} ऑब्जेक्ट के साथ हटेगा। आप पूर्ववत कर सकते हैं।',
    '将删除“{name}”及其 {count} 个对象。可以撤销。',
  ],
  'groups.delete.confirm': ['Eliminar', 'Delete', 'Löschen', 'Supprimer', 'हटाएँ', '删除'],

  'groups.inspector.title': ['Conjunto', 'Set', 'Gruppe', 'Ensemble', 'सेट', '整体'],
  'groups.inspector.desc': [
    'Mover, girar y escalar aplican a todo el conjunto: gira en torno al centro de su caja y escala desde su base',
    'Move, rotate and scale apply to the whole set: it rotates around the center of its box and scales from its base',
    'Verschieben, Drehen und Skalieren gelten für die ganze Gruppe: Drehung um die Mitte ihrer Box, Skalierung ab ihrer Basis',
    'Déplacer, pivoter et mettre à l’échelle s’appliquent à tout l’ensemble : rotation autour du centre de sa boîte, échelle depuis sa base',
    'हिलाना, घुमाना और स्केल पूरे सेट पर: घुमाव बॉक्स के केंद्र से, स्केल उसके आधार से',
    '移动、旋转和缩放作用于整体:绕包围盒中心旋转,从底部缩放',
  ],
  'groups.inspector.move': ['Mover (mm)', 'Move (mm)', 'Verschieben (mm)', 'Déplacer (mm)', 'हिलाएँ (mm)', '移动(mm)'],
  'groups.inspector.rotate': ['Girar en Z (°)', 'Rotate around Z (°)', 'Um Z drehen (°)', 'Pivoter autour de Z (°)', 'Z पर घुमाएँ (°)', '绕 Z 旋转(°)'],
  'groups.inspector.scale': ['Escala proporcional (%)', 'Proportional scale (%)', 'Proportionale Skalierung (%)', 'Échelle proportionnelle (%)', 'आनुपातिक स्केल (%)', '等比缩放(%)'],
  'groups.inspector.apply': ['Aplicar', 'Apply', 'Anwenden', 'Appliquer', 'लागू करें', '应用'],
  'groups.inspector.applyMove': ['Mover el conjunto', 'Move the set', 'Gruppe verschieben', 'Déplacer l’ensemble', 'सेट हिलाएँ', '移动整体'],
  'groups.inspector.applyRotate': ['Girar el conjunto', 'Rotate the set', 'Gruppe drehen', 'Pivoter l’ensemble', 'सेट घुमाएँ', '旋转整体'],
  'groups.inspector.applyScale': ['Escalar el conjunto', 'Scale the set', 'Gruppe skalieren', 'Mettre l’ensemble à l’échelle', 'सेट स्केल करें', '缩放整体'],

  'groups.export.legend': ['Grupo «{name}»', 'Group “{name}”', 'Gruppe „{name}“', 'Groupe « {name} »', 'समूह “{name}”', '组“{name}”'],
  'groups.export.single': ['Un archivo con todo el grupo', 'One file with the whole group', 'Eine Datei mit der ganzen Gruppe', 'Un fichier avec tout le groupe', 'पूरे समूह की एक फ़ाइल', '整个组一个文件'],
  'groups.export.perObject': ['Un archivo por objeto (ZIP)', 'One file per object (ZIP)', 'Eine Datei pro Objekt (ZIP)', 'Un fichier par objet (ZIP)', 'हर ऑब्जेक्ट की एक फ़ाइल (ZIP)', '每个对象一个文件(ZIP)'],
  'dialog.shortcuts.group': ['Agrupar la selección', 'Group the selection', 'Auswahl gruppieren', 'Grouper la sélection', 'चयन को समूह बनाएँ', '编组所选'],
  'dialog.shortcuts.ungroup': ['Desagrupar', 'Ungroup', 'Gruppierung aufheben', 'Dégrouper', 'समूह हटाएँ', '取消编组'],
  'dialog.shortcuts.enterGroup': ['Entrar al grupo (doble clic) / salir (Esc)', 'Enter the group (double-click) / exit (Esc)', 'Gruppe betreten (Doppelklick) / verlassen (Esc)', 'Entrer dans le groupe (double-clic) / sortir (Échap)', 'समूह में जाएँ (डबल-क्लिक) / बाहर (Esc)', '进入组(双击)/ 退出(Esc)'],
} as const satisfies Record<string, Row>;

type GroupsKey = keyof typeof GROUPS_TABLE;

const pick = (index: number): Record<GroupsKey, string> =>
  Object.fromEntries(Object.entries(GROUPS_TABLE).map(([key, row]) => [key, row[index]])) as Record<GroupsKey, string>;

export const GROUPS_ES = pick(0);
export const GROUPS_EN = pick(1);
export const GROUPS_DE = pick(2);
export const GROUPS_FR = pick(3);
export const GROUPS_HI = pick(4);
export const GROUPS_ZH = pick(5);
