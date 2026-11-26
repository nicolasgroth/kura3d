/**
 * @file src/i18n/locales/placasVista.ts
 * @description Textos de la interfaz de placas (lote P2 «Placas a la vista») en los 6 idiomas: tira de placas
 * sobre la barra de estado, crear/borrar/renombrar, «Solo esta», «Mover a placa», aviso de fuera de volumen por
 * placa, aviso de placas solapadas al abrir y pasos de placas en el historial. Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const PLATES_VIEW_TABLE = {
  // Tira de placas.
  'plates.strip.label': ['Placas de impresión', 'Print plates', 'Druckplatten', 'Plateaux d’impression', 'प्रिंट प्लेटें', '打印板'],
  'plates.chip.pieces': ['{count} {count?pieza|piezas}', '{count} {count?part|parts}', '{count} {count?Teil|Teile}', '{count} {count?pièce|pièces}', '{count} {count?हिस्सा|हिस्से}', '{count} 个零件'],
  'plates.chip.label': ['{name}: {pieces}, {status}', '{name}: {pieces}, {status}', '{name}: {pieces}, {status}', '{name} : {pieces}, {status}', '{name}: {pieces}, {status}', '{name}:{pieces},{status}'],
  'plates.chip.tip': [
    'Hacer activa «{name}». Doble clic o F2 para renombrarla',
    'Make “{name}” the active plate. Double-click or F2 to rename it',
    '„{name}“ zur aktiven Platte machen. Doppelklick oder F2 zum Umbenennen',
    'Activer « {name} ». Double-clic ou F2 pour la renommer',
    '“{name}” को सक्रिय प्लेट बनाएँ। नाम बदलने के लिए डबल-क्लिक या F2',
    '将“{name}”设为当前板。双击或按 F2 重命名',
  ],
  'plates.status.ok': ['Bien', 'OK', 'In Ordnung', 'Correct', 'ठीक', '正常'],
  'plates.status.out': ['Fuera de volumen', 'Out of volume', 'Außerhalb des Volumens', 'Hors volume', 'वॉल्यूम से बाहर', '超出体积'],
  'plates.status.empty': ['Vacía', 'Empty', 'Leer', 'Vide', 'खाली', '空'],
  'plates.rename.label': ['Nombre de la placa', 'Plate name', 'Name der Platte', 'Nom du plateau', 'प्लेट का नाम', '板名称'],
  'plates.add': ['Agregar placa', 'Add plate', 'Platte hinzufügen', 'Ajouter un plateau', 'प्लेट जोड़ें', '添加打印板'],
  'plates.add.tip': ['Crea una placa nueva y la deja activa', 'Creates a new plate and makes it active', 'Erstellt eine neue Platte und aktiviert sie', 'Crée un nouveau plateau et l’active', 'नई प्लेट बनाकर उसे सक्रिय करती है', '新建一块打印板并设为当前板'],
  'plates.addFirst': ['+ Placa', '+ Plate', '+ Platte', '+ Plateau', '+ प्लेट', '+ 打印板'],
  'plates.addFirst.tip': [
    'Crea una segunda placa para repartir las piezas',
    'Creates a second plate to spread the parts over',
    'Erstellt eine zweite Platte, um die Teile zu verteilen',
    'Crée un second plateau pour répartir les pièces',
    'हिस्सों को बाँटने के लिए दूसरी प्लेट बनाती है',
    '新建第二块打印板,用于分配零件',
  ],
  'plates.solo': ['Solo esta', 'Only this', 'Nur diese', 'Seulement celui-ci', 'सिर्फ़ यह', '仅此板'],
  'plates.solo.tip': [
    'Muestra solo la cama de la placa activa',
    'Shows only the bed of the active plate',
    'Zeigt nur das Bett der aktiven Platte',
    'Affiche seulement le plateau actif',
    'सिर्फ़ सक्रिय प्लेट का बेड दिखाती है',
    '只显示当前板的热床',
  ],
  'plates.delete': ['Borrar placa «{name}»', 'Delete plate “{name}”', 'Platte „{name}“ löschen', 'Supprimer le plateau « {name} »', '“{name}” प्लेट हटाएँ', '删除打印板“{name}”'],
  'plates.delete.title': ['Borrar la placa', 'Delete the plate', 'Platte löschen', 'Supprimer le plateau', 'प्लेट हटाएँ', '删除打印板'],
  'plates.delete.message': [
    'La placa «{name}» tiene {count} {count?pieza: pasa|piezas: pasan} a «{target}», en el mismo lugar relativo.',
    'Plate “{name}” has {count} {count?part: it moves|parts: they move} to “{target}”, in the same relative spot.',
    'Die Platte „{name}“ enthält {count} {count?Teil: es wechselt|Teile: sie wechseln} an derselben relativen Stelle zu „{target}“.',
    'Le plateau « {name} » contient {count} {count?pièce : elle passe|pièces : elles passent} à « {target} », au même endroit relatif.',
    '“{name}” प्लेट में {count} {count?हिस्सा है: वह|हिस्से हैं: वे} उसी सापेक्ष जगह पर “{target}” में {count?चला जाता है|चले जाते हैं}।',
    '打印板“{name}”有 {count} 个零件:{count?它|它们}会移到“{target}”的相同相对位置。',
  ],
  'plates.delete.confirm': ['Borrar placa', 'Delete plate', 'Platte löschen', 'Supprimer le plateau', 'प्लेट हटाएँ', '删除打印板'],
  'plates.toast.removed': [
    'Placa «{name}» borrada; sus piezas pasan a «{target}».',
    'Plate “{name}” deleted; its parts moved to “{target}”.',
    'Platte „{name}“ gelöscht; ihre Teile wechseln zu „{target}“.',
    'Plateau « {name} » supprimé ; ses pièces passent à « {target} ».',
    '“{name}” प्लेट हटाई गई; उसके हिस्से “{target}” में चले गए।',
    '已删除打印板“{name}”;其零件已移到“{target}”。',
  ],
  'plates.toast.created': ['{name} creada', '{name} created', '{name} erstellt', '{name} créé', '{name} बनाई गई', '已创建{name}'],
  'plates.badge.label': ['Placa: {name}', 'Plate: {name}', 'Platte: {name}', 'Plateau : {name}', 'प्लेट: {name}', '打印板:{name}'],
  'plates.badge.tip': ['Esta pieza está en «{name}»', 'This part is on “{name}”', 'Dieses Teil liegt auf „{name}“', 'Cette pièce est sur « {name} »', 'यह हिस्सा “{name}” पर है', '此零件位于“{name}”'],
  'plates.inspector.relative': ['Posición respecto de {name}', 'Position relative to {name}', 'Position relativ zu {name}', 'Position par rapport à {name}', '{name} के सापेक्ष स्थिति', '相对于{name}的位置'],
  'plates.inspector.relativeTip': [
    'Con varias placas, X y Z se miden desde el centro de la placa de la pieza; la posición global es la de la escena completa.',
    'With several plates, X and Z are measured from the center of the part’s plate; the global position is the one in the whole scene.',
    'Bei mehreren Platten werden X und Z vom Mittelpunkt der Platte des Teils gemessen; die globale Position gilt für die ganze Szene.',
    'Avec plusieurs plateaux, X et Z se mesurent depuis le centre du plateau de la pièce ; la position globale est celle de toute la scène.',
    'कई प्लेटों के साथ X और Z हिस्से की प्लेट के केंद्र से मापे जाते हैं; वैश्विक स्थिति पूरे दृश्य की होती है।',
    '有多块打印板时，X 和 Z 以零件所在打印板的中心为原点；全局位置指整个场景中的位置。',
  ],
  'plates.toast.moved': [
    '{count} {count?pieza movida|piezas movidas} a «{name}».',
    '{count} {count?part|parts} moved to “{name}”.',
    '{count} {count?Teil|Teile} nach „{name}“ verschoben.',
    '{count} {count?pièce déplacée|pièces déplacées} vers « {name} ».',
    '{count} {count?हिस्सा|हिस्से} “{name}” में ले जाए गए।',
    '已将 {count} 个零件移到“{name}”。',
  ],
  // Mover a placa (menú contextual y paleta de comandos).
  'plates.action.moveToPlate': ['Mover a placa', 'Move to plate', 'Auf Platte verschieben', 'Déplacer vers un plateau', 'प्लेट पर ले जाएँ', '移到打印板'],
  'plates.action.moveToPlate.tip': [
    'Lleva la selección a otra placa, en el mismo lugar relativo',
    'Moves the selection to another plate, in the same relative spot',
    'Verschiebt die Auswahl auf eine andere Platte, an dieselbe relative Stelle',
    'Déplace la sélection vers un autre plateau, au même endroit relatif',
    'चयन को दूसरी प्लेट पर उसी सापेक्ष जगह ले जाता है',
    '把所选零件移到另一块打印板的相同相对位置',
  ],
  'plates.move.new': ['Placa nueva', 'New plate', 'Neue Platte', 'Nouveau plateau', 'नई प्लेट', '新打印板'],
  'plates.move.current': ['{name} (actual)', '{name} (current)', '{name} (aktuell)', '{name} (actuel)', '{name} (वर्तमान)', '{name}(当前)'],
  'plates.move.reason': [
    'Elige al menos una pieza sólida sin bloquear',
    'Pick at least one solid, unlocked part',
    'Wähle mindestens ein festes, nicht gesperrtes Teil',
    'Choisissez au moins une pièce solide non verrouillée',
    'कम से कम एक ठोस, अनलॉक हिस्सा चुनें',
    '请至少选择一个未锁定的实体零件',
  ],
  // «Una placa por objeto» (tira de placas y paleta).
  'plates.action.onePerObject': ['Una placa por objeto', 'One plate per object', 'Eine Platte pro Objekt', 'Un plateau par objet', 'प्रति ऑब्जेक्ट एक प्लेट', '每个对象一块打印板'],
  'plates.action.onePerObject.tip': [
    'Deja cada pieza sólida seleccionada (o todas) en su propia placa, centrada sobre su cama. Crea las placas que falten',
    'Puts each selected solid part (or all of them) on its own plate, centered on its bed. Creates the missing plates',
    'Legt jedes ausgewählte feste Teil (oder alle) auf eine eigene Platte, mittig auf dem Druckbett. Fehlende Platten werden angelegt',
    'Place chaque pièce solide sélectionnée (ou toutes) sur son propre plateau, centrée sur son lit. Crée les plateaux manquants',
    'चुने गए हर ठोस हिस्से (या सभी) को उसकी अपनी प्लेट पर, बेड के बीच में रखता है। जो प्लेटें कम हों उन्हें बनाता है',
    '把所选的每个实体零件（或全部）放到各自的打印板中央，并创建缺少的打印板',
  ],
  'plates.spread.reason': [
    'Elige al menos dos piezas sólidas sin bloquear (o no selecciones nada para usar todas)',
    'Pick at least two solid, unlocked parts (or select nothing to use all of them)',
    'Wähle mindestens zwei feste, nicht gesperrte Teile (oder nichts, um alle zu nehmen)',
    'Choisissez au moins deux pièces solides non verrouillées (ou aucune pour prendre toutes)',
    'कम से कम दो ठोस, अनलॉक हिस्से चुनें (या सभी के लिए कुछ न चुनें)',
    '请至少选择两个未锁定的实体零件（不选则使用全部）',
  ],
  'plates.toast.spread': [
    '{count} piezas repartidas, una por placa. Placas nuevas: {created}',
    '{count} parts spread, one per plate. New plates: {created}',
    '{count} Teile verteilt, eines pro Platte. Neue Platten: {created}',
    '{count} pièces réparties, une par plateau. Nouveaux plateaux : {created}',
    '{count} हिस्से बाँटे गए, प्रति प्लेट एक। नई प्लेटें: {created}',
    '已把 {count} 个零件分到各自的打印板。新建打印板：{created}',
  ],
  // Aviso de fuera de volumen por placa.
  'plates.oob.where': ['en {names}', 'on {names}', 'auf {names}', 'sur {names}', '{names} पर', '位于 {names}'],
  // Aviso «no cabe» de Dividir con varias placas: nombra la placa de la pieza.
  'plates.split.notice': [
    'No cabe en la cama de «{plate}» ({size} mm).',
    'Does not fit the bed of “{plate}” ({size} mm).',
    'Passt nicht aufs Druckbett von „{plate}“ ({size} mm).',
    'Ne tient pas sur le plateau « {plate} » ({size} mm).',
    '“{plate}” के बेड में नहीं समाता ({size} mm)।',
    '放不进“{plate}”的打印平台（{size} mm）。',
  ],
  // Pasos de placas en el historial de deshacer.
  'plates.history.create': ['Crear placa «{name}»', 'Create plate “{name}”', 'Platte „{name}“ erstellen', 'Créer le plateau « {name} »', '“{name}” प्लेट बनाएँ', '创建打印板“{name}”'],
  'plates.history.delete': ['Borrar placa «{name}»', 'Delete plate “{name}”', 'Platte „{name}“ löschen', 'Supprimer le plateau « {name} »', '“{name}” प्लेट हटाएँ', '删除打印板“{name}”'],
  'plates.history.rename': ['Renombrar placa «{name}»', 'Rename plate “{name}”', 'Platte „{name}“ umbenennen', 'Renommer le plateau « {name} »', '“{name}” प्लेट का नाम बदलें', '重命名打印板“{name}”'],
  'plates.history.move.one': ['Mover «{piece}» a «{name}»', 'Move “{piece}” to “{name}”', '„{piece}“ nach „{name}“ verschieben', 'Déplacer « {piece} » vers « {name} »', '“{piece}” को “{name}” में ले जाएँ', '将“{piece}”移到“{name}”'],
  'plates.history.move.many': ['Mover {count} piezas a «{name}»', 'Move {count} parts to “{name}”', '{count} Teile nach „{name}“ verschieben', 'Déplacer {count} pièces vers « {name} »', '{count} हिस्से “{name}” में ले जाएँ', '将 {count} 个零件移到“{name}”'],
  'plates.align.noPlate': [
    'No se distribuyó nada: las piezas no están en ninguna placa. Muévelas a una placa primero.',
    'Nothing was arranged: the parts are not on any plate. Move them to a plate first.',
    'Nichts wurde verteilt: Die Teile liegen auf keiner Platte. Verschiebe sie zuerst auf eine Platte.',
    'Rien n’a été réparti : les pièces ne sont sur aucun plateau. Déplacez-les d’abord vers un plateau.',
    'कुछ वितरित नहीं हुआ: हिस्से किसी प्लेट पर नहीं हैं। पहले उन्हें किसी प्लेट पर ले जाएँ।',
    '未做任何分布：这些零件不在任何打印板上。请先将它们移到某块板上。',
  ],
  'plates.overlap.opened': [
    'Hay placas que se pisan: {names}. No se movieron; sepáralas o ajusta su cama antes de imprimir.',
    'Some plates overlap: {names}. They were not moved; separate them or adjust their bed before printing.',
    'Einige Platten überlappen sich: {names}. Sie wurden nicht verschoben; trenne sie oder passe ihr Druckbett vor dem Drucken an.',
    'Certains plateaux se chevauchent : {names}. Ils n’ont pas été déplacés ; séparez-les ou ajustez leur plateau avant d’imprimer.',
    'कुछ प्लेटें एक-दूसरे पर चढ़ी हैं: {names}। उन्हें हिलाया नहीं गया; प्रिंट से पहले उन्हें अलग करें या उनका बेड बदलें।',
    '有打印板相互重叠：{names}。未移动它们；打印前请将其分开或调整其打印平台。',
  ],
} as const satisfies Record<string, Row>;

type PlatesViewKey = keyof typeof PLATES_VIEW_TABLE;

const pick = (index: number): Record<PlatesViewKey, string> =>
  Object.fromEntries(Object.entries(PLATES_VIEW_TABLE).map(([key, row]) => [key, row[index]])) as Record<PlatesViewKey, string>;

export const PLATES_VIEW_ES = pick(0);
export const PLATES_VIEW_EN = pick(1);
export const PLATES_VIEW_DE = pick(2);
export const PLATES_VIEW_FR = pick(3);
export const PLATES_VIEW_HI = pick(4);
export const PLATES_VIEW_ZH = pick(5);
