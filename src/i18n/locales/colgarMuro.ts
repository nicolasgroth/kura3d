/**
 * @file src/i18n/locales/colgarMuro.ts
 * @description Textos del ojo de cerradura para colgar en el muro (panel, preajustes, avisos, nombres de objetos y
 * entradas de menú). Cada clave lleva [es, en, de, fr, hi, zh]; `COLGAR_MURO_<IDIOMA>` se mezcla al final de cada
 * diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { pickColumn, presetRows, type Row } from './addonPresetRows';

const TABLE = {
  'keyhole.title': ['Colgar en el muro', 'Wall-hanging keyhole', 'Schlüsselloch zum Aufhängen', 'Trou de serrure mural', 'दीवार पर टाँगने का कीहोल', '挂墙钥匙孔'],
  'keyhole.menuTip': [
    'Un ojo de cerradura en una cara para colgar la pieza de un tornillo en la pared.',
    'A keyhole slot on a face to hang the part from a screw in the wall.',
    'Ein Schlüsselloch auf einer Fläche, um das Teil an einer Schraube in der Wand aufzuhängen.',
    'Un trou de serrure sur une face pour accrocher la pièce à une vis au mur.',
    'किसी फलक पर कीहोल, ताकि भाग को दीवार के स्क्रू पर टाँगा जा सके।',
    '在一个面上开钥匙孔，把零件挂在墙上的螺丝上。',
  ],
  'keyhole.cmd.keywords': [
    'colgar muro pared ojo cerradura keyhole tornillo cuadro gancho',
    'hang wall keyhole screw mount picture hook',
    'aufhängen wand schlüsselloch schraube bild haken',
    'accrocher mur trou serrure vis cadre crochet',
    'टाँगना दीवार कीहोल स्क्रू hang wall keyhole',
    '挂墙 钥匙孔 螺丝 挂钩 hang wall keyhole',
  ],
  'keyhole.needSolid': [
    'Para colocar un ojo de cerradura necesitas una pieza sólida visible y sin bloquear.',
    'To place a keyhole you need a visible, unlocked solid part.',
    'Für ein Schlüsselloch brauchst du ein sichtbares, nicht gesperrtes festes Teil.',
    'Pour placer un trou de serrure, il faut une pièce solide visible et non verrouillée.',
    'कीहोल रखने के लिए एक दिखाई देने वाला, बिना लॉक वाला ठोस भाग चाहिए।',
    '放置钥匙孔需要一个可见且未锁定的实体零件。',
  ],
  'keyhole.hint': [
    'Haz clic sobre la cara que mira al muro. La ranura sube hacia el «arriba» de la pieza en la cama; el ángulo la gira. Puedes colocar varios; Escape o «Listo» termina.',
    'Click the face that will touch the wall. The slot points to the part’s “up” on the bed; the angle rotates it. You can place several; Escape or “Done” finishes.',
    'Klicke auf die Fläche, die zur Wand zeigt. Der Schlitz zeigt nach „oben“ des Teils auf dem Druckbett; der Winkel dreht ihn. Du kannst mehrere setzen; Escape oder „Fertig“ beendet.',
    'Clique sur la face qui touchera le mur. La fente monte vers le « haut » de la pièce sur le plateau ; l’angle la fait pivoter. Tu peux en placer plusieurs ; Échap ou « Terminé » termine.',
    'दीवार की ओर वाले फलक पर क्लिक करें। स्लॉट बेड पर भाग के “ऊपर” की ओर जाता है; कोण उसे घुमाता है। आप कई रख सकते हैं; Escape या “हो गया” से समाप्त करें।',
    '点击将贴墙的那个面。槽口朝向零件在打印床上的“上方”，角度可以旋转它。可以放置多个；按 Escape 或“完成”结束。',
  ],
  'keyhole.invalid': [
    'Corrige las medidas marcadas para poder colocar.',
    'Fix the marked sizes to be able to place.',
    'Korrigiere die markierten Maße, um setzen zu können.',
    'Corrige les mesures signalées pour pouvoir placer.',
    'रखने के लिए चिह्नित माप ठीक करें।',
    '请修正标记的尺寸后再放置。',
  ],
  'keyhole.done': ['Listo', 'Done', 'Fertig', 'Terminé', 'हो गया', '完成'],
  'keyhole.fold.label': ['Colgar en el muro', 'Wall-hanging keyhole', 'Schlüsselloch zum Aufhängen', 'Trou de serrure mural', 'दीवार पर टाँगने का कीहोल', '挂墙钥匙孔'],
  'keyhole.fold.empty': ['Haz clic sobre una cara para colocar.', 'Click a face to place.', 'Klicke auf eine Fläche zum Setzen.', 'Clique sur une face pour placer.', 'रखने के लिए फलक पर क्लिक करें।', '点击一个面来放置。'],
  ...presetRows('keyhole'),
  'keyhole.preset.screw': [
    'Tornillo {size} mm · cabeza Ø {head}',
    '{size} mm screw · head Ø {head}',
    'Schraube {size} mm · Kopf Ø {head}',
    'Vis {size} mm · tête Ø {head}',
    '{size} mm स्क्रू · हेड Ø {head}',
    '{size} mm 螺丝 · 头 Ø {head}',
  ],
  'keyhole.screw': ['Tornillo (mm)', 'Screw (mm)', 'Schraube (mm)', 'Vis (mm)', 'स्क्रू (mm)', '螺丝 (mm)'],
  'keyhole.head': ['Entrada (cabeza) Ø (mm)', 'Entry (head) Ø (mm)', 'Eingang (Kopf) Ø (mm)', 'Entrée (tête) Ø (mm)', 'प्रवेश (हेड) Ø (mm)', '入口（螺丝头）Ø (mm)'],
  'keyhole.neck': ['Ancho del cuello (mm)', 'Neck width (mm)', 'Halsbreite (mm)', 'Largeur du col (mm)', 'गर्दन की चौड़ाई (mm)', '颈部宽度 (mm)'],
  'keyhole.slot': ['Largo de la ranura (mm)', 'Slot length (mm)', 'Schlitzlänge (mm)', 'Longueur de la fente (mm)', 'स्लॉट की लंबाई (mm)', '槽长 (mm)'],
  'keyhole.chamber': ['Fondo de la cámara (mm)', 'Chamber depth (mm)', 'Kammertiefe (mm)', 'Profondeur de la chambre (mm)', 'कक्ष की गहराई (mm)', '腔深 (mm)'],
  'keyhole.lip': ['Labio sobre la cámara (mm)', 'Lip over the chamber (mm)', 'Lippe über der Kammer (mm)', 'Lèvre sur la chambre (mm)', 'कक्ष के ऊपर होंठ (mm)', '腔上方唇厚 (mm)'],
  'keyhole.angle': ['Giro de la ranura (°)', 'Slot rotation (°)', 'Schlitzdrehung (°)', 'Rotation de la fente (°)', 'स्लॉट घुमाव (°)', '槽口旋转 (°)'],
  'keyhole.startNote': [
    'Son valores típicos, por verificar: mide la cabeza y la caña de tu tornillo e imprime una prueba antes de la pieza final.',
    'These are typical values, to be verified: measure your screw’s head and shank and print a test first.',
    'Typische Werte, zu prüfen: Miss Kopf und Schaft deiner Schraube und drucke zuerst einen Test.',
    'Valeurs typiques, à vérifier : mesure la tête et la tige de ta vis et imprime un essai d’abord.',
    'ये सामान्य मान हैं, जाँचना बाकी: अपने स्क्रू का हेड और शैंक नापें और पहले एक परीक्षण छापें।',
    '这些是典型值，待验证：先量好螺丝头和螺杆，再打印测试件。',
  ],
  'keyhole.summary': [
    'Entrada Ø {head} mm, cuello {neck} × {slot} mm, cámara {chamber} mm bajo un labio de {lip} mm (fondo total {depth} mm).',
    'Entry Ø {head} mm, neck {neck} × {slot} mm, {chamber} mm chamber under a {lip} mm lip ({depth} mm deep in total).',
    'Eingang Ø {head} mm, Hals {neck} × {slot} mm, Kammer {chamber} mm unter {lip} mm Lippe (gesamt {depth} mm tief).',
    'Entrée Ø {head} mm, col {neck} × {slot} mm, chambre {chamber} mm sous une lèvre de {lip} mm ({depth} mm au total).',
    'प्रवेश Ø {head} mm, गर्दन {neck} × {slot} mm, {lip} mm होंठ के नीचे {chamber} mm कक्ष (कुल गहराई {depth} mm)।',
    '入口 Ø {head} mm，颈部 {neck} × {slot} mm，{lip} mm 唇下 {chamber} mm 腔（总深 {depth} mm）。',
  ],
  'keyhole.summaryInvalid': [
    'Medidas no válidas: el cuello debe ser al menos 0,5 mm más angosto que la cabeza y la ranura lo bastante larga para que la cabeza quede bajo el labio.',
    'Invalid sizes: the neck must be at least 0.5 mm narrower than the head and the slot long enough for the head to sit under the lip.',
    'Ungültige Maße: Der Hals muss mindestens 0,5 mm schmaler als der Kopf sein und der Schlitz lang genug, damit der Kopf unter der Lippe liegt.',
    'Mesures non valides : le col doit être au moins 0,5 mm plus étroit que la tête et la fente assez longue pour que la tête passe sous la lèvre.',
    'अमान्य माप: गर्दन हेड से कम से कम 0.5 mm संकरी हो और स्लॉट इतना लंबा कि हेड होंठ के नीचे आ जाए।',
    '尺寸无效：颈部至少比螺丝头窄 0.5 mm，槽要足够长，让螺丝头卡在唇下。',
  ],
  'keyhole.objectName': ['Ojo de cerradura {size} mm', 'Keyhole {size} mm', 'Schlüsselloch {size} mm', 'Trou de serrure {size} mm', 'कीहोल {size} mm', '钥匙孔 {size} mm'],
  'keyhole.created': [
    '{name} agregado como pieza negativa: se resta al aplicar las restas.',
    '{name} added as a negative part: it is cut when you apply holes.',
    '{name} als Negativteil hinzugefügt: wird beim Anwenden der Löcher abgezogen.',
    '{name} ajouté comme pièce négative : il est soustrait en appliquant les trous.',
    '{name} नकारात्मक भाग के रूप में जोड़ा गया: छेद लागू करने पर घटेगा।',
    '已添加 {name}（负体）：应用减法时扣除。',
  ],
  'keyhole.placed': ['{name} agregado.', '{name} added.', '{name} hinzugefügt.', '{name} ajouté.', '{name} जोड़ा गया।', '已添加 {name}。'],
  'keyhole.error.tooWide': [
    'El ojo no cabe ahí: la figura es más ancha que la cara en esa zona. Elige una zona más amplia o un tornillo menor.',
    'The keyhole does not fit there: it is wider than the face in that area. Pick a wider area or a smaller screw.',
    'Das Schlüsselloch passt dort nicht: Es ist breiter als die Fläche an dieser Stelle. Wähle eine breitere Stelle oder eine kleinere Schraube.',
    'Le trou ne tient pas là : il est plus large que la face à cet endroit. Choisis une zone plus large ou une vis plus petite.',
    'कीहोल वहाँ नहीं समाता: उस जगह यह फलक से चौड़ा है। चौड़ी जगह या छोटा स्क्रू चुनें।',
    '钥匙孔放不下：比该处的面更宽。请选择更宽的区域或更小的螺丝。',
  ],
  'keyhole.warn.through': [
    'La cámara atraviesa la pieza: el labio sigue reteniendo la cabeza, pero quedará un agujero a la vista por el otro lado. Si no lo quieres, usa una cara más gruesa o baja el fondo de la cámara.',
    'The chamber goes through the part: the lip still holds the head, but a hole will show on the other side. If you do not want it, use a thicker face or reduce the chamber depth.',
    'Die Kammer geht durch das Teil: Die Lippe hält den Kopf weiterhin, aber auf der anderen Seite bleibt ein sichtbares Loch. Wenn du das nicht willst, nutze eine dickere Fläche oder verringere die Kammertiefe.',
    'La chambre traverse la pièce : la lèvre retient toujours la tête, mais un trou restera visible de l’autre côté. Si tu n’en veux pas, utilise une face plus épaisse ou réduis la profondeur.',
    'कक्ष भाग के आर-पार जाता है: किनारा हेड को फिर भी थामे रखता है, पर दूसरी ओर छेद दिखेगा। अगर यह नहीं चाहिए, तो मोटा फलक लें या कक्ष की गहराई घटाएँ।',
    '腔体穿透零件：唇边仍能卡住螺丝头，但另一面会露出孔。若不希望如此，请用更厚的面或减小腔深。',
  ],
  'keyhole.warn.wall': [
    'Detrás de la cámara quedan {wall} mm de material (mínimo recomendado {min} mm): puede romperse al colgar.',
    'Only {wall} mm of material is left behind the chamber (recommended minimum {min} mm): it may break when hung.',
    'Hinter der Kammer bleiben nur {wall} mm Material (empfohlen mindestens {min} mm): Es kann beim Aufhängen brechen.',
    'Il ne reste que {wall} mm de matière derrière la chambre (minimum conseillé {min} mm) : risque de casse.',
    'कक्ष के पीछे केवल {wall} mm सामग्री बचती है (अनुशंसित न्यूनतम {min} mm): टाँगने पर टूट सकता है।',
    '腔体后方只剩 {wall} mm 材料（建议至少 {min} mm）：挂起时可能断裂。',
  ],
  'keyhole.warn.edge': [
    'La figura se asoma por el borde de la cara: muévela hacia adentro.',
    'The keyhole sticks out past the edge of the face: move it inward.',
    'Das Schlüsselloch ragt über den Flächenrand: Verschiebe es nach innen.',
    'Le trou dépasse du bord de la face : déplace-le vers l’intérieur.',
    'कीहोल फलक के किनारे से बाहर निकलता है: इसे अंदर की ओर ले जाएँ।',
    '钥匙孔超出了面的边缘：请往里移。',
  ],
  'keyhole.warn.level': [
    'No está a la misma altura que otro ojo de esta cara (diferencia {mm} mm): la pieza colgaría torcida.',
    'It is not level with another keyhole on this face ({mm} mm apart): the part would hang crooked.',
    'Nicht auf gleicher Höhe wie ein anderes Schlüsselloch dieser Fläche ({mm} mm Unterschied): Das Teil hinge schief.',
    'Pas à la même hauteur qu’un autre trou de cette face ({mm} mm d’écart) : la pièce pendrait de travers.',
    'इस फलक के दूसरे कीहोल की ऊँचाई पर नहीं है ({mm} mm अंतर): भाग टेढ़ा लटकेगा।',
    '与本面另一个钥匙孔不在同一高度（相差 {mm} mm）：零件会挂歪。',
  ],
  'keyhole.warn.face': [
    'Esta cara no es vertical: normalmente el ojo va en la cara que mira al muro.',
    'This face is not vertical: the keyhole usually goes on the face that touches the wall.',
    'Diese Fläche ist nicht senkrecht: Das Schlüsselloch gehört meist auf die Fläche zur Wand.',
    'Cette face n’est pas verticale : le trou se place d’habitude sur la face côté mur.',
    'यह फलक खड़ा नहीं है: कीहोल आमतौर पर दीवार की ओर वाले फलक पर होता है।',
    '此面不是竖直的：钥匙孔通常放在贴墙的那一面。',
  ],
  'keyhole.short.through': ['La cámara atraviesa.', 'The chamber goes through.', 'Die Kammer geht durch.', 'La chambre traverse.', 'कक्ष आर-पार है।', '腔体穿透。'],
  'keyhole.short.wall': ['Pared delgada detrás.', 'Thin wall behind.', 'Dünne Wand dahinter.', 'Paroi fine derrière.', 'पीछे पतली दीवार।', '后壁过薄。'],
  'keyhole.short.edge': ['Se asoma por el borde.', 'Sticks out at the edge.', 'Ragt über den Rand.', 'Dépasse du bord.', 'किनारे से बाहर।', '超出边缘。'],
  'keyhole.short.level': ['No está a la misma altura.', 'Not level.', 'Nicht auf gleicher Höhe.', 'Pas à la même hauteur.', 'ऊँचाई बराबर नहीं।', '高度不一致。'],
  'keyhole.short.face': ['Cara no vertical.', 'Face is not vertical.', 'Fläche nicht senkrecht.', 'Face non verticale.', 'फलक खड़ा नहीं।', '面不竖直。'],
  'keyhole.lastOk': [
    'Último ojo sin avisos: quedan {wall} mm detrás de la cámara.',
    'Last keyhole has no warnings: {wall} mm left behind the chamber.',
    'Letztes Schlüsselloch ohne Warnungen: {wall} mm hinter der Kammer.',
    'Dernier trou sans alerte : {wall} mm derrière la chambre.',
    'पिछले कीहोल में कोई चेतावनी नहीं: कक्ष के पीछे {wall} mm।',
    '上一个钥匙孔无警告：腔体后方 {wall} mm。',
  ],
} satisfies Record<string, Row>;

type ColgarMuroKey = keyof typeof TABLE;

const pick = (index: number) => pickColumn<ColgarMuroKey>(TABLE, index);

export const COLGAR_MURO_ES = pick(0);
export const COLGAR_MURO_EN = pick(1);
export const COLGAR_MURO_DE = pick(2);
export const COLGAR_MURO_FR = pick(3);
export const COLGAR_MURO_HI = pick(4);
export const COLGAR_MURO_ZH = pick(5);
