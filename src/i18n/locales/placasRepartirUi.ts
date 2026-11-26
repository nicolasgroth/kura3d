/**
 * @file src/i18n/locales/placasRepartirUi.ts
 * @description Textos del panel «Repartir en placas…» (lote de interfaz de placas) en los 6 idiomas: opciones con su
 * ayuda, resumen de la vista previa, motivos de lo que no cabe, entradas (tira, menú, paleta, aviso «Fuera de volumen»)
 * y avisos de resultado. Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const PLATES_ARRANGE_UI_TABLE = {
  'plates.arrangeDlg.entry': ['Repartir en placas…', 'Arrange on plates…', 'Auf Platten verteilen…', 'Répartir sur les plateaux…', 'प्लेटों पर बाँटें…', '分配到打印板…'],
  'plates.arrangeDlg.entryTip': [
    'Abre las opciones para repartir las piezas en placas y muestra antes cómo quedarían.',
    'Opens the options to spread parts over plates and shows how they would end up first.',
    'Öffnet die Optionen zum Verteilen der Teile auf Platten und zeigt vorab das Ergebnis.',
    'Ouvre les options pour répartir les pièces sur des plateaux et montre d’abord le résultat.',
    'पुर्ज़ों को प्लेटों पर बाँटने के विकल्प खोलता है और पहले नतीजा दिखाता है।',
    '打开分配零件到打印板的选项，并先预览结果。',
  ],
  'plates.arrangeDlg.strip': ['Repartir…', 'Arrange…', 'Verteilen…', 'Répartir…', 'बाँटें…', '分配…'],
  'plates.arrangeDlg.apply': ['Repartir', 'Arrange', 'Verteilen', 'Répartir', 'बाँटें', '分配'],
  'plates.arrangeDlg.applyTip': [
    'Reparte las piezas con estas opciones, en un solo paso que se puede deshacer.',
    'Arranges the parts with these options, in a single step you can undo.',
    'Verteilt die Teile mit diesen Optionen in einem einzigen Schritt, der sich rückgängig machen lässt.',
    'Répartit les pièces avec ces options, en une seule étape annulable.',
    'इन विकल्पों से पुर्ज़ों को बाँटता है, एक ही चरण में जिसे पूर्ववत किया जा सकता है।',
    '按这些选项分配零件，作为可撤销的单一步骤。',
  ],
  'plates.arrangeDlg.applyBusy': ['Repartiendo…', 'Arranging…', 'Wird verteilt…', 'Répartition…', 'बाँटा जा रहा है…', '正在分配…'],

  // Qué repartir
  'plates.arrangeDlg.scope': ['Qué repartir', 'What to arrange', 'Was verteilen', 'Que répartir', 'क्या बाँटना है', '分配范围'],
  'plates.arrangeDlg.scope.selection': [
    'La selección ({count} {count?pieza|piezas})',
    'The selection ({count} {count?part|parts})',
    'Die Auswahl ({count} {count?Teil|Teile})',
    'La sélection ({count} {count?pièce|pièces})',
    'चयन ({count} {count?हिस्सा|हिस्से})',
    '所选内容（{count} 个零件）',
  ],
  'plates.arrangeDlg.scope.all': [
    'Todas las piezas visibles ({count} {count?pieza|piezas})',
    'All visible parts ({count} {count?part|parts})',
    'Alle sichtbaren Teile ({count} {count?Teil|Teile})',
    'Toutes les pièces visibles ({count} {count?pièce|pièces})',
    'सभी दिखने वाले हिस्से ({count} {count?हिस्सा|हिस्से})',
    '所有可见零件（{count} 个）',
  ],
  'plates.arrangeDlg.scope.help': [
    'Las piezas bloqueadas, las referencias y los negativos sueltos no se mueven.',
    'Locked parts, references and loose negatives do not move.',
    'Gesperrte Teile, Referenzen und lose Negative bewegen sich nicht.',
    'Les pièces verrouillées, les références et les négatifs isolés ne bougent pas.',
    'लॉक किए हिस्से, संदर्भ और अकेले नेगेटिव नहीं हिलते।',
    '已锁定的零件、参考件和单独的负形不会移动。',
  ],

  // Criterio
  'plates.arrangeDlg.criterion': ['Cómo repartir', 'How to arrange', 'Wie verteilen', 'Comment répartir', 'कैसे बाँटना है', '分配方式'],
  'plates.arrangeDlg.crit.compact': ['Compacto', 'Compact', 'Kompakt', 'Compact', 'सघन', '紧凑'],
  'plates.arrangeDlg.crit.compact.help': [
    'Usa la menor cantidad de placas posible.',
    'Uses as few plates as possible.',
    'Verwendet so wenige Platten wie möglich.',
    'Utilise le moins de plateaux possible.',
    'जितनी हो सके उतनी कम प्लेटें इस्तेमाल करता है।',
    '尽量使用最少的打印板。',
  ],
  'plates.arrangeDlg.crit.byColor': ['Una placa por color', 'One plate per color', 'Eine Platte pro Farbe', 'Un plateau par couleur', 'हर रंग के लिए एक प्लेट', '每种颜色一块板'],
  'plates.arrangeDlg.crit.byColor.help': [
    'Nunca mezcla dos colores en la misma placa; cada color abre las suyas.',
    'Never mixes two colors on one plate; each color opens its own.',
    'Mischt nie zwei Farben auf einer Platte; jede Farbe bekommt eigene Platten.',
    'Ne mélange jamais deux couleurs sur un plateau ; chaque couleur ouvre les siens.',
    'एक प्लेट पर दो रंग नहीं मिलाता; हर रंग की अपनी प्लेटें खुलती हैं।',
    '同一块板上不混放两种颜色，每种颜色使用各自的板。',
  ],
  'plates.arrangeDlg.crit.byGroup': ['Una placa por grupo', 'One plate per group', 'Eine Platte pro Gruppe', 'Un plateau par groupe', 'हर समूह के लिए एक प्लेट', '每个分组一块板'],
  'plates.arrangeDlg.crit.byGroup.help': [
    'Mantiene junto cada grupo. Las piezas sin grupo van por su cuenta.',
    'Keeps each group together. Parts without a group go on their own.',
    'Hält jede Gruppe zusammen. Teile ohne Gruppe stehen für sich.',
    'Garde chaque groupe ensemble. Les pièces sans groupe vont à part.',
    'हर समूह को साथ रखता है। बिना समूह वाले हिस्से अलग रखे जाते हैं।',
    '让每个分组保持在一起，没有分组的零件单独放置。',
  ],

  // Orientación
  'plates.arrangeDlg.orient': ['Orientación', 'Orientation', 'Ausrichtung', 'Orientation', 'अभिविन्यास', '朝向'],
  'plates.arrangeDlg.orient.keep': ['Mantener', 'Keep', 'Beibehalten', 'Conserver', 'जैसा है वैसा रखें', '保持'],
  'plates.arrangeDlg.orient.keep.help': [
    'Cada pieza conserva su giro; solo cambia de lugar.',
    'Each part keeps its rotation; only its place changes.',
    'Jedes Teil behält seine Drehung; nur der Platz ändert sich.',
    'Chaque pièce garde sa rotation ; seule sa place change.',
    'हर हिस्सा अपना घुमाव रखता है; सिर्फ़ जगह बदलती है।',
    '每个零件保持原有旋转，只改变位置。',
  ],
  'plates.arrangeDlg.orient.flatDown': ['Cara plana abajo', 'Flat face down', 'Ebene Fläche unten', 'Face plane vers le bas', 'समतल सतह नीचे', '平面朝下'],
  'plates.arrangeDlg.orient.flatDown.help': [
    'Apoya cada pieza en su cara plana más grande. Puede tardar más con piezas pesadas.',
    'Rests each part on its largest flat face. May take longer with heavy parts.',
    'Legt jedes Teil auf seine größte ebene Fläche. Kann bei schweren Teilen länger dauern.',
    'Pose chaque pièce sur sa plus grande face plane. Peut être plus long avec des pièces lourdes.',
    'हर हिस्से को उसकी सबसे बड़ी समतल सतह पर रखता है। भारी हिस्सों में अधिक समय लग सकता है।',
    '把每个零件放在最大的平面上。零件较复杂时可能耗时更久。',
  ],

  // Separación y margen
  'plates.arrangeDlg.spacing': ['Separación entre piezas', 'Space between parts', 'Abstand zwischen Teilen', 'Écart entre pièces', 'हिस्सों के बीच की दूरी', '零件间距'],
  'plates.arrangeDlg.spacing.help': [
    'Espacio libre mínimo entre dos piezas, en mm.',
    'Minimum free space between two parts, in mm.',
    'Mindestabstand zwischen zwei Teilen, in mm.',
    'Espace libre minimal entre deux pièces, en mm.',
    'दो हिस्सों के बीच न्यूनतम खाली जगह, मिमी में।',
    '两个零件之间的最小空隙，单位毫米。',
  ],
  'plates.arrangeDlg.margin': ['Margen al borde', 'Edge margin', 'Randabstand', 'Marge au bord', 'किनारे का हाशिया', '边缘留白'],
  'plates.arrangeDlg.margin.help': [
    'Espacio libre entre las piezas y el borde de la cama, en mm. Si la cama tiene un margen mayor, se usa ese.',
    'Free space between parts and the bed edge, in mm. If the bed has a larger margin, that one is used.',
    'Freier Raum zwischen Teilen und Bettrand, in mm. Hat das Druckbett einen größeren Rand, gilt dieser.',
    'Espace libre entre les pièces et le bord du plateau, en mm. Si le plateau a une marge plus grande, elle prime.',
    'हिस्सों और बेड के किनारे के बीच खाली जगह, मिमी में। बेड का हाशिया बड़ा हो तो वही लिया जाता है।',
    '零件与打印床边缘之间的空隙，单位毫米。若打印床自带的边距更大，则以它为准。',
  ],

  // Vista previa
  'plates.arrangeDlg.preview': ['Resultado previsto', 'Expected result', 'Voraussichtliches Ergebnis', 'Résultat prévu', 'अपेक्षित नतीजा', '预计结果'],
  'plates.arrangeDlg.preview.running': ['Calculando el reparto…', 'Working out the arrangement…', 'Anordnung wird berechnet…', 'Calcul de la répartition…', 'बँटवारा निकाला जा रहा है…', '正在计算分配…'],
  'plates.arrangeDlg.preview.cancel': ['Cancelar cálculo', 'Cancel calculation', 'Berechnung abbrechen', 'Annuler le calcul', 'गणना रद्द करें', '取消计算'],
  'plates.arrangeDlg.preview.cancelled': [
    'Cálculo cancelado. Cambia una opción para calcular de nuevo.',
    'Calculation cancelled. Change an option to calculate again.',
    'Berechnung abgebrochen. Ändere eine Option, um neu zu berechnen.',
    'Calcul annulé. Modifie une option pour recalculer.',
    'गणना रद्द हुई। फिर से गणना के लिए कोई विकल्प बदलें।',
    '已取消计算。更改任一选项即可重新计算。',
  ],
  'plates.arrangeDlg.preview.failed': [
    'No se pudo calcular el reparto. Revisa el aviso y cambia una opción para reintentar.',
    'The arrangement could not be calculated. Check the notice and change an option to retry.',
    'Die Anordnung konnte nicht berechnet werden. Prüfe den Hinweis und ändere eine Option, um es erneut zu versuchen.',
    'La répartition n’a pas pu être calculée. Vérifie l’avis et modifie une option pour réessayer.',
    'बँटवारा नहीं निकाला जा सका। सूचना देखें और दोबारा कोशिश के लिए कोई विकल्प बदलें।',
    '无法计算分配。请查看提示，并更改任一选项重试。',
  ],
  'plates.arrangeDlg.preview.onePerObject': [
    'Cada pieza irá a su propia placa; las placas que falten se crean.',
    'Each part will go to its own plate; missing plates are created.',
    'Jedes Teil kommt auf eine eigene Platte; fehlende Platten werden angelegt.',
    'Chaque pièce ira sur son propre plateau ; les plateaux manquants sont créés.',
    'हर हिस्सा अपनी प्लेट पर जाएगा; जो प्लेटें कम हों वे बनाई जाएँगी।',
    '每个零件放到各自的板上，缺少的板会自动创建。',
  ],
  'plates.arrangeDlg.preview.plates': [
    '{plates?Se usará|Se usarán} {plates} {plates?placa|placas} ({created} {created?nueva|nuevas}).',
    '{plates} {plates?plate|plates} will be used ({created} new).',
    'Es {plates?wird|werden} {plates} {plates?Platte|Platten} verwendet ({created} neu).',
    '{plates} {plates?plateau sera utilisé|plateaux seront utilisés} ({created} {created?nouveau|nouveaux}).',
    '{plates} प्लेट इस्तेमाल होंगी ({created} नई)।',
    '将使用 {plates} 块板（其中 {created} 块为新建）。',
  ],
  'plates.arrangeDlg.preview.platesNoNew': [
    '{plates?Se usará|Se usarán} {plates} {plates?placa existente|placas existentes}, sin crear placas nuevas.',
    '{plates} existing {plates?plate|plates} will be used, without creating new plates.',
    'Es {plates?wird|werden} {plates} {plates?vorhandene Platte|vorhandene Platten} verwendet, ohne neue Platten anzulegen.',
    '{plates} {plates?plateau existant sera utilisé|plateaux existants seront utilisés}, sans créer de nouveaux plateaux.',
    '{plates} मौजूदा प्लेट इस्तेमाल होंगी, कोई नई प्लेट नहीं बनेगी।',
    '将使用 {plates} 块现有的板，不新建板。',
  ],
  'plates.arrangeDlg.preview.placed': [
    '{count} {count?pieza colocada|piezas colocadas}.',
    '{count} {count?part|parts} placed.',
    '{count} {count?Teil|Teile} platziert.',
    '{count} {count?pièce placée|pièces placées}.',
    '{count} {count?हिस्सा रखा गया|हिस्से रखे गए}।',
    '已放置 {count} 个零件。',
  ],
  'plates.arrangeDlg.preview.unplaced': [
    '{count} {count?pieza no cabe|piezas no caben} y se {count?queda|quedan} donde {count?está|están}:',
    '{count} {count?part does|parts do} not fit and will stay where {count?it is|they are}:',
    '{count} {count?Teil passt|Teile passen} nicht und {count?bleibt|bleiben} an {count?seinem|ihrem} Platz:',
    '{count} {count?pièce ne tient|pièces ne tiennent} pas et {count?reste|restent} en place :',
    '{count} {count?हिस्सा नहीं समाता|हिस्से नहीं समाते} और अपनी जगह पर {count?रहेगा|रहेंगे}:',
    '有 {count} 个零件放不下，将保持原位：',
  ],
  'plates.arrangeDlg.preview.reason.tooLarge': [
    'es más grande que la cama',
    'is larger than the bed',
    'ist größer als das Druckbett',
    'est plus grande que le plateau',
    'बेड से बड़ा है',
    '比打印床大',
  ],
  'plates.arrangeDlg.preview.reason.tooTall': [
    'es más alta que el volumen de impresión',
    'is taller than the print volume',
    'ist höher als das Druckvolumen',
    'est plus haute que le volume d’impression',
    'प्रिंट वॉल्यूम से ऊँचा है',
    '比打印空间更高',
  ],
  'plates.arrangeDlg.preview.reason.noRoom': [
    'no queda espacio: se alcanzó el máximo de placas',
    'no room left: the plate limit was reached',
    'kein Platz mehr: die maximale Plattenzahl ist erreicht',
    'plus de place : le nombre maximal de plateaux est atteint',
    'जगह नहीं बची: प्लेटों की अधिकतम संख्या पूरी हो गई',
    '没有空位：已达到打印板数量上限',
  ],
  'plates.arrangeDlg.preview.reason.empty': [
    'no tiene geometría',
    'has no geometry',
    'hat keine Geometrie',
    'n’a pas de géométrie',
    'में ज्यामिति नहीं है',
    '没有几何形状',
  ],
  'plates.arrangeDlg.preview.skipped': [
    '{count} {count?pieza omitida|piezas omitidas} (no se {count?mueve|mueven}):',
    '{count} {count?part|parts} skipped (will not move):',
    '{count} {count?Teil|Teile} übersprungen (bewegt sich nicht):',
    '{count} {count?pièce ignorée|pièces ignorées} (ne bougera pas) :',
    '{count} {count?हिस्सा छोड़ा गया|हिस्से छोड़े गए} (नहीं हिलेंगे):',
    '已跳过 {count} 个零件（不会移动）：',
  ],
  'plates.arrangeDlg.preview.skipped.locked': ['está bloqueada', 'is locked', 'ist gesperrt', 'est verrouillée', 'लॉक है', '已锁定'],
  'plates.arrangeDlg.preview.skipped.lockedPlate': [
    'está en una placa bloqueada',
    'is on a locked plate',
    'liegt auf einer gesperrten Platte',
    'est sur un plateau verrouillé',
    'लॉक प्लेट पर है',
    '位于已锁定的板上',
  ],
  'plates.arrangeDlg.preview.split': [
    'El grupo «{name}» no cabe en una placa y queda partido en {count} placas.',
    'The group “{name}” does not fit on one plate and is split over {count} plates.',
    'Die Gruppe „{name}“ passt nicht auf eine Platte und wird auf {count} Platten aufgeteilt.',
    'Le groupe « {name} » ne tient pas sur un plateau et est réparti sur {count} plateaux.',
    'समूह «{name}» एक प्लेट पर नहीं समाता और {count} प्लेटों में बँट जाता है।',
    '分组「{name}」一块板放不下，将拆分到 {count} 块板上。',
  ],
  'plates.arrangeDlg.preview.kept': [
    '{count} {count?pieza conservó|piezas conservaron} su orientación: no tiene{count?|n} una cara plana donde apoyarse.',
    '{count} {count?part kept|parts kept} {count?its|their} orientation: no flat face to rest on.',
    '{count} {count?Teil behielt|Teile behielten} {count?seine|ihre} Ausrichtung: keine ebene Auflagefläche.',
    '{count} {count?pièce a gardé|pièces ont gardé} son orientation : aucune face plane où se poser.',
    '{count} {count?हिस्से ने|हिस्सों ने} अपना अभिविन्यास रखा: टिकने के लिए समतल सतह नहीं है।',
    '有 {count} 个零件保持了原有朝向：没有可以放平的平面。',
  ],
  'plates.arrangeDlg.preview.ghostNote': [
    'Los contornos del visor muestran dónde quedaría cada pieza.',
    'The outlines in the viewport show where each part would go.',
    'Die Umrisse im Viewport zeigen, wohin jedes Teil käme.',
    'Les contours dans la vue montrent où irait chaque pièce.',
    'व्यूपोर्ट की रूपरेखाएँ दिखाती हैं कि हर हिस्सा कहाँ जाएगा।',
    '视口中的轮廓显示每个零件将放置的位置。',
  ],
  'plates.arrangeDlg.preview.noGhost': [
    'Son demasiadas piezas para dibujar sus contornos en el visor; el resumen sigue valiendo.',
    'There are too many parts to draw their outlines in the viewport; the summary still applies.',
    'Zu viele Teile, um ihre Umrisse im Viewport zu zeichnen; die Zusammenfassung gilt weiterhin.',
    'Trop de pièces pour dessiner leurs contours dans la vue ; le résumé reste valable.',
    'व्यूपोर्ट में रूपरेखा खींचने के लिए हिस्से बहुत ज़्यादा हैं; सारांश फिर भी सही है।',
    '零件太多，无法在视口中绘制轮廓；上方摘要依然有效。',
  ],

  // Avisos de resultado
  'plates.arrangeDlg.toast.done': [
    '{count} {count?pieza repartida|piezas repartidas} en {plates} {plates?placa|placas} ({created} {created?nueva|nuevas}).',
    '{count} {count?part|parts} arranged on {plates} {plates?plate|plates} ({created} new).',
    '{count} {count?Teil|Teile} auf {plates} {plates?Platte|Platten} verteilt ({created} neu).',
    '{count} {count?pièce répartie|pièces réparties} sur {plates} {plates?plateau|plateaux} ({created} {created?nouveau|nouveaux}).',
    '{count} {count?हिस्सा|हिस्से} {plates} प्लेटों पर बाँटे गए ({created} नई)।',
    '已将 {count} 个零件分配到 {plates} 块板（新建 {created} 块）。',
  ],
  'plates.arrangeDlg.toast.doneNoNew': [
    '{count} {count?pieza repartida|piezas repartidas} en {plates} {plates?placa existente|placas existentes}.',
    '{count} {count?part|parts} arranged on {plates} existing {plates?plate|plates}.',
    '{count} {count?Teil|Teile} auf {plates} {plates?vorhandene Platte|vorhandene Platten} verteilt.',
    '{count} {count?pièce répartie|pièces réparties} sur {plates} {plates?plateau existant|plateaux existants}.',
    '{count} {count?हिस्सा|हिस्से} {plates} मौजूदा प्लेटों पर बाँटे गए।',
    '已将 {count} 个零件分配到 {plates} 块现有的板。',
  ],
  'plates.arrangeDlg.toast.switched': [
    'Pasaste a la vista Imprimir para ver el resultado.',
    'Switched to the Print view to show the result.',
    'Zur Druckansicht gewechselt, um das Ergebnis zu zeigen.',
    'Passage à la vue Impression pour montrer le résultat.',
    'नतीजा दिखाने के लिए प्रिंट दृश्य पर बदला गया।',
    '已切换到打印视图以显示结果。',
  ],
  'plates.arrangeDlg.toast.unplaced': [
    'No cupieron y quedaron donde estaban: {list}.',
    'These did not fit and stayed where they were: {list}.',
    'Diese passten nicht und blieben an ihrem Platz: {list}.',
    'Celles-ci n’ont pas tenu et sont restées en place : {list}.',
    'ये नहीं समाए और अपनी जगह पर रहे: {list}.',
    '以下零件放不下，保持原位：{list}。',
  ],
  'plates.arrangeDlg.toast.more': ['y {count} más', 'and {count} more', 'und {count} weitere', 'et {count} de plus', 'और {count}', '等 {count} 个'],
} as const satisfies Record<string, Row>;

type PlatesArrangeUiKey = keyof typeof PLATES_ARRANGE_UI_TABLE;

const pick = (index: number): Record<PlatesArrangeUiKey, string> =>
  Object.fromEntries(Object.entries(PLATES_ARRANGE_UI_TABLE).map(([key, row]) => [key, row[index]])) as Record<PlatesArrangeUiKey, string>;

export const PLATES_ARRANGE_UI_ES = pick(0);
export const PLATES_ARRANGE_UI_EN = pick(1);
export const PLATES_ARRANGE_UI_DE = pick(2);
export const PLATES_ARRANGE_UI_FR = pick(3);
export const PLATES_ARRANGE_UI_HI = pick(4);
export const PLATES_ARRANGE_UI_ZH = pick(5);
