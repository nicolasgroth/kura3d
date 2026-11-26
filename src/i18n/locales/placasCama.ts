/**
 * @file src/i18n/locales/placasCama.ts
 * @description Textos de la cama por placa y de convertir placas de un laminador en placas reales (lote P7) en los 6
 * idiomas: selector «Cama de esta placa…», aviso en la ficha, historial, avisos al recolocar placas vecinas, oferta al
 * importar un 3MF con placas, acción «Convertir grupos en placas» y errores del bus. Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const PLATES_BED_TABLE = {
  'plates.bed.action': [
    'Cama de {name}…',
    'Bed of {name}…',
    'Druckbett von {name}…',
    'Plateau d’impression de {name}…',
    '{name} का बेड…',
    '{name} 的热床…',
  ],
  'plates.bed.actionTip': [
    'Elige la impresora de esta placa: la del proyecto u otra (dos impresoras).',
    'Choose the printer of this plate: the project one or another (two printers).',
    'Wähle den Drucker dieser Platte: den des Projekts oder einen anderen (zwei Drucker).',
    'Choisis l’imprimante de ce plateau : celle du projet ou une autre (deux imprimantes).',
    'इस प्लेट का प्रिंटर चुनें: प्रोजेक्ट वाला या कोई दूसरा (दो प्रिंटर)।',
    '选择此打印板的打印机：项目的打印机或另一台（两台打印机）。',
  ],
  'plates.bed.dialogTitle': [
    'Cama de {name}',
    'Bed of {name}',
    'Druckbett von {name}',
    'Plateau d’impression de {name}',
    '{name} का बेड',
    '{name} 的热床',
  ],
  'plates.bed.dialogHint': [
    'Cada placa puede usar otra impresora. Fuera de volumen, Repartir, Ajustar a la impresora, Orientar, Dividir y exportar usan la cama de la placa.',
    'Each plate can use another printer. Out of volume, Arrange, Fit to printer, Orient, Split and export use the plate bed.',
    'Jede Platte kann einen anderen Drucker nutzen. Außerhalb des Volumens, Verteilen, An Drucker anpassen, Ausrichten, Teilen und Export nutzen das Druckbett der Platte.',
    'Chaque plateau peut utiliser une autre imprimante. Hors volume, Répartir, Ajuster à l’imprimante, Orienter, Diviser et l’export utilisent le plateau d’impression du plateau.',
    'हर प्लेट दूसरा प्रिंटर इस्तेमाल कर सकती है। वॉल्यूम से बाहर, बाँटना, प्रिंटर में फ़िट करना, ओरिएंट, विभाजन और एक्सपोर्ट प्लेट के बेड का उपयोग करते हैं।',
    '每块打印板都可以使用另一台打印机。超出体积、分配、适配打印机、定向、分割和导出都使用该打印板的热床。',
  ],
  'plates.bed.relocateNote': [
    'Si la cama nueva pisaría a otra placa, esa placa se corre con sus piezas (un solo paso de deshacer).',
    'If the new bed would overlap another plate, that plate moves with its parts (a single undo step).',
    'Würde das neue Druckbett eine andere Platte überlappen, rückt diese mit ihren Teilen weiter (ein einziger Rückgängig-Schritt).',
    'Si le nouveau plateau d’impression chevauchait un autre plateau, celui-ci se déplace avec ses pièces (une seule étape d’annulation).',
    'अगर नया बेड किसी दूसरी प्लेट पर चढ़ेगा, तो वह प्लेट अपने हिस्सों के साथ खिसक जाएगी (एक ही पूर्ववत चरण)।',
    '如果新热床会与另一块打印板重叠，那块打印板会连同其零件一起移开（仅一步撤销）。',
  ],
  'plates.bed.project': [
    'La del proyecto',
    'The project one',
    'Die des Projekts',
    'Celle du projet',
    'प्रोजेक्ट वाला',
    '项目的热床',
  ],
  'plates.bed.current': [
    'Cama actual de la placa (sin perfil en este equipo)',
    'Current plate bed (no profile on this device)',
    'Aktuelles Druckbett der Platte (kein Profil auf diesem Gerät)',
    'Plateau actuel du plateau (aucun profil sur cet appareil)',
    'प्लेट का मौजूदा बेड (इस डिवाइस पर कोई प्रोफ़ाइल नहीं)',
    '打印板当前热床（此设备上无对应配置）',
  ],
  'plates.bed.builtin': [
    'Impresoras incluidas',
    'Included printers',
    'Enthaltene Drucker',
    'Imprimantes incluses',
    'शामिल प्रिंटर',
    '内置打印机',
  ],
  'plates.bed.mine': [
    'Mis camas',
    'My beds',
    'Meine Druckbetten',
    'Mes plateaux',
    'मेरे बेड',
    '我的热床',
  ],
  'plates.bed.mineEmpty': [
    'Aún no tienes camas propias. Se crean en «Ajustar a la impresora» › «Mis camas».',
    'You have no beds of your own yet. Create them in “Fit to printer” › “My beds”.',
    'Du hast noch keine eigenen Druckbetten. Lege sie unter „An Drucker anpassen“ › „Meine Druckbetten“ an.',
    'Tu n’as pas encore de plateaux à toi. Crée-les dans « Ajuster à l’imprimante » › « Mes plateaux ».',
    'अभी आपके अपने कोई बेड नहीं हैं। इन्हें “प्रिंटर में फ़िट करें” › “मेरे बेड” में बनाएँ।',
    '你还没有自己的热床。可在“适配打印机”›“我的热床”中创建。',
  ],
  'plates.bed.dims': [
    '{w} × {d} × {h} mm',
    '{w} × {d} × {h} mm',
    '{w} × {d} × {h} mm',
    '{w} × {d} × {h} mm',
    '{w} × {d} × {h} mm',
    '{w} × {d} × {h} mm',
  ],
  'plates.bed.apply': [
    'Usar esta cama',
    'Use this bed',
    'Dieses Druckbett verwenden',
    'Utiliser ce plateau',
    'यह बेड इस्तेमाल करें',
    '使用此热床',
  ],
  'plates.bed.listLabel': [
    'Camas disponibles',
    'Available beds',
    'Verfügbare Druckbetten',
    'Plateaux disponibles',
    'उपलब्ध बेड',
    '可用热床',
  ],
  'plates.bed.chip': [
    'Cama: {bed}',
    'Bed: {bed}',
    'Druckbett: {bed}',
    'Plateau : {bed}',
    'बेड: {bed}',
    '热床：{bed}',
  ],
  'plates.bed.chipLabel': [
    '{name}, {pieces}, {status}, cama propia {bed}',
    '{name}, {pieces}, {status}, own bed {bed}',
    '{name}, {pieces}, {status}, eigenes Druckbett {bed}',
    '{name}, {pieces}, {status}, plateau propre {bed}',
    '{name}, {pieces}, {status}, अपना बेड {bed}',
    '{name}，{pieces}，{status}，自有热床 {bed}',
  ],
  'plates.bed.toast.set': [
    '{name} usa ahora la cama {bed}.',
    '{name} now uses the {bed} bed.',
    '{name} nutzt jetzt das Druckbett {bed}.',
    '{name} utilise maintenant le plateau {bed}.',
    '{name} अब {bed} बेड इस्तेमाल करती है।',
    '{name} 现在使用 {bed} 热床。',
  ],
  'plates.bed.toast.project': [
    '{name} vuelve a la cama del proyecto.',
    '{name} is back to the project bed.',
    '{name} nutzt wieder das Druckbett des Projekts.',
    '{name} revient au plateau du projet.',
    '{name} फिर से प्रोजेक्ट का बेड इस्तेमाल करती है।',
    '{name} 恢复使用项目热床。',
  ],
  'plates.bed.toast.relocated': [
    'Para no pisarse, cambió de lugar con sus piezas: {names}.',
    'To avoid overlapping, moved with its parts: {names}.',
    'Um Überlappungen zu vermeiden, mit ihren Teilen verschoben: {names}.',
    'Pour éviter un chevauchement, déplacé avec ses pièces : {names}.',
    'टकराव से बचने के लिए अपने हिस्सों के साथ खिसकाया गया: {names}।',
    '为避免重叠，已连同零件移动：{names}。',
  ],
  'plates.bed.toast.keptLocked': [
    'Piezas bloqueadas que quedaron en su lugar (revisa si salen de su cama): {names}.',
    'Locked parts that stayed in place (check whether they leave their bed): {names}.',
    'Gesperrte Teile, die an ihrem Platz blieben (prüfe, ob sie ihr Druckbett verlassen): {names}.',
    'Pièces verrouillées restées en place (vérifie si elles sortent de leur plateau) : {names}.',
    'लॉक किए हिस्से जो अपनी जगह रहे (जाँचें कि वे अपने बेड से बाहर तो नहीं): {names}।',
    '保持原位的锁定零件（请检查是否超出其热床）：{names}。',
  ],
  'plates.bed.toast.failed': [
    'No se pudo cambiar la cama: no queda espacio para recolocar las placas vecinas.',
    'Could not change the bed: there is no room left to move the neighbouring plates.',
    'Druckbett konnte nicht geändert werden: kein Platz, um die benachbarten Platten zu verschieben.',
    'Impossible de changer le plateau : plus de place pour déplacer les plateaux voisins.',
    'बेड नहीं बदला जा सका: पड़ोसी प्लेटों को खिसकाने की जगह नहीं बची।',
    '无法更改热床：没有空间移动相邻的打印板。',
  ],
  'plates.history.bed': [
    'Cama de {name}: {bed}',
    'Bed of {name}: {bed}',
    'Druckbett von {name}: {bed}',
    'Plateau de {name} : {bed}',
    '{name} का बेड: {bed}',
    '{name} 的热床：{bed}',
  ],
  'plates.history.bedProject': [
    'Cama del proyecto en {name}',
    'Project bed on {name}',
    'Druckbett des Projekts auf {name}',
    'Plateau du projet sur {name}',
    '{name} पर प्रोजेक्ट का बेड',
    '{name} 使用项目热床',
  ],
  'plates.history.convert': [
    'Convertir {count} grupos en placas',
    'Convert {count} groups into plates',
    '{count} Gruppen in Platten umwandeln',
    'Convertir {count} groupes en plateaux',
    '{count} समूहों को प्लेटों में बदलें',
    '将 {count} 个组转换为打印板',
  ],
  'plates.convert.action': [
    'Convertir grupos en placas',
    'Convert groups into plates',
    'Gruppen in Platten umwandeln',
    'Convertir les groupes en plateaux',
    'समूहों को प्लेटों में बदलें',
    '将组转换为打印板',
  ],
  'plates.convert.offer': [
    'Convertir en placas',
    'Convert into plates',
    'In Platten umwandeln',
    'Convertir en plateaux',
    'प्लेटों में बदलें',
    '转换为打印板',
  ],
  'plates.convert.done': [
    'Se crearon {count} placas a partir de los grupos; cada grupo quedó centrado en su cama.',
    '{count} plates were created from the groups; each group is centred on its bed.',
    '{count} Platten aus den Gruppen erstellt; jede Gruppe ist auf ihrem Druckbett zentriert.',
    '{count} plateaux créés à partir des groupes ; chaque groupe est centré sur son plateau.',
    'समूहों से {count} प्लेटें बनाई गईं; हर समूह अपने बेड पर बीच में है।',
    '已从组创建 {count} 块打印板；每个组都居中于其热床。',
  ],
  'plates.convert.none': [
    'No hay grupos que convertir: selecciona grupos raíz o usa grupos llamados como placas («Placa 1», «Plate 2»…).',
    'No groups to convert: select root groups or use groups named like plates (“Plate 1”, “Placa 2”…).',
    'Keine Gruppen zum Umwandeln: wähle Hauptgruppen oder nutze wie Platten benannte Gruppen („Platte 1“, „Plate 2“…).',
    'Aucun groupe à convertir : sélectionne des groupes racine ou utilise des groupes nommés comme des plateaux (« Plateau 1 », « Plate 2 »…).',
    'बदलने को कोई समूह नहीं: मूल समूह चुनें या प्लेट जैसे नाम वाले समूह इस्तेमाल करें (“Plate 1”, “प्लेट 2”…)।',
    '没有可转换的组：请选择根组，或使用以打印板命名的组（“Plate 1”“打印板 2”…）。',
  ],
  'plates.convert.assembly': [
    'Convertir grupos en placas está disponible en la vista Imprimir.',
    'Convert groups into plates is available in the Print view.',
    'Gruppen in Platten umwandeln ist in der Ansicht Drucken verfügbar.',
    'Convertir les groupes en plateaux est disponible dans la vue Imprimer.',
    'समूहों को प्लेटों में बदलना प्रिंट दृश्य में उपलब्ध है।',
    '“将组转换为打印板”仅在打印视图中可用。',
  ],
  'plates.convert.skipped': [
    'Grupos que no se convirtieron (tienen piezas bloqueadas o no tienen piezas sólidas): {names}.',
    'Groups not converted (they have locked parts or no solid parts): {names}.',
    'Nicht umgewandelte Gruppen (gesperrte oder keine festen Teile): {names}.',
    'Groupes non convertis (pièces verrouillées ou aucune pièce solide) : {names}.',
    'जो समूह नहीं बदले गए (लॉक हिस्से या कोई ठोस हिस्सा नहीं): {names}।',
    '未转换的组（含锁定零件或没有实体零件）：{names}。',
  ],
  'plates.convert.importOffer': [
    '{name} trae {count} placas del laminador y quedaron como grupos. ¿Convertirlas en placas reales?',
    '{name} has {count} slicer plates; they were imported as groups. Convert them into real plates?',
    '{name} enthält {count} Slicer-Platten; sie wurden als Gruppen importiert. In echte Platten umwandeln?',
    '{name} contient {count} plateaux du trancheur, importés comme groupes. Les convertir en vrais plateaux ?',
    '{name} में स्लाइसर की {count} प्लेटें हैं; वे समूहों के रूप में आईं। असली प्लेटों में बदलें?',
    '{name} 含有 {count} 块切片软件打印板，已作为组导入。转换为真正的打印板吗？',
  ],
  'bus.error.plateBedInvalid': [
    'Cama no válida: indica profileId o widthMm, depthMm y heightMm entre 1 y 10 000 mm (margen 0–50), o project: true.',
    'Invalid bed: give profileId, or widthMm, depthMm and heightMm between 1 and 10,000 mm (margin 0–50), or project: true.',
    'Ungültiges Druckbett: profileId oder widthMm, depthMm und heightMm zwischen 1 und 10.000 mm (Rand 0–50) oder project: true angeben.',
    'Plateau non valide : indique profileId, ou widthMm, depthMm et heightMm entre 1 et 10 000 mm (marge 0–50), ou project: true.',
    'अमान्य बेड: profileId दें, या 1 से 10,000 mm के बीच widthMm, depthMm और heightMm (मार्जिन 0–50), या project: true।',
    '热床无效：请提供 profileId，或 1 到 10000 mm 之间的 widthMm、depthMm、heightMm（边距 0–50），或 project: true。',
  ],
  'bus.error.plateBedProfileNotFound': [
    'No existe el perfil de impresora «{id}».',
    'Printer profile “{id}” does not exist.',
    'Druckerprofil „{id}“ existiert nicht.',
    'Le profil d’imprimante « {id} » n’existe pas.',
    'प्रिंटर प्रोफ़ाइल “{id}” मौजूद नहीं है।',
    '打印机配置“{id}”不存在。',
  ],
  'bus.error.plateBedNoRoom': [
    'No se pudo cambiar la cama: no queda espacio para recolocar las placas vecinas.',
    'Could not change the bed: no room left to move the neighbouring plates.',
    'Druckbett konnte nicht geändert werden: kein Platz für die benachbarten Platten.',
    'Impossible de changer le plateau : plus de place pour les plateaux voisins.',
    'बेड नहीं बदला जा सका: पड़ोसी प्लेटों के लिए जगह नहीं।',
    '无法更改热床：没有空间安置相邻的打印板。',
  ],
} as const satisfies Record<string, Row>;

type PlatesBedKey = keyof typeof PLATES_BED_TABLE;

const pick = (index: number): Record<PlatesBedKey, string> =>
  Object.fromEntries(Object.entries(PLATES_BED_TABLE).map(([key, row]) => [key, row[index]])) as Record<PlatesBedKey, string>;

export const PLATES_BED_ES = pick(0);
export const PLATES_BED_EN = pick(1);
export const PLATES_BED_DE = pick(2);
export const PLATES_BED_FR = pick(3);
export const PLATES_BED_HI = pick(4);
export const PLATES_BED_ZH = pick(5);
