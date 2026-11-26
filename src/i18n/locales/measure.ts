/**
 * @file src/i18n/locales/measure.ts
 * @description Textos de la herramienta Medir en los 6 idiomas: modos (distancia, ángulo, área,
 * capacidad), indicaciones del visor, lista de mediciones, capacidad de recipientes y atajo. Cada
 * clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const MEASURE_TABLE = {
  'topbar.tool.measure': ['Medir', 'Measure', 'Messen', 'Mesurer', 'मापें', '测量'],
  'topbar.tool.measureTip': [
    'Medir distancias, ángulos, áreas y cuánto cabe en un recipiente (D)',
    'Measure distances, angles, areas and how much a container holds (D)',
    'Abstände, Winkel, Flächen und das Fassungsvermögen messen (D)',
    'Mesurer distances, angles, surfaces et la contenance d’un récipient (D)',
    'दूरी, कोण, क्षेत्रफल और बर्तन की क्षमता मापें (D)',
    '测量距离、角度、面积和容器容量 (D)',
  ],
  'viewport.protip.measure': [
    'Consejo: las mediciones no cambian tu modelo · D o V vuelve a Selección',
    'Tip: measuring never changes your model · D or V returns to Select',
    'Tipp: Messen ändert dein Modell nie · D oder V zurück zur Auswahl',
    'Astuce : mesurer ne modifie jamais votre modèle · D ou V revient à Sélection',
    'सुझाव: मापने से मॉडल नहीं बदलता · D या V से चयन पर लौटें',
    '提示:测量不会改变模型 · 按 D 或 V 返回选择',
  ],
  'dialog.shortcuts.measureTool': ['Herramienta Medir', 'Measure tool', 'Messwerkzeug', 'Outil Mesurer', 'माप टूल', '测量工具'],
  'cmd.tool.measure': ['Medir distancia, área o capacidad', 'Measure distance, area or capacity', 'Abstand, Fläche oder Volumen messen', 'Mesurer distance, surface ou contenance', 'दूरी, क्षेत्रफल या क्षमता मापें', '测量距离、面积或容量'],

  'measure.title': ['Medir', 'Measure', 'Messen', 'Mesurer', 'मापें', '测量'],
  'measure.modes': ['Qué medir', 'What to measure', 'Was messen', 'Que mesurer', 'क्या मापें', '测量内容'],
  'measure.mode.distance': ['Distancia', 'Distance', 'Abstand', 'Distance', 'दूरी', '距离'],
  'measure.mode.angle': ['Ángulo', 'Angle', 'Winkel', 'Angle', 'कोण', '角度'],
  'measure.mode.area': ['Área', 'Area', 'Fläche', 'Surface', 'क्षेत्रफल', '面积'],
  'measure.mode.capacity': ['Capacidad', 'Capacity', 'Fassungsvermögen', 'Contenance', 'क्षमता', '容量'],
  'measure.angle.points': ['3 puntos', '3 points', '3 Punkte', '3 points', '3 बिंदु', '3 点'],
  'measure.angle.faces': ['2 caras', '2 faces', '2 Flächen', '2 faces', '2 सतहें', '2 面'],

  'measure.hint.distance0': ['Haz clic en el primer punto', 'Click the first point', 'Klicke auf den ersten Punkt', 'Cliquez sur le premier point', 'पहले बिंदु पर क्लिक करें', '点击第一个点'],
  'measure.hint.distance1': [
    'Ahora el segundo punto · clic derecho o Esc cancela',
    'Now the second point · right-click or Esc cancels',
    'Jetzt der zweite Punkt · Rechtsklick oder Esc bricht ab',
    'Maintenant le second point · clic droit ou Échap annule',
    'अब दूसरा बिंदु · राइट-क्लिक या Esc रद्द करता है',
    '再点第二个点 · 右键或 Esc 取消',
  ],
  'measure.hint.snap': [
    'Se pega a esquinas, mitades de arista y centros de cara · Alt lo desactiva',
    'Snaps to corners, edge midpoints and face centers · hold Alt to turn it off',
    'Rastet an Ecken, Kantenmitten und Flächenmitten ein · Alt schaltet es aus',
    'S’aimante aux coins, milieux d’arête et centres de face · Alt le désactive',
    'कोनों, किनारों के मध्य और सतह के केंद्र पर चिपकता है · Alt से बंद',
    '吸附到角点、边中点和面中心 · 按住 Alt 关闭',
  ],
  'measure.hint.anglePoints': [
    'Clic en 3 puntos: el segundo es el vértice del ángulo ({n}/3)',
    'Click 3 points: the second one is the corner of the angle ({n}/3)',
    'Klicke 3 Punkte: der zweite ist der Scheitel ({n}/3)',
    'Cliquez 3 points : le deuxième est le sommet de l’angle ({n}/3)',
    '3 बिंदुओं पर क्लिक करें: दूसरा कोण का शीर्ष है ({n}/3)',
    '点击 3 个点:第二个是角的顶点 ({n}/3)',
  ],
  'measure.hint.angleFaces': [
    'Clic en dos caras para ver el ángulo entre ellas ({n}/2)',
    'Click two faces to see the angle between them ({n}/2)',
    'Klicke zwei Flächen für den Winkel dazwischen ({n}/2)',
    'Cliquez deux faces pour voir l’angle entre elles ({n}/2)',
    'दो सतहों पर क्लिक करें, उनके बीच का कोण दिखेगा ({n}/2)',
    '点击两个面查看它们之间的角度 ({n}/2)',
  ],
  'measure.hint.area': [
    'Clic en una cara para ver su área · Mayús+clic suma más caras',
    'Click a face to see its area · Shift+click adds more faces',
    'Klicke auf eine Fläche für ihre Größe · Umschalt+Klick addiert weitere',
    'Cliquez une face pour voir sa surface · Maj+clic en ajoute d’autres',
    'क्षेत्रफल देखने के लिए सतह पर क्लिक करें · Shift+क्लिक और जोड़ता है',
    '点击一个面查看面积 · Shift+点击累加更多面',
  ],
  'measure.hint.capacity': [
    'Elige un objeto y calcula cuánto cabe dentro, como si lo llenaras con agua',
    'Pick an object and work out how much fits inside, as if you filled it with water',
    'Wähle ein Objekt und berechne, wie viel hineinpasst, als würdest du es mit Wasser füllen',
    'Choisissez un objet et calculez ce qu’il contient, comme si vous le remplissiez d’eau',
    'एक ऑब्जेक्ट चुनें और देखें कि उसमें कितना आता है, जैसे पानी भर रहे हों',
    '选择一个对象,计算里面能装多少,就像往里灌水一样',
  ],

  'measure.list.title': ['Mediciones', 'Measurements', 'Messungen', 'Mesures', 'माप', '测量结果'],
  'measure.list.empty': ['Aún no hay mediciones', 'No measurements yet', 'Noch keine Messungen', 'Aucune mesure pour l’instant', 'अभी कोई माप नहीं', '暂无测量'],
  'measure.list.session': [
    'Se borran al cerrar; no se guardan en el proyecto',
    'Cleared on close; not saved in the project',
    'Werden beim Schließen gelöscht; nicht im Projekt gespeichert',
    'Effacées à la fermeture ; non enregistrées dans le projet',
    'बंद करने पर मिट जाते हैं; प्रोजेक्ट में सहेजे नहीं जाते',
    '关闭后清除;不保存到项目',
  ],
  'measure.remove': ['Borrar medición: {label}', 'Delete measurement: {label}', 'Messung löschen: {label}', 'Supprimer la mesure : {label}', 'माप हटाएँ: {label}', '删除测量:{label}'],
  'measure.clearAll': ['Borrar todas', 'Delete all', 'Alle löschen', 'Tout supprimer', 'सब हटाएँ', '全部删除'],
  'measure.copy': ['Copiar valor: {value}', 'Copy value: {value}', 'Wert kopieren: {value}', 'Copier la valeur : {value}', 'मान कॉपी करें: {value}', '复制数值:{value}'],
  'measure.copied': ['Copiado: {value}', 'Copied: {value}', 'Kopiert: {value}', 'Copié : {value}', 'कॉपी हुआ: {value}', '已复制:{value}'],
  'measure.item.distance': ['Distancia', 'Distance', 'Abstand', 'Distance', 'दूरी', '距离'],
  'measure.item.angle': ['Ángulo', 'Angle', 'Winkel', 'Angle', 'कोण', '角度'],
  'measure.item.faceAngle': ['Ángulo entre caras', 'Angle between faces', 'Winkel zwischen Flächen', 'Angle entre faces', 'सतहों के बीच कोण', '面夹角'],
  'measure.item.area': ['Área de {name}', 'Area of {name}', 'Fläche von {name}', 'Surface de {name}', '{name} का क्षेत्रफल', '{name} 的面积'],
  'measure.item.areaRegions': ['{n} {n?cara|caras}', '{n} {n?face|faces}', '{n} {n?Fläche|Flächen}', '{n} {n?face|faces}', '{n} सतहें', '{n} 个面'],
  'measure.item.stale': [
    'Desactualizada: el objeto cambió o ya no está',
    'Out of date: the object changed or is gone',
    'Veraltet: Das Objekt hat sich geändert oder ist weg',
    'Obsolète : l’objet a changé ou n’existe plus',
    'पुरानी: ऑब्जेक्ट बदल गया या हट गया',
    '已过期:对象已更改或已删除',
  ],
  'measure.item.staleTitle': ['{title} (desactualizada)', '{title} (out of date)', '{title} (veraltet)', '{title} (obsolète)', '{title} (पुरानी)', '{title}(已过期)'],
  'measure.panel.collapse': ['Plegar el panel de medición', 'Collapse the measure panel', 'Messfenster einklappen', 'Replier le panneau de mesure', 'माप पैनल समेटें', '收起测量面板'],
  'measure.panel.expand': ['Desplegar el panel de medición', 'Expand the measure panel', 'Messfenster ausklappen', 'Déplier le panneau de mesure', 'माप पैनल खोलें', '展开测量面板'],
  'measure.panel.count': ['{n} {n?medición|mediciones}', '{n} {n?measurement|measurements}', '{n} {n?Messung|Messungen}', '{n} {n?mesure|mesures}', '{n} माप', '{n} 项测量'],
  'measure.object.total': [
    '{name}: superficie {area} · volumen {volume} ({liquid})',
    '{name}: surface {area} · volume {volume} ({liquid})',
    '{name}: Oberfläche {area} · Volumen {volume} ({liquid})',
    '{name} : surface {area} · volume {volume} ({liquid})',
    '{name}: सतह {area} · आयतन {volume} ({liquid})',
    '{name}:表面积 {area} · 体积 {volume}({liquid})',
  ],

  'measure.capacity.run': ['Calcular capacidad', 'Calculate capacity', 'Fassungsvermögen berechnen', 'Calculer la contenance', 'क्षमता निकालें', '计算容量'],
  'measure.capacity.running': ['Llenando…', 'Filling…', 'Wird gefüllt…', 'Remplissage…', 'भर रहे हैं…', '正在灌注…'],
  'measure.capacity.cancel': ['Cancelar', 'Cancel', 'Abbrechen', 'Annuler', 'रद्द करें', '取消'],
  'measure.capacity.needSelection': ['Selecciona un objeto para medir su capacidad', 'Select an object to measure its capacity', 'Wähle ein Objekt, um sein Fassungsvermögen zu messen', 'Sélectionnez un objet pour mesurer sa contenance', 'क्षमता मापने के लिए ऑब्जेक्ट चुनें', '选择一个对象来测量容量'],
  'measure.capacity.max': ['Capacidad máxima', 'Maximum capacity', 'Maximales Fassungsvermögen', 'Contenance maximale', 'अधिकतम क्षमता', '最大容量'],
  'measure.capacity.overflow': ['Rebalsa a {height} de altura', 'Overflows at {height} high', 'Läuft bei {height} Höhe über', 'Déborde à {height} de hauteur', '{height} ऊँचाई पर छलकता है', '在 {height} 高处溢出'],
  'measure.capacity.levelPercent': ['Nivel (% del rebalse)', 'Level (% of overflow)', 'Füllhöhe (% bis Überlauf)', 'Niveau (% du débordement)', 'स्तर (छलकने का %)', '高度(溢出的 %)'],
  'measure.capacity.levelMm': ['Altura del líquido', 'Liquid height', 'Flüssigkeitshöhe', 'Hauteur du liquide', 'तरल की ऊँचाई', '液面高度'],
  'measure.capacity.filled': ['Cabe hasta ese nivel', 'Holds up to that level', 'Fasst bis zu dieser Höhe', 'Contient jusqu’à ce niveau', 'उस स्तर तक आता है', '到该高度可容纳'],
  'measure.capacity.none': [
    'En esta posición no retiene nada: el líquido se escurre',
    'In this position it holds nothing: the liquid runs off',
    'In dieser Lage hält es nichts: die Flüssigkeit läuft ab',
    'Dans cette position il ne retient rien : le liquide s’écoule',
    'इस स्थिति में कुछ नहीं रुकता: तरल बह जाता है',
    '在此姿态下无法盛装:液体会流走',
  ],
  'measure.capacity.sealed': [
    'Cavidad cerrada por dentro: {volume} (no cuenta como capacidad)',
    'Closed hollow inside: {volume} (not counted as capacity)',
    'Geschlossener Hohlraum innen: {volume} (zählt nicht als Fassungsvermögen)',
    'Creux fermé à l’intérieur : {volume} (non compté comme contenance)',
    'अंदर बंद खोखला: {volume} (क्षमता में नहीं गिना)',
    '内部封闭空腔:{volume}(不计入容量)',
  ],
  'measure.capacity.basin': ['Cavidad {n}', 'Cavity {n}', 'Mulde {n}', 'Cavité {n}', 'खोखला {n}', '腔体 {n}'],
  'measure.capacity.basinSelect': ['Cavidad a medir', 'Cavity to measure', 'Zu messende Mulde', 'Cavité à mesurer', 'मापने वाला खोखला', '要测量的腔体'],
  'measure.capacity.orientation': [
    'Depende de cómo está girado el objeto: gíralo para medir con otra inclinación',
    'It depends on how the object is rotated: rotate it to measure at another tilt',
    'Hängt von der Drehung des Objekts ab: drehe es, um eine andere Neigung zu messen',
    'Dépend de l’orientation de l’objet : faites-le pivoter pour mesurer une autre inclinaison',
    'यह ऑब्जेक्ट के घुमाव पर निर्भर है: दूसरा झुकाव मापने के लिए उसे घुमाएँ',
    '取决于对象的朝向:旋转它即可测量其他倾斜角度',
  ],
  'measure.capacity.stale': ['El objeto cambió: vuelve a calcular', 'The object changed: calculate again', 'Das Objekt hat sich geändert: neu berechnen', 'L’objet a changé : recalculez', 'ऑब्जेक्ट बदल गया: फिर से निकालें', '对象已更改:请重新计算'],
  'measure.capacity.error': ['No se pudo calcular la capacidad de esta malla', 'Could not calculate the capacity of this mesh', 'Fassungsvermögen dieses Netzes nicht berechenbar', 'Impossible de calculer la contenance de ce maillage', 'इस मेश की क्षमता नहीं निकल सकी', '无法计算此网格的容量'],
  'measure.cups': ['tazas EE. UU.', 'US cups', 'US-Tassen', 'tasses US', 'US कप', '美制杯'],
} as const satisfies Record<string, Row>;

type MeasureKey = keyof typeof MEASURE_TABLE;

const pick = (index: number): Record<MeasureKey, string> =>
  Object.fromEntries(Object.entries(MEASURE_TABLE).map(([key, row]) => [key, row[index]])) as Record<MeasureKey, string>;

export const MEASURE_ES = pick(0);
export const MEASURE_EN = pick(1);
export const MEASURE_DE = pick(2);
export const MEASURE_FR = pick(3);
export const MEASURE_HI = pick(4);
export const MEASURE_ZH = pick(5);
