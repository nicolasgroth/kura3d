/**
 * @file src/i18n/locales/placasExportar.ts
 * @description Textos de exportar con placas (lote P6) en los 6 idiomas: elección del diálogo de exportación con
 * varias placas (un 3MF con todas o un archivo por placa en ZIP) y qué laminadores entienden cada una, piezas sin
 * placa excluidas, ZIP hecho y error del bus. Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
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
