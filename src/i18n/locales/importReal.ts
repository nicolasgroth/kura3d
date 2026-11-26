/**
 * @file src/i18n/locales/importReal.ts
 * @description Textos de la importación de modelos reales en los 6 idiomas: tamaño de archivo con el
 * máximo, coordenadas fuera de rango, avisos al exportar archivos que otros programas o la propia app
 * no abrirían, placas de laminador (Bambu/Orca) y conjuntos montados. Cada clave se escribe una vez con
 * sus 6 idiomas; `IMPORTREAL_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const IMPORTREAL = {
  'importError.out-of-range': {
    es: '{name}: tiene coordenadas fuera de rango (más de 1 km desde el origen). Suele ser un vértice suelto o una escala errada; revísalo en el programa que lo creó.',
    en: '{name}: has coordinates out of range (more than 1 km from the origin). This is usually a stray vertex or a wrong scale; check it in the program that created it.',
    de: '{name}: enthält Koordinaten außerhalb des Bereichs (mehr als 1 km vom Ursprung). Meist ist es ein loser Scheitelpunkt oder eine falsche Skalierung; prüfe es im Programm, das die Datei erstellt hat.',
    fr: '{name} : contient des coordonnées hors limites (plus de 1 km de l’origine). C’est souvent un sommet isolé ou une mauvaise échelle ; vérifie-le dans le logiciel qui l’a créé.',
    hi: '{name}: इसमें सीमा से बाहर निर्देशांक हैं (मूल बिंदु से 1 km से अधिक)। आमतौर पर यह कोई अलग वर्टेक्स या गलत स्केल होता है; जिस प्रोग्राम ने इसे बनाया उसमें जाँचें।',
    zh: '{name}：坐标超出范围（距原点超过 1 km）。通常是游离顶点或缩放错误；请在创建它的程序中检查。',
  },
  'importError.out-of-memory': {
    es: '{name}: no hay memoria suficiente para este modelo y la lectura se detuvo. Tu trabajo sigue intacto; simplifícalo en el programa de origen o divídelo en partes.',
    en: '{name}: there is not enough memory for this model and reading was stopped. Your work is intact; simplify it in the program that created it or split it into parts.',
    de: '{name}: Für dieses Modell reicht der Speicher nicht, das Lesen wurde abgebrochen. Deine Arbeit ist unversehrt; vereinfache es im Ursprungsprogramm oder teile es in Teile auf.',
    fr: '{name} : la mémoire est insuffisante pour ce modèle et la lecture a été arrêtée. Ton travail est intact ; simplifie-le dans le logiciel d’origine ou divise-le en plusieurs parties.',
    hi: '{name}: इस मॉडल के लिए पर्याप्त मेमोरी नहीं है और पढ़ना रोक दिया गया। आपका काम सुरक्षित है; इसे मूल प्रोग्राम में सरल करें या हिस्सों में बाँटें।',
    zh: '{name}：内存不足，无法处理此模型，读取已停止。你的工作未受影响；请在原始程序中简化，或将其拆分为多个部分。',
  },
  'importReal.batchTooLarge': {
    es: 'No se abrieron {list}: entre todos los archivos se pasan del máximo de {max} por lote. Ábrelos en otra tanda.',
    en: '{list} were not opened: together the files exceed the {max} per-batch maximum. Open them in another batch.',
    de: '{list} wurden nicht geöffnet: Zusammen überschreiten die Dateien das Maximum von {max} pro Durchgang. Öffne sie in einem weiteren Durchgang.',
    fr: '{list} n’ont pas été ouverts : ensemble, les fichiers dépassent le maximum de {max} par lot. Ouvre-les dans un autre lot.',
    hi: '{list} नहीं खोली गईं: सभी फ़ाइलें मिलाकर प्रति बैच {max} की अधिकतम सीमा से अधिक हैं। इन्हें अगले बैच में खोलें।',
    zh: '未打开 {list}：这些文件合计超过每批 {max} 的上限。请分批打开。',
  },
  'importReal.tooLarge': {
    es: '{name}: pesa {size} y el máximo que se puede abrir es {max}. Simplifícalo en el programa de origen o divide el archivo en partes.',
    en: '{name}: it is {size} and the largest file that can be opened is {max}. Simplify it in the program that created it or split the file into parts.',
    de: '{name}: Die Datei ist {size} groß, das Maximum zum Öffnen ist {max}. Vereinfache sie im Ursprungsprogramm oder teile die Datei in Teile auf.',
    fr: '{name} : le fichier fait {size} et le maximum pouvant être ouvert est {max}. Simplifie-le dans le logiciel d’origine ou divise le fichier en plusieurs parties.',
    hi: '{name}: फ़ाइल {size} की है और खोली जा सकने वाली अधिकतम फ़ाइल {max} है। इसे मूल प्रोग्राम में सरल करें या फ़ाइल को हिस्सों में बाँटें।',
    zh: '{name}：文件大小为 {size}，可打开的上限为 {max}。请在原始程序中简化，或将文件拆分为多个部分。',
  },
  'importReal.exportTooBigToReopen': {
    es: '{name} pesa {size} y la app no lo podrá volver a abrir (máximo {max}). Exporta en STL binario o 3MF, o simplifica la malla.',
    en: '{name} is {size} and the app will not be able to open it again (maximum {max}). Export as binary STL or 3MF, or simplify the mesh.',
    de: '{name} ist {size} groß und kann von der App nicht erneut geöffnet werden (Maximum {max}). Exportiere als binäres STL oder 3MF oder vereinfache das Netz.',
    fr: '{name} fait {size} et l’application ne pourra pas le rouvrir (maximum {max}). Exporte en STL binaire ou en 3MF, ou simplifie le maillage.',
    hi: '{name} का आकार {size} है और ऐप इसे दोबारा नहीं खोल पाएगा (अधिकतम {max})। बाइनरी STL या 3MF में एक्सपोर्ट करें, या मेश को सरल करें।',
    zh: '{name} 大小为 {size}，本应用将无法再次打开（上限 {max}）。请导出为二进制 STL 或 3MF，或简化网格。',
  },
  'importReal.exportLarge': {
    es: '{name} pesa {size}: varios laminadores y sitios de modelos rechazan archivos de más de {limit}. Si te falla, exporta en 3MF (va comprimido) o simplifica la malla.',
    en: '{name} is {size}: several slicers and model sites reject files over {limit}. If it fails, export as 3MF (it is compressed) or simplify the mesh.',
    de: '{name} ist {size} groß: Mehrere Slicer und Modellportale lehnen Dateien über {limit} ab. Falls es scheitert, exportiere als 3MF (komprimiert) oder vereinfache das Netz.',
    fr: '{name} fait {size} : plusieurs trancheurs et sites de modèles refusent les fichiers de plus de {limit}. En cas d’échec, exporte en 3MF (compressé) ou simplifie le maillage.',
    hi: '{name} का आकार {size} है: कई स्लाइसर और मॉडल साइटें {limit} से बड़ी फ़ाइलें अस्वीकार करती हैं। विफल होने पर 3MF (संपीड़ित) में एक्सपोर्ट करें या मेश को सरल करें।',
    zh: '{name} 大小为 {size}：不少切片软件和模型网站会拒绝超过 {limit} 的文件。如果失败，请导出为 3MF（已压缩）或简化网格。',
  },
  'importReal.exportTooManyTriangles': {
    es: '{name} tiene {tris} triángulos y el máximo que se puede volver a abrir es {max}: simplifica la malla si piensas reimportarlo.',
    en: '{name} has {tris} triangles and the most that can be opened again is {max}: simplify the mesh if you plan to re-import it.',
    de: '{name} hat {tris} Dreiecke, erneut öffnen lassen sich höchstens {max}: Vereinfache das Netz, wenn du es wieder importieren willst.',
    fr: '{name} compte {tris} triangles et le maximum pouvant être rouvert est {max} : simplifie le maillage si tu comptes le réimporter.',
    hi: '{name} में {tris} त्रिभुज हैं और दोबारा खोले जा सकने की अधिकतम सीमा {max} है: इसे फिर से इम्पोर्ट करना हो तो मेश को सरल करें।',
    zh: '{name} 有 {tris} 个三角形，可再次打开的上限为 {max}：如需重新导入，请先简化网格。',
  },
  'importReal.plateName': {
    es: 'Placa {n}', en: 'Plate {n}', de: 'Platte {n}', fr: 'Plateau {n}', hi: 'प्लेट {n}', zh: '打印板 {n}',
  },
  'importReal.plates': {
    es: '{name} trae {count} placas del laminador: cada una quedó en su propio grupo.',
    en: '{name} has {count} slicer plates: each one is in its own group.',
    de: '{name} enthält {count} Slicer-Platten: Jede liegt in einer eigenen Gruppe.',
    fr: '{name} contient {count} plateaux du trancheur : chacun est dans son propre groupe.',
    hi: '{name} में स्लाइसर की {count} प्लेटें हैं: हर एक अपने अलग समूह में है।',
    zh: '{name} 含有 {count} 个切片打印板：每个都放在单独的组中。',
  },
  'importReal.platesExceedBed': {
    es: '{name} trae {count} placas del laminador: cada una quedó en su propio grupo. Juntas miden {w} × {d} mm y no caben en la cama ({bw} × {bd} mm): imprime una placa a la vez.',
    en: '{name} has {count} slicer plates: each one is in its own group. Together they measure {w} × {d} mm and do not fit the bed ({bw} × {bd} mm): print one plate at a time.',
    de: '{name} enthält {count} Slicer-Platten: Jede liegt in einer eigenen Gruppe. Zusammen messen sie {w} × {d} mm und passen nicht auf das Bett ({bw} × {bd} mm): Drucke eine Platte nach der anderen.',
    fr: '{name} contient {count} plateaux du trancheur : chacun est dans son propre groupe. Ensemble, ils mesurent {w} × {d} mm et ne tiennent pas sur le plateau ({bw} × {bd} mm) : imprime un plateau à la fois.',
    hi: '{name} में स्लाइसर की {count} प्लेटें हैं: हर एक अपने अलग समूह में है। साथ में इनका माप {w} × {d} mm है और ये बेड ({bw} × {bd} mm) पर नहीं समातीं: एक बार में एक प्लेट प्रिंट करें।',
    zh: '{name} 含有 {count} 个切片打印板：每个都放在单独的组中。合在一起尺寸为 {w} × {d} mm，放不下打印床（{bw} × {bd} mm）：请一次打印一个打印板。',
  },
  'importReal.assembled': {
    es: '{name}: las piezas venían montadas entre sí; se conservó el montaje y quedaron agrupadas.',
    en: '{name}: the parts came assembled together; the assembly was kept and they were grouped.',
    de: '{name}: Die Teile waren ineinander montiert; die Montage wurde beibehalten und sie wurden gruppiert.',
    fr: '{name} : les pièces étaient assemblées entre elles ; l’assemblage a été conservé et elles ont été groupées.',
    hi: '{name}: भाग आपस में जुड़े हुए आए थे; जोड़ को बनाए रखा गया और उन्हें समूह में रखा गया।',
    zh: '{name}：这些部件原本是组装在一起的；已保留装配关系并将其编组。',
  },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof IMPORTREAL]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(IMPORTREAL).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const IMPORTREAL_ES = pick('es');
export const IMPORTREAL_EN = pick('en');
export const IMPORTREAL_DE = pick('de');
export const IMPORTREAL_FR = pick('fr');
export const IMPORTREAL_HI = pick('hi');
export const IMPORTREAL_ZH = pick('zh');
