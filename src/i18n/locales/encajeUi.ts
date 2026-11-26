/**
 * @file src/i18n/locales/encajeUi.ts
 * @description Textos de la interfaz de «Comprobar encaje» (panel contextual, menú, resaltado en el visor y
 * aviso tras Ajustar a la impresora) en los 6 idiomas. Cada clave se escribe una vez con sus 6 idiomas;
 * `ENCAJE_UI_<IDIOMA>` se mezcla en cada diccionario. Los mensajes del informe están en `encaje.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const ENCAJE_UI = {
  // Acción (menú Acciones y menú contextual)
  'rediseno.action.fitCheck': { es: 'Comprobar encaje…', en: 'Check fit…', de: 'Passung prüfen…', fr: 'Vérifier l’ajustement…', hi: 'फ़िट जाँचें…', zh: '检查装配…' },
  'fitCheck.ui.title': { es: 'Comprobar encaje', en: 'Check fit', de: 'Passung prüfen', fr: 'Vérifier l’ajustement', hi: 'फ़िट जाँचें', zh: '检查装配' },
  'fitCheck.ui.openTip': { es: 'Revisa si las piezas y referencias chocan o quedan justas, sin cambiar la escena.', en: 'Checks whether parts and references overlap or are too tight, without changing the scene.', de: 'Prüft, ob sich Teile und Referenzen überschneiden oder zu eng sitzen, ohne die Szene zu ändern.', fr: 'Vérifie si les pièces et références se chevauchent ou sont trop justes, sans modifier la scène.', hi: 'दृश्य बदले बिना जाँचता है कि भाग और संदर्भ आपस में घुसते हैं या बहुत तंग हैं।', zh: '检查零件和参考是否重叠或过紧,不会改动场景。' },
  'fitCheck.ui.reason.needTwo': { es: 'Hacen falta dos objetos visibles (o dos seleccionados)', en: 'Needs two visible objects (or two selected)', de: 'Benötigt zwei sichtbare Objekte (oder zwei ausgewählte)', fr: 'Il faut deux objets visibles (ou deux sélectionnés)', hi: 'दो दिखाई देने वाले (या दो चुने हुए) ऑब्जेक्ट चाहिए', zh: '需要两个可见对象(或选中两个)' },

  // Alcance
  'fitCheck.ui.scope.selection': { es: 'Se comprueban los {count} objetos seleccionados.', en: 'Checks the {count} selected objects.', de: 'Prüft die {count} ausgewählten Objekte.', fr: 'Vérifie les {count} objets sélectionnés.', hi: '{count} चुने हुए ऑब्जेक्ट जाँचे जाएँगे।', zh: '检查选中的 {count} 个对象。' },
  'fitCheck.ui.scope.visible': { es: 'Se comprueban los {count} objetos visibles.', en: 'Checks the {count} visible objects.', de: 'Prüft die {count} sichtbaren Objekte.', fr: 'Vérifie les {count} objets visibles.', hi: '{count} दिखाई देने वाले ऑब्जेक्ट जाँचे जाएँगे।', zh: '检查 {count} 个可见对象。' },
  'fitCheck.ui.scope.hint': { es: 'Selecciona dos o más para revisar solo esos. La escena no cambia.', en: 'Select two or more to check only those. The scene does not change.', de: 'Wähle zwei oder mehr, um nur diese zu prüfen. Die Szene bleibt unverändert.', fr: 'Sélectionne-en deux ou plus pour ne vérifier qu’eux. La scène ne change pas.', hi: 'केवल उन्हें जाँचने के लिए दो या अधिक चुनें। दृश्य नहीं बदलता।', zh: '选中两个或更多对象可只检查它们。场景不会改变。' },

  // Opciones
  'fitCheck.ui.clearance': { es: 'Holgura deseada (mm)', en: 'Desired clearance (mm)', de: 'Gewünschtes Spiel (mm)', fr: 'Jeu souhaité (mm)', hi: 'वांछित गुंजाइश (mm)', zh: '期望间隙 (mm)' },
  'fitCheck.ui.clearanceHint': { es: 'Un par más cerca que esto se marca como justo.', en: 'A pair closer than this is marked too tight.', de: 'Ein Paar, das näher liegt, gilt als zu eng.', fr: 'Une paire plus proche est marquée trop juste.', hi: 'इससे पास का जोड़ा बहुत तंग माना जाता है।', zh: '比此距离更近的组合标为过紧。' },
  'fitCheck.ui.applyNegatives': { es: 'Aplicar restas pendientes (en copia)', en: 'Apply pending subtractions (on a copy)', de: 'Ausstehende Subtraktionen anwenden (als Kopie)', fr: 'Appliquer les soustractions en attente (sur une copie)', hi: 'बाकी घटाव लागू करें (प्रति पर)', zh: '应用待处理的减法(在副本上)' },
  'fitCheck.ui.applyNegativesHint': { es: 'Resta los negativos visibles antes de comparar, sin cambiar la escena.', en: 'Subtracts visible negatives before comparing, without changing the scene.', de: 'Zieht sichtbare Negative vor dem Vergleich ab, ohne die Szene zu ändern.', fr: 'Soustrait les négatifs visibles avant de comparer, sans modifier la scène.', hi: 'तुलना से पहले दिखाई देने वाले नेगेटिव घटाता है, दृश्य बदले बिना।', zh: '比较前减去可见的负形,不改动场景。' },
  'fitCheck.ui.run': { es: 'Comprobar', en: 'Check', de: 'Prüfen', fr: 'Vérifier', hi: 'जाँचें', zh: '检查' },
  'fitCheck.ui.rerun': { es: 'Volver a comprobar', en: 'Check again', de: 'Erneut prüfen', fr: 'Vérifier à nouveau', hi: 'फिर से जाँचें', zh: '重新检查' },
  'fitCheck.ui.cancel': { es: 'Cancelar', en: 'Cancel', de: 'Abbrechen', fr: 'Annuler', hi: 'रद्द करें', zh: '取消' },

  // Progreso
  'fitCheck.ui.running': { es: 'Comprobando encaje…', en: 'Checking fit…', de: 'Passung wird geprüft…', fr: 'Vérification de l’ajustement…', hi: 'फ़िट जाँची जा रही है…', zh: '正在检查装配…' },
  'fitCheck.ui.phase.prepare': { es: 'Preparando objeto {i} de {n}', en: 'Preparing object {i} of {n}', de: 'Objekt {i} von {n} wird vorbereitet', fr: 'Préparation de l’objet {i} sur {n}', hi: '{n} में से ऑब्जेक्ट {i} तैयार हो रहा है', zh: '正在准备第 {i}/{n} 个对象' },
  'fitCheck.ui.phase.pair': { es: 'Revisando par {i} de {n}', en: 'Checking pair {i} of {n}', de: 'Paar {i} von {n} wird geprüft', fr: 'Vérification de la paire {i} sur {n}', hi: '{n} में से जोड़ा {i} जाँचा जा रहा है', zh: '正在检查第 {i}/{n} 个组合' },
  'fitCheck.ui.progress': { es: 'Avance de la comprobación', en: 'Check progress', de: 'Fortschritt der Prüfung', fr: 'Avancement de la vérification', hi: 'जाँच की प्रगति', zh: '检查进度' },

  // Resumen
  'fitCheck.ui.summary.pairs': { es: 'Pares revisados', en: 'Pairs checked', de: 'Geprüfte Paare', fr: 'Paires vérifiées', hi: 'जाँचे गए जोड़े', zh: '已检查组合' },
  'fitCheck.ui.summary.clashes': { es: 'Con choque', en: 'Overlapping', de: 'Mit Überschneidung', fr: 'En chevauchement', hi: 'आपस में घुसते', zh: '重叠' },
  'fitCheck.ui.summary.cutJoints': { es: 'Uniones del corte (se tocan a propósito)', en: 'Cut joints (meant to touch)', de: 'Schnittverbindungen (berühren sich gewollt)', fr: 'Jonctions de coupe (contact voulu)', hi: 'कट जोड़ (जानबूझकर स्पर्श)', zh: '切口接合（有意接触）' },
  'fitCheck.ui.summary.tight': { es: 'Justos', en: 'Too tight', de: 'Zu eng', fr: 'Trop justes', hi: 'बहुत तंग', zh: '过紧' },
  'fitCheck.ui.summary.worst': { es: 'Peor caso', en: 'Worst case', de: 'Schlimmster Fall', fr: 'Pire cas', hi: 'सबसे बुरा', zh: '最严重' },
  'fitCheck.ui.allFits': { es: 'Todo calza: ningún par choca ni queda justo.', en: 'Everything fits: no pair overlaps or is too tight.', de: 'Alles passt: kein Paar überschneidet sich oder sitzt zu eng.', fr: 'Tout s’ajuste : aucune paire ne chevauche ni n’est trop juste.', hi: 'सब फ़िट है: कोई जोड़ा न घुसता है, न बहुत तंग है।', zh: '全部合适:没有组合重叠或过紧。' },
  'fitCheck.ui.stale': { es: 'La escena cambió: el resultado anterior ya no vale.', en: 'The scene changed: the previous result no longer applies.', de: 'Die Szene hat sich geändert: das vorige Ergebnis gilt nicht mehr.', fr: 'La scène a changé : le résultat précédent ne s’applique plus.', hi: 'दृश्य बदल गया: पिछला परिणाम अब मान्य नहीं है।', zh: '场景已更改:之前的结果不再有效。' },
  'fitCheck.ui.scopeChanged': { es: 'Cambiaste la selección: el resultado anterior era de otros objetos. Vuelve a comprobar.', en: 'The selection changed: the previous result was for other objects. Check again.', de: 'Die Auswahl hat sich geändert: das vorige Ergebnis galt für andere Objekte. Prüfe erneut.', fr: 'La sélection a changé : le résultat précédent concernait d’autres objets. Vérifie à nouveau.', hi: 'चयन बदल गया: पिछला परिणाम दूसरे ऑब्जेक्ट का था। फिर से जाँचें।', zh: '选择已更改:之前的结果属于其他对象。请重新检查。' },
  'fitCheck.ui.nothingNear': { es: 'Ningún objeto está a menos de {value} mm de otro: no hay pares que comparar.', en: 'No object is within {value} mm of another: there are no pairs to compare.', de: 'Kein Objekt liegt näher als {value} mm an einem anderen: keine Paare zu vergleichen.', fr: 'Aucun objet n’est à moins de {value} mm d’un autre : aucune paire à comparer.', hi: 'कोई ऑब्जेक्ट दूसरे से {value} mm से कम दूरी पर नहीं है: तुलना के लिए कोई जोड़ा नहीं।', zh: '没有对象与其他对象的距离小于 {value} mm:没有可比较的组合。' },
  'fitCheck.ui.subtractions': { es: 'Restas aplicadas en copia: {count}', en: 'Subtractions applied on a copy: {count}', de: 'Als Kopie angewendete Subtraktionen: {count}', fr: 'Soustractions appliquées sur une copie : {count}', hi: 'प्रति पर लागू घटाव: {count}', zh: '在副本上应用的减法:{count}' },
  'fitCheck.ui.truncated': { es: 'Resultado parcial: no se revisaron todos los pares cercanos.', en: 'Partial result: not every nearby pair was checked.', de: 'Teilergebnis: nicht alle nahen Paare wurden geprüft.', fr: 'Résultat partiel : toutes les paires proches n’ont pas été vérifiées.', hi: 'आंशिक परिणाम: सभी पास के जोड़े नहीं जाँचे गए।', zh: '部分结果:并非所有相邻组合都已检查。' },
  'fitCheck.ui.notes': { es: 'Notas', en: 'Notes', de: 'Hinweise', fr: 'Notes', hi: 'टिप्पणियाँ', zh: '说明' },

  // Lista de pares
  'fitCheck.ui.list': { es: 'Pares, del más grave al menos', en: 'Pairs, most serious first', de: 'Paare, schwerwiegendste zuerst', fr: 'Paires, la plus grave d’abord', hi: 'जोड़े, सबसे गंभीर पहले', zh: '组合(按严重程度排序)' },
  'fitCheck.ui.listHint': { es: 'Flechas para recorrer, Enter para encuadrar el par en el visor.', en: 'Arrow keys to browse, Enter to frame the pair in the viewport.', de: 'Pfeiltasten zum Durchgehen, Enter rahmt das Paar im Ansichtsfenster ein.', fr: 'Flèches pour parcourir, Entrée pour cadrer la paire dans la vue.', hi: 'देखने के लिए तीर कुंजियाँ, व्यूपोर्ट में जोड़े को फ़्रेम करने के लिए Enter।', zh: '方向键浏览,Enter 在视图中框选该组合。' },
  'fitCheck.ui.pair.names': { es: '«{a}» y «{b}»', en: '"{a}" and "{b}"', de: '„{a}“ und „{b}“', fr: '« {a} » et « {b} »', hi: '“{a}” और “{b}”', zh: '“{a}”与“{b}”' },
  'fitCheck.ui.pair.volume': { es: 'Choque de {value} mm³', en: '{value} mm³ overlap', de: '{value} mm³ Überschneidung', fr: 'Chevauchement de {value} mm³', hi: '{value} mm³ टकराव', zh: '重叠 {value} mm³' },
  'fitCheck.ui.pair.clearance': { es: 'Holgura {value} mm', en: 'Clearance {value} mm', de: 'Spiel {value} mm', fr: 'Jeu {value} mm', hi: 'गुंजाइश {value} mm', zh: '间隙 {value} mm' },
  'fitCheck.ui.pair.far': { es: 'Holgura mayor que {value} mm', en: 'Clearance over {value} mm', de: 'Spiel über {value} mm', fr: 'Jeu supérieur à {value} mm', hi: '{value} mm से अधिक गुंजाइश', zh: '间隙大于 {value} mm' },
  'fitCheck.ui.pair.simplified': { es: 'Copia simplificada', en: 'Simplified copy', de: 'Vereinfachte Kopie', fr: 'Copie simplifiée', hi: 'सरल की गई प्रति', zh: '简化副本' },
  'fitCheck.ui.label.clearance': { es: '{value} mm', en: '{value} mm', de: '{value} mm', fr: '{value} mm', hi: '{value} mm', zh: '{value} mm' },

  // Tras Ajustar a la impresora
  'fitCheck.ui.afterFit': { es: 'Reescalaste piezas con referencias o medidas funcionales: comprueba que todo siga calzando.', en: 'You rescaled parts that have references or functional sizes: check that everything still fits.', de: 'Du hast Teile mit Referenzen oder Funktionsmaßen skaliert: prüfe, ob noch alles passt.', fr: 'Tu as redimensionné des pièces avec des références ou des cotes fonctionnelles : vérifie que tout s’ajuste encore.', hi: 'आपने संदर्भ या कार्यात्मक माप वाले भाग बदले हैं: जाँचें कि सब अभी भी फ़िट है।', zh: '你缩放了带参考或功能尺寸的零件:请检查是否仍然合适。' },
  'fitCheck.ui.afterFit.action': { es: 'Ver encaje', en: 'View fit', de: 'Passung ansehen', fr: 'Voir l’ajustement', hi: 'फ़िट देखें', zh: '查看装配' },

  // Ayuda de los controles (tooltip y línea de estado)
  'fitCheck.help.clearance': { es: 'Distancia mínima entre superficies que esperas; por defecto, la tolerancia de encaje del proyecto.', en: 'Minimum distance between surfaces you expect; by default, the project fit tolerance.', de: 'Erwarteter Mindestabstand zwischen Flächen; standardmäßig die Passungstoleranz des Projekts.', fr: 'Distance minimale attendue entre surfaces ; par défaut, la tolérance d’ajustement du projet.', hi: 'सतहों के बीच अपेक्षित न्यूनतम दूरी; डिफ़ॉल्ट रूप से प्रोजेक्ट की फ़िट सहनशीलता।', zh: '期望的表面最小距离;默认为项目的装配公差。' },
  'fitCheck.help.applyNegatives': { es: 'Los agujeros aún sin aplicar cuentan como si ya estuvieran hechos.', en: 'Holes not yet applied count as if they were already made.', de: 'Noch nicht angewendete Löcher zählen, als wären sie schon gemacht.', fr: 'Les trous pas encore appliqués comptent comme s’ils étaient déjà faits.', hi: 'जो छेद अभी लागू नहीं हुए, उन्हें बना हुआ माना जाता है।', zh: '尚未应用的孔按已完成计算。' },
  'fitCheck.help.run': { es: 'Calcula choques y holguras entre los objetos indicados.', en: 'Computes overlaps and clearances between the listed objects.', de: 'Berechnet Überschneidungen und Spiel zwischen den genannten Objekten.', fr: 'Calcule chevauchements et jeux entre les objets indiqués.', hi: 'बताए गए ऑब्जेक्ट के बीच टकराव और गुंजाइश निकालता है।', zh: '计算所列对象之间的重叠与间隙。' },
  'fitCheck.help.cancel': { es: 'Detiene la comprobación en curso.', en: 'Stops the running check.', de: 'Stoppt die laufende Prüfung.', fr: 'Arrête la vérification en cours.', hi: 'चल रही जाँच रोकता है।', zh: '停止正在进行的检查。' },
  'fitCheck.help.pair': { es: 'Resalta el par en el visor; Enter o clic lo encuadra.', en: 'Highlights the pair in the viewport; Enter or click frames it.', de: 'Hebt das Paar im Ansichtsfenster hervor; Enter oder Klick rahmt es ein.', fr: 'Met la paire en évidence dans la vue ; Entrée ou clic la cadre.', hi: 'व्यूपोर्ट में जोड़े को उभारता है; Enter या क्लिक से फ़्रेम होता है।', zh: '在视图中高亮该组合;按 Enter 或点击可框选。' },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof ENCAJE_UI]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(ENCAJE_UI).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const ENCAJE_UI_ES = pick('es');
export const ENCAJE_UI_EN = pick('en');
export const ENCAJE_UI_DE = pick('de');
export const ENCAJE_UI_FR = pick('fr');
export const ENCAJE_UI_HI = pick('hi');
export const ENCAJE_UI_ZH = pick('zh');
