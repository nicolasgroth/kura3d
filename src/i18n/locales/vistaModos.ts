/**
 * @file src/i18n/locales/vistaModos.ts
 * @description Textos del selector de modos de vista Imprimir / Armado / Libre (lote P4 «Modos de vista» de placas) en
 * los 6 idiomas: selector, motivos de rechazo, rótulo de la vista armada, separación visual, nota de la tira de placas,
 * chip de cama y nota de «Comprobar encaje». Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const VIEW_MODE_TABLE = {
  'viewMode.group': ['Modo de vista', 'View mode', 'Ansichtsmodus', 'Mode de vue', 'दृश्य मोड', '视图模式'],
  'viewMode.print': ['Imprimir', 'Print', 'Drucken', 'Impression', 'प्रिंट', '打印'],
  'viewMode.assembly': ['Armado', 'Assembled', 'Zusammengebaut', 'Assemblé', 'जुड़ा हुआ', '装配'],
  'viewMode.free': ['Libre', 'Free', 'Frei', 'Libre', 'मुक्त', '自由'],
  'viewMode.print.tip': [
    'Imprimir: las piezas sobre sus placas, listas para imprimir',
    'Print: parts on their plates, ready to print',
    'Drucken: Teile auf ihren Platten, bereit zum Drucken',
    'Impression : les pièces sur leurs plateaux, prêtes à imprimer',
    'प्रिंट: हिस्से अपनी प्लेटों पर, प्रिंट के लिए तैयार',
    '打印:零件放在各自的打印板上,可直接打印',
  ],
  'viewMode.assembly.tip': [
    'Armado: la figura con las piezas en su posición final',
    'Assembled: the figure with parts in their final position',
    'Zusammengebaut: die Figur mit den Teilen in ihrer Endposition',
    'Assemblé : la figure avec les pièces à leur position finale',
    'जुड़ा हुआ: हिस्सों को उनकी अंतिम स्थिति में रखी आकृति',
    '装配:零件处于最终位置的完整造型',
  ],
  'viewMode.free.tip': [
    'Libre: como Armado, sin plano de apoyo ni avisos de cama',
    'Free: like Assembled, without a ground plane or bed warnings',
    'Frei: wie Zusammengebaut, ohne Standfläche und ohne Bett-Hinweise',
    'Libre : comme Assemblé, sans plan d’appui ni avertissements de plateau',
    'मुक्त: जुड़े हुए जैसा, बिना आधार तल और बेड चेतावनियों के',
    '自由:与装配相同,但没有承托平面和打印板提示',
  ],
  'viewMode.shortcut': [
    'Cambiar de vista: Imprimir, Armado, Libre',
    'Switch view: Print, Assembled, Free',
    'Ansicht wechseln: Drucken, Zusammengebaut, Frei',
    'Changer de vue : Impression, Assemblé, Libre',
    'दृश्य बदलें: प्रिंट, जुड़ा हुआ, मुक्त',
    '切换视图:打印、装配、自由',
  ],
  'viewMode.changed': ['Vista: {mode}', 'View: {mode}', 'Ansicht: {mode}', 'Vue : {mode}', 'दृश्य: {mode}', '视图:{mode}'],
  'viewMode.reason.printOnly': [
    'Disponible en la vista Imprimir',
    'Available in the Print view',
    'In der Ansicht „Drucken“ verfügbar',
    'Disponible dans la vue Impression',
    'प्रिंट दृश्य में उपलब्ध',
    '仅在“打印”视图中可用',
  ],
  'viewMode.blocked.busy': [
    'No se puede cambiar de vista mientras hay una operación en curso. La vista sigue igual.',
    'The view cannot change while an operation is running. The view stays as it was.',
    'Die Ansicht kann während eines laufenden Vorgangs nicht gewechselt werden. Sie bleibt unverändert.',
    'Impossible de changer de vue pendant une opération en cours. La vue reste inchangée.',
    'ऑपरेशन चलने के दौरान दृश्य नहीं बदला जा सकता। दृश्य पहले जैसा रहेगा।',
    '操作进行期间无法切换视图,视图保持不变。',
  ],
  'viewMode.blocked.stroke': [
    'Termina el trazo de pintura antes de cambiar de vista. La vista sigue igual.',
    'Finish the paint stroke before changing the view. The view stays as it was.',
    'Beende den Malstrich, bevor du die Ansicht wechselst. Sie bleibt unverändert.',
    'Terminez le trait de peinture avant de changer de vue. La vue reste inchangée.',
    'दृश्य बदलने से पहले पेंट स्ट्रोक पूरा करें। दृश्य पहले जैसा रहेगा।',
    '切换视图前请先完成涂色笔画,视图保持不变。',
  ],
  // Rótulo persistente del visor.
  'viewMode.badge.assembly': ['Vista armada', 'Assembled view', 'Ansicht zusammengebaut', 'Vue assemblée', 'जुड़ा हुआ दृश्य', '装配视图'],
  'viewMode.badge.free': ['Vista libre', 'Free view', 'Freie Ansicht', 'Vue libre', 'मुक्त दृश्य', '自由视图'],
  'viewMode.badge.note': [
    'Mover piezas aquí no cambia su lugar en la placa. Al volver a Imprimir, regresan a su placa.',
    'Moving parts here does not change their place on the plate. Back in Print they return to their plate.',
    'Teile hier zu verschieben ändert ihren Platz auf der Platte nicht. Zurück in „Drucken“ liegen sie wieder auf ihrer Platte.',
    'Déplacer des pièces ici ne change pas leur place sur le plateau. De retour en Impression, elles retrouvent leur plateau.',
    'यहाँ हिस्से हिलाने से प्लेट पर उनकी जगह नहीं बदलती। प्रिंट में लौटने पर वे अपनी प्लेट पर लौट आते हैं।',
    '在此移动零件不会改变其在打印板上的位置;回到“打印”视图后,它们会回到各自的打印板。',
  ],
  'viewMode.badge.back': ['Volver a Imprimir', 'Back to Print', 'Zurück zu „Drucken“', 'Retour à Impression', 'प्रिंट पर लौटें', '返回打印视图'],
  'viewMode.badge.label': [
    'Estás en la {mode}. Los cambios de posición aquí no mueven las piezas de su placa.',
    'You are in the {mode}. Position changes here do not move parts on their plate.',
    'Du bist in der {mode}. Positionsänderungen hier verschieben die Teile auf ihrer Platte nicht.',
    'Vous êtes dans la {mode}. Les changements de position ici ne déplacent pas les pièces sur leur plateau.',
    'आप {mode} में हैं। यहाँ स्थिति बदलने से हिस्से अपनी प्लेट पर नहीं हिलते।',
    '当前为{mode}。在此更改位置不会移动零件在打印板上的位置。',
  ],
  // Separación visual.
  'viewMode.explode.label': ['Separación', 'Separation', 'Auseinanderziehen', 'Écartement', 'अलगाव', '分离'],
  'viewMode.explode.tip': [
    'Separa las piezas solo para verlas: no mueve nada ni queda en el historial',
    'Pulls parts apart just to look: nothing moves and nothing enters the history',
    'Zieht die Teile nur zur Ansicht auseinander: nichts wird verschoben, nichts landet im Verlauf',
    'Écarte les pièces pour les voir : rien ne bouge et rien n’entre dans l’historique',
    'हिस्सों को केवल देखने के लिए अलग करता है: कुछ नहीं हिलता और इतिहास में कुछ नहीं जुड़ता',
    '仅为查看而分开零件:不会移动任何东西,也不进入历史记录',
  ],
  'viewMode.explode.scope': ['Qué separar', 'What to separate', 'Was auseinanderziehen', 'Quoi écarter', 'क्या अलग करें', '分离范围'],
  'viewMode.explode.scope.all': ['Toda la figura', 'Whole figure', 'Ganze Figur', 'Toute la figure', 'पूरी आकृति', '整个造型'],
  'viewMode.explode.scope.group': ['Grupo seleccionado', 'Selected group', 'Ausgewählte Gruppe', 'Groupe sélectionné', 'चयनित समूह', '所选分组'],
  'viewMode.explode.value': ['{pct} % separado', '{pct} % separated', '{pct} % auseinandergezogen', '{pct} % écarté', '{pct} % अलग', '已分离 {pct}%'],
  'viewMode.explode.reset': ['Juntar piezas', 'Bring parts together', 'Teile zusammenführen', 'Rassembler les pièces', 'हिस्से जोड़ें', '合拢零件'],
  // Tira de placas, chip de cama y encaje.
  'viewMode.strip.note': [
    'Estás viendo la figura armada: las placas se editan en la vista Imprimir.',
    'You are viewing the assembled figure: plates are edited in the Print view.',
    'Du siehst die zusammengebaute Figur: Platten werden in der Ansicht „Drucken“ bearbeitet.',
    'Vous voyez la figure assemblée : les plateaux se modifient dans la vue Impression.',
    'आप जुड़ी हुई आकृति देख रहे हैं: प्लेटें प्रिंट दृश्य में संपादित होती हैं।',
    '当前显示装配后的造型:打印板请在“打印”视图中编辑。',
  ],
  'viewMode.bedChip': ['Sin cama en esta vista', 'No bed in this view', 'Kein Druckbett in dieser Ansicht', 'Pas de plateau dans cette vue', 'इस दृश्य में बेड नहीं', '此视图无打印板'],
  'viewMode.bedChip.tip': [
    'El volumen de impresión y «Fuera de volumen» se evalúan en la vista Imprimir. Pulsa para volver a Imprimir.',
    'The print volume and “Out of volume” are checked in the Print view. Press to return to Print.',
    'Druckvolumen und „Außerhalb des Volumens“ werden in der Ansicht „Drucken“ geprüft. Drücke, um zu „Drucken“ zurückzukehren.',
    'Le volume d’impression et « Hors volume » sont évalués dans la vue Impression. Appuyez pour revenir à Impression.',
    'प्रिंट वॉल्यूम और “वॉल्यूम से बाहर” की जाँच प्रिंट दृश्य में होती है। प्रिंट पर लौटने के लिए दबाएँ।',
    '打印体积和“超出体积”在“打印”视图中检查。点击返回“打印”视图。',
  ],
  'viewMode.fitCheck.note': [
    'Se comprueba con las piezas armadas, estés en la vista que estés.',
    'The check uses the assembled parts, whichever view you are in.',
    'Die Prüfung verwendet die zusammengebauten Teile, in welcher Ansicht du auch bist.',
    'La vérification utilise les pièces assemblées, quelle que soit la vue.',
    'जाँच जुड़े हुए हिस्सों से होती है, चाहे आप किसी भी दृश्य में हों।',
    '无论处于哪个视图,都使用装配后的零件进行检查。',
  ],
  'viewMode.newPiece': [
    'Pieza nueva junto a la figura, sin placa. Asígnala a una placa desde la vista Imprimir.',
    'New part placed next to the figure, on no plate. Assign it to a plate from the Print view.',
    'Neues Teil neben der Figur, auf keiner Platte. Weise es in der Ansicht „Drucken“ einer Platte zu.',
    'Nouvelle pièce placée près de la figure, sur aucun plateau. Affectez-la à un plateau depuis la vue Impression.',
    'नया हिस्सा आकृति के पास रखा गया, किसी प्लेट पर नहीं। इसे प्रिंट दृश्य से किसी प्लेट को सौंपें।',
    '新零件已放在造型旁边,不属于任何打印板。请在“打印”视图中把它分配到某块打印板。',
  ],
  'viewMode.split.note': [
    'En la vista armada, «Disponer grupo» es lo mismo que cambiar de vista: usa el selector Imprimir / Armado.',
    'In the assembled view, “Arrange group” is the same as switching view: use the Print / Assembled selector.',
    'In der zusammengebauten Ansicht entspricht „Gruppe anordnen“ dem Ansichtswechsel: nutze die Auswahl Drucken / Zusammengebaut.',
    'Dans la vue assemblée, « Disposer le groupe » revient à changer de vue : utilisez le sélecteur Impression / Assemblé.',
    'जुड़े दृश्य में “समूह व्यवस्थित करें” दृश्य बदलने जैसा ही है: प्रिंट / जुड़ा हुआ चयनकर्ता इस्तेमाल करें।',
    '在装配视图中,“排布分组”等同于切换视图:请使用“打印 / 装配”选择器。',
  ],
} as const satisfies Record<string, Row>;

type ViewModeKey = keyof typeof VIEW_MODE_TABLE;

const pick = (index: number): Record<ViewModeKey, string> =>
  Object.fromEntries(Object.entries(VIEW_MODE_TABLE).map(([key, row]) => [key, row[index]])) as Record<ViewModeKey, string>;

export const VIEW_MODE_ES = pick(0);
export const VIEW_MODE_EN = pick(1);
export const VIEW_MODE_DE = pick(2);
export const VIEW_MODE_FR = pick(3);
export const VIEW_MODE_HI = pick(4);
export const VIEW_MODE_ZH = pick(5);
