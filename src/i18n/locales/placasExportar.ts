/**
 * @file src/i18n/locales/placasExportar.ts
 * @description Textos de exportar con placas (lote P6) en los 6 idiomas: elección del diálogo de exportación con
 * varias placas (un 3MF con todas o un archivo por placa en ZIP) y qué laminadores entienden cada una, piezas sin
 * placa excluidas, sección «Laminador» (proyecto de ejemplo), ZIP hecho y errores del bus (exportar y comandos de placas del lote P8). Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const PLATES_EXPORT_TABLE = {
  'dialog.export.plates.legend': [
    'Piezas en {count} placas',
    'Parts on {count} plates',
    'Teile auf {count} Platten',
    'Pièces sur {count} plateaux',
    '{count} प्लेटों पर हिस्से',
    '零件分布在 {count} 块打印板上',
  ],
  'dialog.export.plates.combined': [
    'Un 3MF con todas las placas',
    'One 3MF with all plates',
    'Ein 3MF mit allen Platten',
    'Un 3MF avec tous les plateaux',
    'सभी प्लेटों वाली एक 3MF',
    '一个包含所有打印板的 3MF',
  ],
  'dialog.export.plates.combined.hint': [
    'Bambu Studio y OrcaSlicer abren cada placa por separado; PrusaSlicer y Cura ven todas las piezas juntas en una sola cama.',
    'Bambu Studio and OrcaSlicer open each plate separately; PrusaSlicer and Cura see all parts together on a single bed.',
    'Bambu Studio und OrcaSlicer öffnen jede Platte einzeln; PrusaSlicer und Cura sehen alle Teile zusammen auf einem Druckbett.',
    'Bambu Studio et OrcaSlicer ouvrent chaque plateau séparément ; PrusaSlicer et Cura voient toutes les pièces ensemble sur un seul plateau.',
    'Bambu Studio और OrcaSlicer हर प्लेट अलग खोलते हैं; PrusaSlicer और Cura सभी हिस्से एक ही बेड पर साथ देखते हैं।',
    'Bambu Studio 和 OrcaSlicer 会分别打开每块打印板；PrusaSlicer 和 Cura 会把所有零件放在同一块热床上。',
  ],
  'dialog.export.plates.perPlate': [
    'Un archivo por placa (ZIP)',
    'One file per plate (ZIP)',
    'Eine Datei je Platte (ZIP)',
    'Un fichier par plateau (ZIP)',
    'हर प्लेट के लिए एक फ़ाइल (ZIP)',
    '每块打印板一个文件（ZIP）',
  ],
  'dialog.export.plates.perPlate.hint': [
    'Sirve en cualquier laminador: cada archivo trae las piezas de una placa, sobre su cama.',
    'Works in any slicer: each file holds the parts of one plate, on its bed.',
    'Funktioniert in jedem Slicer: Jede Datei enthält die Teile einer Platte auf ihrem Druckbett.',
    'Fonctionne dans tout trancheur : chaque fichier contient les pièces d’un plateau, sur son plateau.',
    'किसी भी स्लाइसर में चलता है: हर फ़ाइल में एक प्लेट के हिस्से उसके बेड पर होते हैं।',
    '适用于任何切片软件：每个文件包含一块打印板的零件，位于其热床上。',
  ],
  'dialog.export.plates.onlyZip': [
    'Se exporta un archivo {format} por placa, en un ZIP, cada uno con sus piezas sobre su cama. Sirve en cualquier laminador. Para tener todas las placas en un solo archivo, elige 3MF.',
    'One {format} file per plate is exported, in a ZIP, each with its parts on its bed. Works in any slicer. To get all plates in a single file, choose 3MF.',
    'Für jede Platte wird eine {format}-Datei in einem ZIP exportiert, jede mit ihren Teilen auf ihrem Druckbett. Funktioniert in jedem Slicer. Für alle Platten in einer Datei wähle 3MF.',
    'Un fichier {format} par plateau est exporté, dans un ZIP, chacun avec ses pièces sur son plateau. Fonctionne dans tout trancheur. Pour tous les plateaux dans un seul fichier, choisissez 3MF.',
    'हर प्लेट के लिए एक {format} फ़ाइल ZIP में निर्यात होती है, हर एक में उसके हिस्से उसके बेड पर। किसी भी स्लाइसर में चलती है। सभी प्लेटें एक फ़ाइल में चाहिए तो 3MF चुनें।',
    '每块打印板导出一个 {format} 文件并打包为 ZIP，每个文件中的零件都位于其热床上。适用于任何切片软件。若要把所有打印板放进一个文件，请选择 3MF。',
  ],
  'dialog.export.plates.excluded': [
    '{count} {count?pieza sin placa queda|piezas sin placa quedan} fuera de la exportación.',
    '{count} {count?part without a plate is|parts without a plate are} left out of the export.',
    '{count} {count?Teil ohne Platte wird|Teile ohne Platte werden} nicht exportiert.',
    '{count} {count?pièce sans plateau est exclue|pièces sans plateau sont exclues} de l’export.',
    'बिना प्लेट के {count} {count?हिस्सा|हिस्से} निर्यात से बाहर रहेंगे।',
    '{count} 个没有打印板的零件不会被导出。',
  ],
  'export.plates.excluded': [
    '{count} {count?pieza sin placa quedó|piezas sin placa quedaron} fuera de la exportación. Muévelas a una placa para incluirlas.',
    '{count} {count?part without a plate was|parts without a plate were} left out of the export. Move them to a plate to include them.',
    '{count} {count?Teil ohne Platte wurde|Teile ohne Platte wurden} nicht exportiert. Verschiebe sie auf eine Platte, um sie einzuschließen.',
    '{count} {count?pièce sans plateau a été exclue|pièces sans plateau ont été exclues} de l’export. Déplacez-les vers un plateau pour les inclure.',
    'बिना प्लेट के {count} {count?हिस्सा|हिस्से} निर्यात से बाहर रहे। शामिल करने के लिए उन्हें किसी प्लेट पर ले जाएँ।',
    '{count} 个没有打印板的零件未被导出。将它们移到某块打印板上即可包含。',
  ],
  'export.plates.otherBed': [
    'El laminador usa una sola cama para todas las placas: {names} {count?tiene|tienen} cama propia y {count?quedó centrada|quedaron centradas} en una placa de {w} × {d} mm (la del proyecto). Revisa que sus piezas quepan.',
    'The slicer uses a single bed for all plates: {names} {count?has its|have their} own bed and {count?was|were} centered on a {w} × {d} mm plate (the project bed). Check that its parts fit.',
    'Der Slicer nutzt ein einziges Druckbett für alle Platten: {names} {count?hat|haben} ein eigenes Druckbett und {count?wurde|wurden} auf einer Platte von {w} × {d} mm (der des Projekts) zentriert. Prüfe, ob die Teile passen.',
    'Le trancheur utilise un seul plateau pour tous : {names} {count?a son|ont leur} propre plateau et {count?a été centré|ont été centrés} sur un plateau de {w} × {d} mm (celui du projet). Vérifiez que les pièces tiennent.',
    'स्लाइसर सभी प्लेटों के लिए एक ही बेड इस्तेमाल करता है: {names} का अपना बेड है और {count?उसे|उन्हें} {w} × {d} mm (प्रोजेक्ट के बेड) की प्लेट के बीच में रखा गया। जाँचें कि हिस्से समा जाएँ।',
    '切片软件对所有打印板只使用一种热床：{names} 有自己的热床，已居中放在 {w} × {d} mm（项目热床）的打印板上。请检查零件是否放得下。',
  ],
  'dialog.export.slicer.legend': [
    'Laminador',
    'Slicer',
    'Slicer',
    'Trancheur',
    'स्लाइसर',
    '切片软件',
  ],
  'dialog.export.slicer.hint': [
    'Para que Bambu Studio, OrcaSlicer o Elegoo Slicer abran el 3MF con sus placas, nombres y colores, carga una vez un proyecto .3mf guardado desde tu laminador. Solo se toman los nombres de impresora, proceso y filamentos. Sin él, el laminador abre todas las piezas en una sola bandeja.',
    'For Bambu Studio, OrcaSlicer or Elegoo Slicer to open the 3MF with its plates, names and colors, load once a .3mf project saved from your slicer. Only the printer, process and filament names are taken. Without it, the slicer opens all parts on a single plate.',
    'Damit Bambu Studio, OrcaSlicer oder Elegoo Slicer das 3MF mit Platten, Namen und Farben öffnen, lade einmal ein aus deinem Slicer gespeichertes .3mf-Projekt. Übernommen werden nur die Namen von Drucker, Prozess und Filamenten. Ohne es öffnet der Slicer alle Teile auf einer einzigen Platte.',
    'Pour que Bambu Studio, OrcaSlicer ou Elegoo Slicer ouvrent le 3MF avec ses plateaux, noms et couleurs, chargez une fois un projet .3mf enregistré depuis votre trancheur. Seuls les noms d’imprimante, de processus et de filaments sont repris. Sans lui, le trancheur ouvre toutes les pièces sur un seul plateau.',
    'Bambu Studio, OrcaSlicer या Elegoo Slicer में 3MF को उसकी प्लेटों, नामों और रंगों के साथ खोलने के लिए, अपने स्लाइसर से सहेजा गया एक .3mf प्रोजेक्ट एक बार लोड करें। सिर्फ़ प्रिंटर, प्रोसेस और फ़िलामेंट के नाम लिए जाते हैं। इसके बिना स्लाइसर सभी हिस्से एक ही प्लेट पर खोलता है।',
    '要让 Bambu Studio、OrcaSlicer 或 Elegoo Slicer 打开 3MF 时保留打印板、名称和颜色，请载入一次从你的切片软件保存的 .3mf 项目。只读取打印机、工艺和耗材的名称。没有它，切片软件会把所有零件放在一块打印板上。',
  ],
  'dialog.export.slicer.loaded': [
    'Proyecto de ejemplo: {printer} · {count} {count?filamento|filamentos}: {filaments}',
    'Sample project: {printer} · {count} {count?filament|filaments}: {filaments}',
    'Beispielprojekt: {printer} · {count} {count?Filament|Filamente}: {filaments}',
    'Projet d’exemple : {printer} · {count} {count?filament|filaments} : {filaments}',
    'नमूना प्रोजेक्ट: {printer} · {count} फ़िलामेंट: {filaments}',
    '示例项目：{printer} · {count} 种耗材：{filaments}',
  ],
  'dialog.export.slicer.none': [
    'No hay proyecto de ejemplo cargado.',
    'No sample project loaded.',
    'Kein Beispielprojekt geladen.',
    'Aucun projet d’exemple chargé.',
    'कोई नमूना प्रोजेक्ट लोड नहीं है।',
    '尚未载入示例项目。',
  ],
  'dialog.export.slicer.load': [
    'Cargar proyecto del laminador…',
    'Load slicer project…',
    'Slicer-Projekt laden…',
    'Charger un projet du trancheur…',
    'स्लाइसर प्रोजेक्ट लोड करें…',
    '载入切片项目…',
  ],
  'dialog.export.slicer.remove': [
    'Quitar proyecto de ejemplo',
    'Remove sample project',
    'Beispielprojekt entfernen',
    'Retirer le projet d’exemple',
    'नमूना प्रोजेक्ट हटाएँ',
    '移除示例项目',
  ],
  'dialog.export.slicer.error.not-3mf': [
    '«{name}» no es un archivo 3MF.',
    '"{name}" is not a 3MF file.',
    '„{name}“ ist keine 3MF-Datei.',
    '« {name} » n’est pas un fichier 3MF.',
    '"{name}" 3MF फ़ाइल नहीं है।',
    '“{name}”不是 3MF 文件。',
  ],
  'dialog.export.slicer.error.no-profile': [
    '«{name}» no trae perfil del laminador. Guárdalo como proyecto desde Bambu Studio, OrcaSlicer o Elegoo Slicer (Archivo > Guardar proyecto) y cárgalo de nuevo.',
    '"{name}" has no slicer profile. Save it as a project from Bambu Studio, OrcaSlicer or Elegoo Slicer (File > Save project) and load it again.',
    '„{name}“ enthält kein Slicer-Profil. Speichere es in Bambu Studio, OrcaSlicer oder Elegoo Slicer als Projekt (Datei > Projekt speichern) und lade es erneut.',
    '« {name} » ne contient pas de profil de trancheur. Enregistrez-le comme projet depuis Bambu Studio, OrcaSlicer ou Elegoo Slicer (Fichier > Enregistrer le projet) puis rechargez-le.',
    '"{name}" में स्लाइसर प्रोफ़ाइल नहीं है। इसे Bambu Studio, OrcaSlicer या Elegoo Slicer से प्रोजेक्ट के रूप में सहेजें (File > Save project) और फिर से लोड करें।',
    '“{name}”不含切片配置。请在 Bambu Studio、OrcaSlicer 或 Elegoo Slicer 中另存为项目（文件 > 保存项目）后重新载入。',
  ],
  'dialog.export.slicer.error.unreadable': [
    'No se pudo leer el perfil del laminador de «{name}»: el archivo está dañado o es demasiado grande.',
    'Could not read the slicer profile in "{name}": the file is damaged or too large.',
    'Das Slicer-Profil in „{name}“ konnte nicht gelesen werden: Die Datei ist beschädigt oder zu groß.',
    'Impossible de lire le profil du trancheur de « {name} » : le fichier est endommagé ou trop volumineux.',
    '"{name}" की स्लाइसर प्रोफ़ाइल पढ़ी नहीं जा सकी: फ़ाइल खराब है या बहुत बड़ी है।',
    '无法读取“{name}”中的切片配置：文件已损坏或过大。',
  ],
  'dialog.export.slicer.error.save': [
    'No se pudo guardar el proyecto de ejemplo en este navegador.',
    'Could not save the sample project in this browser.',
    'Das Beispielprojekt konnte in diesem Browser nicht gespeichert werden.',
    'Impossible d’enregistrer le projet d’exemple dans ce navigateur.',
    'इस ब्राउज़र में नमूना प्रोजेक्ट सहेजा नहीं जा सका।',
    '无法在此浏览器中保存示例项目。',
  ],
  'export.plates.zipDone': [
    'Exportadas {count} placas en {name}',
    'Exported {count} plates to {name}',
    '{count} Platten nach {name} exportiert',
    '{count} plateaux exportés dans {name}',
    '{count} प्लेटें {name} में निर्यात हुईं',
    '已将 {count} 块打印板导出到 {name}',
  ],
  'bus.error.exportPlatesNeedPlateId': [
    'Las piezas están en {count} placas: indica plateId para exportar una placa en STL, o usa export_3mf para un archivo con todas las placas.',
    'The parts are on {count} plates: pass plateId to export one plate as STL, or use export_3mf for one file with all plates.',
    'Die Teile liegen auf {count} Platten: Gib plateId an, um eine Platte als STL zu exportieren, oder nutze export_3mf für eine Datei mit allen Platten.',
    'Les pièces sont sur {count} plateaux : indiquez plateId pour exporter un plateau en STL, ou utilisez export_3mf pour un fichier avec tous les plateaux.',
    'हिस्से {count} प्लेटों पर हैं: एक प्लेट को STL में निर्यात करने के लिए plateId दें, या सभी प्लेटों वाली एक फ़ाइल के लिए export_3mf इस्तेमाल करें।',
    '零件分布在 {count} 块打印板上：请提供 plateId 以将一块打印板导出为 STL，或使用 export_3mf 导出包含所有打印板的单个文件。',
  ],
  'bus.error.plateNotFound': [
    'No existe la placa «{id}».',
    'Plate “{id}” does not exist.',
    'Platte „{id}“ existiert nicht.',
    'Le plateau « {id} » n’existe pas.',
    'प्लेट “{id}” मौजूद नहीं है।',
    '打印板“{id}”不存在。',
  ],
  'bus.error.plateLimit': [
    'No se pueden crear más placas (máximo {max}, o no queda espacio libre para otra cama).',
    'No more plates can be created (maximum {max}, or there is no free space left for another bed).',
    'Es können keine weiteren Platten erstellt werden (maximal {max}, oder kein freier Platz für ein weiteres Druckbett).',
    'Impossible de créer d’autres plateaux (maximum {max}, ou plus d’espace libre pour un autre plateau).',
    'और प्लेटें नहीं बनाई जा सकतीं (अधिकतम {max}, या किसी और बेड के लिए खाली जगह नहीं बची)।',
    '无法再创建打印板（最多 {max} 块，或已没有可放置新打印床的空间）。',
  ],
  'bus.error.plateLast': [
    'No se puede borrar la única placa: una escena con placas siempre tiene al menos una.',
    'The only plate cannot be deleted: a scene with plates always keeps at least one.',
    'Die einzige Platte kann nicht gelöscht werden: Eine Szene mit Platten behält immer mindestens eine.',
    'Impossible de supprimer le seul plateau : une scène avec plateaux en garde toujours au moins un.',
    'इकलौती प्लेट हटाई नहीं जा सकती: प्लेटों वाले दृश्य में हमेशा कम से कम एक प्लेट रहती है।',
    '无法删除唯一的打印板：有打印板的场景始终至少保留一块。',
  ],
  'bus.error.plateNothingToMove': [
    'Nada que mover: las piezas ya están en esa placa o no son piezas sólidas (referencias y negativos no van en placas).',
    'Nothing to move: the parts are already on that plate or are not solid parts (references and negatives do not go on plates).',
    'Nichts zu verschieben: Die Teile liegen bereits auf dieser Platte oder sind keine festen Teile (Referenzen und Negative kommen auf keine Platte).',
    'Rien à déplacer : les pièces sont déjà sur ce plateau ou ne sont pas des pièces solides (références et négatifs ne vont pas sur un plateau).',
    'हिलाने को कुछ नहीं: हिस्से पहले से उसी प्लेट पर हैं या ठोस हिस्से नहीं हैं (संदर्भ और नेगेटिव प्लेट पर नहीं जाते)।',
    '没有可移动的内容：零件已在该打印板上，或不是实体零件（参考体和负形不放在打印板上）。',
  ],
  'bus.error.arrangeByGroupHeadless': [
    'Repartir por grupo necesita la app abierta: sin interfaz la escena no tiene grupos. Usa criterion: compact o byColor.',
    'Arrange by group needs the app open: without the UI the scene has no groups. Use criterion: compact or byColor.',
    'Nach Gruppe verteilen braucht die geöffnete App: ohne Oberfläche hat die Szene keine Gruppen. Nutze criterion: compact oder byColor.',
    'Répartir par groupe nécessite l’app ouverte : sans interface la scène n’a pas de groupes. Utilise criterion: compact ou byColor.',
    'समूह के अनुसार बाँटने के लिए ऐप खुला होना चाहिए: इंटरफ़ेस के बिना दृश्य में समूह नहीं होते। criterion: compact या byColor इस्तेमाल करें।',
    '按组分配需要打开应用：无界面时场景中没有分组。请使用 criterion: compact 或 byColor。',
  ],
  'bus.error.printLayoutOnly': [
    'Disponible en la vista Imprimir: en Armado las piezas están en su pose de montaje. Cambia de vista con set_layout (layout: print).',
    'Available in the Print view: in Assembly the parts are in their assembled pose. Switch views with set_layout (layout: print).',
    'In der Ansicht „Drucken“ verfügbar: In „Montage“ stehen die Teile in ihrer Montagepose. Wechsle die Ansicht mit set_layout (layout: print).',
    'Disponible dans la vue Impression : en Assemblage les pièces sont dans leur pose montée. Change de vue avec set_layout (layout: print).',
    'प्रिंट दृश्य में उपलब्ध: असेंबली में हिस्से अपनी जोड़ी गई मुद्रा में होते हैं। set_layout (layout: print) से दृश्य बदलें।',
    '仅在“打印”视图中可用：在“装配”视图中零件处于装配姿态。请用 set_layout (layout: print) 切换视图。',
  ],
  'bus.error.plateSpreadNeedsTwo': [
    'Una placa por objeto necesita al menos dos piezas sólidas sin bloquear.',
    'One plate per object needs at least two unlocked solid parts.',
    'Eine Platte pro Objekt braucht mindestens zwei entsperrte feste Teile.',
    'Un plateau par objet nécessite au moins deux pièces solides non verrouillées.',
    'हर वस्तु के लिए एक प्लेट को कम से कम दो अनलॉक ठोस हिस्से चाहिए।',
    '每个对象一块打印板至少需要两个未锁定的实体零件。',
  ],
} as const satisfies Record<string, Row>;

type PlatesExportKey = keyof typeof PLATES_EXPORT_TABLE;

const pick = (index: number): Record<PlatesExportKey, string> =>
  Object.fromEntries(Object.entries(PLATES_EXPORT_TABLE).map(([key, row]) => [key, row[index]])) as Record<PlatesExportKey, string>;

export const PLATES_EXPORT_ES = pick(0);
export const PLATES_EXPORT_EN = pick(1);
export const PLATES_EXPORT_DE = pick(2);
export const PLATES_EXPORT_FR = pick(3);
export const PLATES_EXPORT_HI = pick(4);
export const PLATES_EXPORT_ZH = pick(5);
