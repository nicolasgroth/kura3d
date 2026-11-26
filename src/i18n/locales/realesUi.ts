/**
 * @file src/i18n/locales/realesUi.ts
 * @description Textos de las correcciones de interfaz tras la QA con modelos reales: motivo del
 * autoguardado no disponible y "Guardar proyecto ahora", estado de la malla en el inspector con
 * "Reparar malla" y "Ver bordes", recuento de visibles en el pie, resumen de uniones para pegar,
 * pista de Medir, nota de superposición del corte y etapas de la importación. Cada clave lleva
 * [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const REALES_UI_TABLE = {
  'realesUi.recovery.quota': [
    'El borrador automático no cabe en el espacio que da el navegador ({needed} MB de {available} MB libres).',
    'The automatic draft does not fit in the space the browser allows ({needed} MB of {available} MB free).',
    'Der automatische Entwurf passt nicht in den Speicher, den der Browser erlaubt ({needed} MB von {available} MB frei).',
    'Le brouillon automatique ne tient pas dans l’espace accordé par le navigateur ({needed} Mo sur {available} Mo libres).',
    'स्वचालित ड्राफ़्ट ब्राउज़र द्वारा दी गई जगह में नहीं समाता ({available} MB खाली में से {needed} MB चाहिए)।',
    '自动草稿超出了浏览器允许的空间(需要 {needed} MB,可用 {available} MB)。',
  ],
  'realesUi.recovery.quotaUnknown': [
    'El borrador automático no cabe en el espacio que da el navegador.',
    'The automatic draft does not fit in the space the browser allows.',
    'Der automatische Entwurf passt nicht in den Speicher, den der Browser erlaubt.',
    'Le brouillon automatique ne tient pas dans l’espace accordé par le navigateur.',
    'स्वचालित ड्राफ़्ट ब्राउज़र द्वारा दी गई जगह में नहीं समाता।',
    '自动草稿超出了浏览器允许的空间。',
  ],
  'realesUi.recovery.storage': [
    'El navegador no deja guardar el borrador automático (almacenamiento bloqueado o ventana privada).',
    'The browser does not allow saving the automatic draft (storage blocked or private window).',
    'Der Browser erlaubt den automatischen Entwurf nicht (Speicher gesperrt oder privates Fenster).',
    'Le navigateur n’autorise pas le brouillon automatique (stockage bloqué ou fenêtre privée).',
    'ब्राउज़र स्वचालित ड्राफ़्ट सहेजने नहीं देता (स्टोरेज बंद या निजी विंडो)।',
    '浏览器不允许保存自动草稿(存储被阻止或处于隐私窗口)。',
  ],
  'realesUi.recovery.other': [
    'El borrador automático falló: tus cambios solo están en esta pestaña.',
    'The automatic draft failed: your changes exist only in this tab.',
    'Der automatische Entwurf ist fehlgeschlagen: Deine Änderungen gibt es nur in diesem Tab.',
    'Le brouillon automatique a échoué : vos modifications n’existent que dans cet onglet.',
    'स्वचालित ड्राफ़्ट विफल रहा: आपके बदलाव केवल इसी टैब में हैं।',
    '自动草稿失败:你的更改只存在于此标签页中。',
  ],
  'realesUi.recovery.saveNow': ['Guardar proyecto ahora', 'Save project now', 'Projekt jetzt speichern', 'Enregistrer le projet maintenant', 'प्रोजेक्ट अभी सहेजें', '立即保存项目'],
  'realesUi.recovery.saveNowTip': [
    'Guarda el proyecto en un archivo .kura para no perder los cambios (Ctrl+S)',
    'Save the project to a .kura file so you do not lose your changes (Ctrl+S)',
    'Speichere das Projekt als .kura-Datei, damit keine Änderungen verloren gehen (Strg+S)',
    'Enregistrez le projet dans un fichier .kura pour ne pas perdre vos modifications (Ctrl+S)',
    'बदलाव न खोने के लिए प्रोजेक्ट को .kura फ़ाइल में सहेजें (Ctrl+S)',
    '将项目保存为 .kura 文件,以免丢失更改(Ctrl+S)',
  ],
  'realesUi.recovery.reminder': [
    'Llevas {count} {count?cambio|cambios} sin guardar y el borrador automático no funciona. Guarda el proyecto para no {count?perderlo|perderlos}.',
    'You have {count} unsaved {count?change|changes} and the automatic draft is not working. Save the project so you do not lose {count?it|them}.',
    'Du hast {count} {count?ungespeicherte Änderung|ungespeicherte Änderungen} und der automatische Entwurf funktioniert nicht. Speichere das Projekt, damit {count?sie nicht verloren geht|sie nicht verloren gehen}.',
    'Vous avez {count} {count?modification non enregistrée|modifications non enregistrées} et le brouillon automatique ne fonctionne pas. Enregistrez le projet pour ne pas {count?la|les} perdre.',
    'आपके {count} बदलाव सहेजे नहीं गए हैं और स्वचालित ड्राफ़्ट काम नहीं कर रहा। उन्हें न खोने के लिए प्रोजेक्ट सहेजें।',
    '你有 {count} 处未保存的更改,且自动草稿无法工作。请保存项目以免丢失。',
  ],
  'realesUi.mesh.label': ['Malla', 'Mesh', 'Netz', 'Maillage', 'मेश', '网格'],
  'realesUi.mesh.closed': ['Cerrada', 'Closed', 'Geschlossen', 'Fermé', 'बंद', '封闭'],
  'realesUi.mesh.openOne': ['Abierta: 1 borde libre', 'Open: 1 free edge', 'Offen: 1 freie Kante', 'Ouvert : 1 bord libre', 'खुला: 1 खुला किनारा', '开放:1 条自由边'],
  'realesUi.mesh.openOther': ['Abierta: {count} {count?borde libre|bordes libres}', 'Open: {count} free {count?edge|edges}', 'Offen: {count} {count?freie Kante|freie Kanten}', 'Ouvert : {count} {count?bord libre|bords libres}', 'खुला: {count} खुले किनारे', '开放:{count} 条自由边'],
  'realesUi.mesh.defects': ['Con defectos', 'Has defects', 'Mit Fehlern', 'Avec défauts', 'दोषयुक्त', '有缺陷'],
  'realesUi.mesh.checking': ['Revisando…', 'Checking…', 'Wird geprüft…', 'Vérification…', 'जाँच हो रही है…', '正在检查…'],
  'realesUi.mesh.showEdges': ['Ver bordes', 'Show edges', 'Kanten zeigen', 'Voir les bords', 'किनारे दिखाएँ', '显示边'],
  'realesUi.mesh.hideEdges': ['Ocultar bordes', 'Hide edges', 'Kanten ausblenden', 'Masquer les bords', 'किनारे छिपाएँ', '隐藏边'],
  'realesUi.mesh.showEdgesTip': [
    'Resalta en el visor los bordes libres (agujeros) de la malla',
    'Highlights the free edges (holes) of the mesh in the viewport',
    'Hebt die freien Kanten (Löcher) des Netzes im Ansichtsfenster hervor',
    'Met en évidence dans la vue les bords libres (trous) du maillage',
    'व्यूपोर्ट में मेश के खुले किनारे (छेद) दिखाता है',
    '在视图中高亮显示网格的自由边(孔洞)',
  ],
  'realesUi.status.count': [
    '{visible} de {total} objs · {visibleTris} de {totalTris} tris',
    '{visible} of {total} objs · {visibleTris} of {totalTris} tris',
    '{visible} von {total} Obj. · {visibleTris} von {totalTris} Tris',
    '{visible} sur {total} obj. · {visibleTris} sur {totalTris} tri.',
    '{total} में से {visible} वस्तुएँ · {totalTris} में से {visibleTris} त्रिकोण',
    '{visible}/{total} 个对象 · {visibleTris}/{totalTris} 三角面',
  ],
  'realesUi.status.countTip': [
    'Visibles: {visible} de {total} objetos y {visibleTris} de {totalTris} triángulos. Las piezas ocultas cuentan solo en el total.',
    'Visible: {visible} of {total} objects and {visibleTris} of {totalTris} triangles. Hidden parts count only in the total.',
    'Sichtbar: {visible} von {total} Objekten und {visibleTris} von {totalTris} Dreiecken. Ausgeblendete Teile zählen nur zur Gesamtzahl.',
    'Visibles : {visible} sur {total} objets et {visibleTris} sur {totalTris} triangles. Les pièces masquées ne comptent que dans le total.',
    'दिखाई दे रहे: {total} में से {visible} वस्तुएँ और {totalTris} में से {visibleTris} त्रिकोण। छिपे हिस्से केवल कुल में गिने जाते हैं।',
    '可见:{total} 个对象中的 {visible} 个,{totalTris} 个三角面中的 {visibleTris} 个。隐藏的零件只计入总数。',
  ],
  'realesUi.split.glueSummary': [
    '{count} de {total} {total?unión|uniones} {count?quedó|quedaron} para pegar: no cabe un conector en su sección.',
    '{count} of {total} {total?joint|joints} {count?was|were} left for gluing: a connector does not fit in their section.',
    '{count} von {total} {total?Verbindung|Verbindungen} {count?bleibt|bleiben} zum Kleben: In ihren Querschnitt passt kein Verbinder.',
    '{count} {count?sur|des} {total} {total?jonction|jonctions} {count?est|sont} à coller : aucun connecteur ne tient dans leur section.',
    '{total} में से {count} जोड़ चिपकाने के लिए रहे: उनके हिस्से में कनेक्टर नहीं समाता।',
    '{total} 个连接中有 {count} 个需粘合:其截面放不下连接件。',
  ],
  'realesUi.split.showJoints': ['Ver uniones', 'Show joints', 'Verbindungen zeigen', 'Voir les jonctions', 'जोड़ देखें', '查看连接'],
  'realesUi.measure.hint': ['Toca un punto de la pieza', 'Tap a point on the part', 'Tippe auf einen Punkt des Teils', 'Touchez un point de la pièce', 'पीस पर कोई बिंदु छुएँ', '点按零件上的一个点'],
  'realesUi.cut.useFreeSpot': [
    'Elegir «Apoyarla en un lugar libre»',
    'Choose “Rest it in a free spot”',
    '„In einem freien Bereich ablegen“ wählen',
    'Choisir « La poser dans un emplacement libre »',
    '“खाली जगह पर टिकाएँ” चुनें',
    '选择“放到空闲位置”',
  ],
  'realesUi.cut.overlap': [
    'Se superpondría con «{names}» si la apoyas en la cama.',
    'It would overlap «{names}» if you rest it on the bed.',
    'Sie würde «{names}» überlappen, wenn du sie auf dem Druckbett ablegst.',
    'Elle chevaucherait « {names} » si vous la posez sur le plateau.',
    'बेड पर टिकाने से यह «{names}» से टकराएगा।',
    '放到打印床上会与「{names}」重叠。',
  ],
  'realesUi.import.reading': ['Leyendo archivo…', 'Reading file…', 'Datei wird gelesen…', 'Lecture du fichier…', 'फ़ाइल पढ़ी जा रही है…', '正在读取文件…'],
  'realesUi.import.parsing': ['Interpretando…', 'Interpreting…', 'Wird interpretiert…', 'Interprétation…', 'समझा जा रहा है…', '正在解析…'],
  'realesUi.import.placing': ['Colocando en la escena…', 'Placing in the scene…', 'Wird in der Szene platziert…', 'Placement dans la scène…', 'दृश्य में रखा जा रहा है…', '正在放入场景…'],
  'realesUi.import.parts': ['{done} de {total} {total?pieza|piezas}', '{done} of {total} {total?part|parts}', '{done} von {total} {total?Teil|Teilen}', '{done} sur {total} {total?pièce|pièces}', '{total} में से {done} पीस', '{done}/{total} 个零件'],
} as const satisfies Record<string, Row>;

type RealesUiKey = keyof typeof REALES_UI_TABLE;

const pick = (index: number): Record<RealesUiKey, string> =>
  Object.fromEntries(Object.entries(REALES_UI_TABLE).map(([key, row]) => [key, row[index]])) as Record<RealesUiKey, string>;

export const REALESUI_ES = pick(0);
export const REALESUI_EN = pick(1);
export const REALESUI_DE = pick(2);
export const REALESUI_FR = pick(3);
export const REALESUI_HI = pick(4);
export const REALESUI_ZH = pick(5);
