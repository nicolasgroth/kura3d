/**
 * @file src/i18n/locales/pasoCable.ts
 * @description Textos del paso de cable (panel, preajustes, avisos, nombres de objetos y entradas de menú). Cada
 * clave lleva [es, en, de, fr, hi, zh]; `PASO_CABLE_<IDIOMA>` se mezcla al final de cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { pickColumn, presetRows, type Row } from './addonPresetRows';

const TABLE = {
  'cable.title': ['Paso de cable', 'Cable pass-through', 'Kabeldurchführung', 'Passe-câble', 'केबल मार्ग', '过线孔'],
  'cable.menuTip': [
    'Un agujero que atraviesa la pared en el punto elegido, redondo u ovalado, con las bocas achaflanadas.',
    'A hole through the wall at the chosen point, round or slotted, with chamfered mouths.',
    'Ein Loch durch die Wand an der gewählten Stelle, rund oder als Langloch, mit gefasten Öffnungen.',
    'Un trou qui traverse la paroi au point choisi, rond ou oblong, avec les bords chanfreinés.',
    'चुने गए बिंदु पर दीवार के आर-पार छेद, गोल या लंबा, किनारों पर चैम्फर के साथ।',
    '在所选位置穿透壁面的孔，圆形或长圆形，孔口带倒角。',
  ],
  'cable.cmd.keywords': [
    'paso cable agujero pasante usb pasacable ranura conector',
    'cable pass through hole usb grommet slot connector',
    'kabel durchführung loch usb langloch stecker',
    'passe câble trou traversant usb fente connecteur',
    'केबल छेद usb स्लॉट cable hole',
    '过线 孔 穿线 usb 槽 cable hole',
  ],
  'cable.needSolid': [
    'Para colocar un paso de cable necesitas una pieza sólida visible y sin bloquear.',
    'To place a cable pass-through you need a visible, unlocked solid part.',
    'Für eine Kabeldurchführung brauchst du ein sichtbares, nicht gesperrtes festes Teil.',
    'Pour placer un passe-câble, il faut une pièce solide visible et non verrouillée.',
    'केबल मार्ग रखने के लिए एक दिखाई देने वाला, बिना लॉक वाला ठोस भाग चाहिए।',
    '放置过线孔需要一个可见且未锁定的实体零件。',
  ],
  'cable.hint': [
    'Haz clic sobre una pared: el agujero la atraviesa en ese punto (el largo se mide solo). Puedes colocar varios; Escape o «Volver» termina.',
    'Click a wall: the hole goes through it at that point (the length is measured for you). You can place several; Escape or “Back” finishes.',
    'Klicke auf eine Wand: Das Loch geht dort hindurch (die Länge wird gemessen). Du kannst mehrere setzen; Escape oder „Zurück“ beendet.',
    'Clique sur une paroi : le trou la traverse à cet endroit (la longueur est mesurée). Tu peux en placer plusieurs ; Échap ou « Retour » termine.',
    'किसी दीवार पर क्लिक करें: छेद उस बिंदु पर आर-पार जाता है (लंबाई अपने आप नापी जाती है)। आप कई रख सकते हैं; Escape या “वापस” से समाप्त करें।',
    '点击一面壁：孔会在该处穿透（长度自动测量）。可以放置多个；按 Escape 或“返回”结束。',
  ],
  'cable.invalid': [
    'Corrige las medidas marcadas para poder colocar.',
    'Fix the marked sizes to be able to place.',
    'Korrigiere die markierten Maße, um setzen zu können.',
    'Corrige les mesures signalées pour pouvoir placer.',
    'रखने के लिए चिह्नित माप ठीक करें।',
    '请修正标记的尺寸后再放置。',
  ],
  'cable.fold.label': ['Paso de cable', 'Cable pass-through', 'Kabeldurchführung', 'Passe-câble', 'केबल मार्ग', '过线孔'],
  'cable.fold.empty': ['Haz clic sobre una pared para colocar.', 'Click a wall to place.', 'Klicke auf eine Wand zum Setzen.', 'Clique sur une paroi pour placer.', 'रखने के लिए दीवार पर क्लिक करें।', '点击一面壁来放置。'],
  ...presetRows('cable'),
  'cable.preset.round': ['Redondo Ø {d}', 'Round Ø {d}', 'Rund Ø {d}', 'Rond Ø {d}', 'गोल Ø {d}', '圆形 Ø {d}'],
  'cable.preset.usbc': ['USB-C · {l} × {w}', 'USB-C · {l} × {w}', 'USB-C · {l} × {w}', 'USB-C · {l} × {w}', 'USB-C · {l} × {w}', 'USB-C · {l} × {w}'],
  'cable.preset.microusb': ['Micro-USB · {l} × {w}', 'Micro-USB · {l} × {w}', 'Micro-USB · {l} × {w}', 'Micro-USB · {l} × {w}', 'Micro-USB · {l} × {w}', 'Micro-USB · {l} × {w}'],
  'cable.preset.flat': ['Cable plano · {l} × {w}', 'Flat cable · {l} × {w}', 'Flachkabel · {l} × {w}', 'Câble plat · {l} × {w}', 'फ़्लैट केबल · {l} × {w}', '扁平线 · {l} × {w}'],
  'cable.shape': ['Forma', 'Shape', 'Form', 'Forme', 'आकार', '形状'],
  'cable.shape.round': ['Redondo', 'Round', 'Rund', 'Rond', 'गोल', '圆形'],
  'cable.shape.slot': ['Ranura', 'Slot', 'Langloch', 'Oblong', 'स्लॉट', '长圆槽'],
  'cable.diameter': ['Diámetro (mm)', 'Diameter (mm)', 'Durchmesser (mm)', 'Diamètre (mm)', 'व्यास (mm)', '直径 (mm)'],
  'cable.width': ['Alto de la ranura (mm)', 'Slot height (mm)', 'Langlochhöhe (mm)', 'Hauteur de la fente (mm)', 'स्लॉट की ऊँचाई (mm)', '槽高 (mm)'],
  'cable.length': ['Largo de la ranura (mm)', 'Slot length (mm)', 'Langlochlänge (mm)', 'Longueur de la fente (mm)', 'स्लॉट की लंबाई (mm)', '槽长 (mm)'],
  'cable.chamfer': ['Chaflán de las bocas (mm)', 'Mouth chamfer (mm)', 'Fase der Öffnungen (mm)', 'Chanfrein des bords (mm)', 'किनारे का चैम्फर (mm)', '孔口倒角 (mm)'],
  'cable.angle': ['Giro (°)', 'Rotation (°)', 'Drehung (°)', 'Rotation (°)', 'घुमाव (°)', '旋转 (°)'],
  'cable.autoDepth': [
    'Atravesar la pared (medir el largo solo)',
    'Go through the wall (measure the length)',
    'Durch die Wand (Länge messen)',
    'Traverser la paroi (mesurer la longueur)',
    'दीवार के आर-पार (लंबाई अपने आप नापें)',
    '穿透壁面（自动测量长度）',
  ],
  'cable.depth': ['Profundidad a mano (mm)', 'Manual depth (mm)', 'Tiefe von Hand (mm)', 'Profondeur manuelle (mm)', 'हाथ से गहराई (mm)', '手动深度 (mm)'],
  'cable.startNote': [
    'Son medidas típicas, por verificar: mide el cable o el conector que debe pasar y deja holgura.',
    'These are typical sizes, to be verified: measure the cable or plug that must pass and leave clearance.',
    'Typische Maße, zu prüfen: Miss Kabel oder Stecker, der durchpassen muss, und lass Spiel.',
    'Mesures typiques, à vérifier : mesure le câble ou la fiche qui doit passer et laisse du jeu.',
    'ये सामान्य माप हैं, जाँचना बाकी: जो केबल या प्लग गुज़रना है उसे नापें और थोड़ी जगह छोड़ें।',
    '这些是典型尺寸，待验证：量好要穿过的线或插头并留出余量。',
  ],
  'cable.summary.round': [
    'Agujero Ø {w} mm con chaflán de {c} mm; {depth}.',
    'Ø {w} mm hole with a {c} mm chamfer; {depth}.',
    'Loch Ø {w} mm mit {c} mm Fase; {depth}.',
    'Trou Ø {w} mm avec chanfrein de {c} mm ; {depth}.',
    'Ø {w} mm छेद, {c} mm चैम्फर; {depth}।',
    'Ø {w} mm 孔，倒角 {c} mm；{depth}。',
  ],
  'cable.summary.slot': [
    'Ranura de {l} × {w} mm con chaflán de {c} mm; {depth}.',
    '{l} × {w} mm slot with a {c} mm chamfer; {depth}.',
    'Langloch {l} × {w} mm mit {c} mm Fase; {depth}.',
    'Fente de {l} × {w} mm avec chanfrein de {c} mm ; {depth}.',
    '{l} × {w} mm स्लॉट, {c} mm चैम्फर; {depth}।',
    '{l} × {w} mm 长圆槽，倒角 {c} mm；{depth}。',
  ],
  'cable.summary.auto': ['atraviesa la pared', 'goes through the wall', 'geht durch die Wand', 'traverse la paroi', 'दीवार के आर-पार', '穿透壁面'],
  'cable.summary.manual': ['{d} mm de profundidad', '{d} mm deep', '{d} mm tief', '{d} mm de profondeur', '{d} mm गहरा', '深 {d} mm'],
  'cable.summaryInvalid': [
    'Medidas no válidas: revisa los campos marcados (en la ranura, el largo no puede ser menor que el alto).',
    'Invalid sizes: check the marked fields (in a slot, the length cannot be less than the height).',
    'Ungültige Maße: Prüfe die markierten Felder (beim Langloch darf die Länge nicht kleiner als die Höhe sein).',
    'Mesures non valides : vérifie les champs signalés (pour une fente, la longueur ne peut pas être inférieure à la hauteur).',
    'अमान्य माप: चिह्नित फ़ील्ड देखें (स्लॉट में लंबाई ऊँचाई से कम नहीं हो सकती)।',
    '尺寸无效：请检查标记的字段（长圆槽的长度不能小于高度）。',
  ],
  'cable.objectName': ['Paso de cable {size}', 'Cable pass {size}', 'Kabeldurchführung {size}', 'Passe-câble {size}', 'केबल मार्ग {size}', '过线孔 {size}'],
  'cable.created': [
    '{name} agregado como pieza negativa: se resta al aplicar las restas.',
    '{name} added as a negative part: it is cut when you apply holes.',
    '{name} als Negativteil hinzugefügt: wird beim Anwenden der Löcher abgezogen.',
    '{name} ajouté comme pièce négative : il est soustrait en appliquant les trous.',
    '{name} नकारात्मक भाग के रूप में जोड़ा गया: छेद लागू करने पर घटेगा।',
    '已添加 {name}（负体）：应用减法时扣除。',
  ],
  'cable.placed': ['{name} agregado.', '{name} added.', '{name} hinzugefügt.', '{name} ajouté.', '{name} जोड़ा गया।', '已添加 {name}。'],
  'cable.error.tooWide': [
    'El paso no cabe ahí: es más ancho que la cara en esa zona. Elige una zona más amplia o una medida menor.',
    'The pass-through does not fit there: it is wider than the face in that area. Pick a wider area or a smaller size.',
    'Die Durchführung passt dort nicht: Sie ist breiter als die Fläche an dieser Stelle. Wähle eine breitere Stelle oder ein kleineres Maß.',
    'Le passe-câble ne tient pas là : il est plus large que la face à cet endroit. Choisis une zone plus large ou une taille plus petite.',
    'केबल मार्ग वहाँ नहीं समाता: उस जगह यह फलक से चौड़ा है। चौड़ी जगह या छोटा माप चुनें।',
    '过线孔放不下：比该处的面更宽。请选择更宽的区域或更小的尺寸。',
  ],
  'cable.warn.noExit': [
    'La pared es más gruesa que {max} mm en ese punto: no se atraviesa sola. Se usó la profundidad a mano ({depth} mm); ajústala si quieres que pase.',
    'The wall is thicker than {max} mm there: it is not crossed automatically. The manual depth was used ({depth} mm); adjust it if it must go through.',
    'Die Wand ist dort dicker als {max} mm: Sie wird nicht automatisch durchbohrt. Die Tiefe von Hand wurde benutzt ({depth} mm); passe sie an.',
    'La paroi dépasse {max} mm à cet endroit : elle n’est pas traversée seule. La profondeur manuelle a été utilisée ({depth} mm) ; ajuste-la si besoin.',
    'उस बिंदु पर दीवार {max} mm से मोटी है: अपने आप आर-पार नहीं होगी। हाथ वाली गहराई ({depth} mm) ली गई; ज़रूरत हो तो बदलें।',
    '该处壁厚超过 {max} mm：不会自动穿透。已使用手动深度（{depth} mm）；如需穿透请调整。',
  ],
  'cable.warn.blind': [
    'El agujero no atraviesa: tiene {depth} mm y la pared {wall} mm. Activa «Atravesar la pared» o sube la profundidad.',
    'The hole does not go through: it is {depth} mm and the wall {wall} mm. Turn on “Go through the wall” or increase the depth.',
    'Das Loch geht nicht durch: {depth} mm bei {wall} mm Wand. Aktiviere „Durch die Wand“ oder erhöhe die Tiefe.',
    'Le trou ne traverse pas : {depth} mm pour une paroi de {wall} mm. Active « Traverser la paroi » ou augmente la profondeur.',
    'छेद आर-पार नहीं: {depth} mm है और दीवार {wall} mm। “दीवार के आर-पार” चालू करें या गहराई बढ़ाएँ।',
    '孔未穿透：深 {depth} mm，壁厚 {wall} mm。请打开“穿透壁面”或加大深度。',
  ],
  'cable.warn.edge': [
    'Queda a menos de {min} mm del borde de la cara: el borde puede romperse.',
    'It is less than {min} mm from the edge of the face: the edge may break.',
    'Weniger als {min} mm vom Flächenrand entfernt: Der Rand kann brechen.',
    'À moins de {min} mm du bord de la face : le bord peut casser.',
    'फलक के किनारे से {min} mm से कम दूरी पर: किनारा टूट सकता है।',
    '距面边缘不到 {min} mm：边缘可能断裂。',
  ],
  'cable.warn.addon': [
    'Queda a menos de {min} mm de otro agregado pendiente: sepáralos antes de aplicar las restas.',
    'It is less than {min} mm from another pending add-on: move them apart before applying holes.',
    'Weniger als {min} mm von einem anderen ausstehenden Zusatz entfernt: Trenne sie vor dem Anwenden der Löcher.',
    'À moins de {min} mm d’un autre ajout en attente : écarte-les avant d’appliquer les trous.',
    'दूसरे लंबित ऐड-ऑन से {min} mm से कम दूरी पर: छेद लागू करने से पहले अलग करें।',
    '距另一个待处理附加件不到 {min} mm：应用减法前请把它们分开。',
  ],
  'cable.short.noExit': ['Pared muy gruesa.', 'Wall too thick.', 'Wand zu dick.', 'Paroi trop épaisse.', 'दीवार बहुत मोटी।', '壁太厚。'],
  'cable.short.blind': ['No atraviesa.', 'Does not go through.', 'Geht nicht durch.', 'Ne traverse pas.', 'आर-पार नहीं।', '未穿透。'],
  'cable.short.edge': ['Cerca del borde.', 'Close to the edge.', 'Nah am Rand.', 'Près du bord.', 'किनारे के पास।', '靠近边缘。'],
  'cable.short.addon': ['Cerca de otro agregado.', 'Close to another add-on.', 'Nah an einem anderen Zusatz.', 'Près d’un autre ajout.', 'दूसरे ऐड-ऑन के पास।', '靠近其他附加件。'],
  'cable.lastOk': [
    'Último paso sin avisos: atraviesa {wall} mm de pared.',
    'Last pass-through has no warnings: it crosses a {wall} mm wall.',
    'Letzte Durchführung ohne Warnungen: durch {wall} mm Wand.',
    'Dernier passe-câble sans alerte : traverse {wall} mm de paroi.',
    'पिछले केबल मार्ग में कोई चेतावनी नहीं: {wall} mm दीवार पार।',
    '上一个过线孔无警告：穿透 {wall} mm 壁。',
  ],
} satisfies Record<string, Row>;

type PasoCableKey = keyof typeof TABLE;

const pick = (index: number) => pickColumn<PasoCableKey>(TABLE, index);

export const PASO_CABLE_ES = pick(0);
export const PASO_CABLE_EN = pick(1);
export const PASO_CABLE_DE = pick(2);
export const PASO_CABLE_FR = pick(3);
export const PASO_CABLE_HI = pick(4);
export const PASO_CABLE_ZH = pick(5);
