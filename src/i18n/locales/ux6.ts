/**
 * @file src/i18n/locales/ux6.ts
 * @description Textos del lote ux6 en los 6 idiomas: vista sin cama, barra lateral izquierda de tres
 * estados (completa, compacta, oculta), pista y acople del panel de Medir, y diálogo «¿En qué unidad está
 * este modelo?». Cada clave se escribe una vez con sus 6 idiomas; `UX6_<IDIOMA>` se mezcla en cada
 * diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const UX6 = {
  // Vista sin cama
  'ux6.bed.toggle': { es: 'Sin cama', en: 'No bed', de: 'Ohne Druckbett', fr: 'Sans plateau', hi: 'बेड के बिना', zh: '隐藏打印床' },
  'ux6.bed.toggleTip': {
    es: 'Ocultar la cama (rejilla, rótulo y volumen de impresión) para ver las piezas flotando y cómo se conectan (B)',
    en: 'Hide the bed (grid, label and print volume) to see the parts floating and how they connect (B)',
    de: 'Druckbett ausblenden (Raster, Beschriftung und Druckvolumen), um die Teile schwebend zu sehen und wie sie sich verbinden (B)',
    fr: 'Masquer le plateau (grille, étiquette et volume d’impression) pour voir les pièces flotter et comment elles s’assemblent (B)',
    hi: 'बेड (ग्रिड, लेबल और प्रिंट आयतन) छिपाएँ ताकि भाग तैरते दिखें और पता चले कि वे कैसे जुड़ते हैं (B)',
    zh: '隐藏打印床(网格、标签和打印体积),让零件悬浮显示,便于查看它们如何连接(B)',
  },
  'ux6.bed.hiddenChip': { es: 'Cama oculta', en: 'Bed hidden', de: 'Druckbett ausgeblendet', fr: 'Plateau masqué', hi: 'बेड छिपा है', zh: '打印床已隐藏' },
  'ux6.bed.hiddenChipTip': {
    es: 'La cama ({printer}) está oculta. Púlsalo para mostrarla de nuevo (B)',
    en: 'The bed ({printer}) is hidden. Press to show it again (B)',
    de: 'Das Druckbett ({printer}) ist ausgeblendet. Drücke hier, um es wieder anzuzeigen (B)',
    fr: 'Le plateau ({printer}) est masqué. Appuie pour l’afficher de nouveau (B)',
    hi: 'बेड ({printer}) छिपा है। इसे फिर दिखाने के लिए दबाएँ (B)',
    zh: '打印床({printer})已隐藏。点按可重新显示(B)',
  },
  'ux6.bed.cmdHide': { es: 'Vista sin cama (piezas flotando)', en: 'View without bed (floating parts)', de: 'Ansicht ohne Druckbett (schwebende Teile)', fr: 'Vue sans plateau (pièces flottantes)', hi: 'बेड के बिना दृश्य (तैरते भाग)', zh: '无打印床视图(零件悬浮)' },
  'ux6.bed.cmdShow': { es: 'Mostrar la cama', en: 'Show the bed', de: 'Druckbett anzeigen', fr: 'Afficher le plateau', hi: 'बेड दिखाएँ', zh: '显示打印床' },
  'ux6.menu.view': { es: 'Vista', en: 'View', de: 'Ansicht', fr: 'Vue', hi: 'दृश्य', zh: '视图' },
  'ux6.bed.shortcut': { es: 'Mostrar u ocultar la cama', en: 'Show or hide the bed', de: 'Druckbett ein- oder ausblenden', fr: 'Afficher ou masquer le plateau', hi: 'बेड दिखाएँ या छिपाएँ', zh: '显示或隐藏打印床' },

  // Barra lateral izquierda de tres estados
  'ux6.sidebar.cmdHidden': { es: 'Ocultar la barra lateral', en: 'Hide the sidebar', de: 'Seitenleiste ausblenden', fr: 'Masquer la barre latérale', hi: 'साइडबार छिपाएँ', zh: '隐藏侧边栏' },

  // Medir
  'ux6.measure.missClick': { es: 'Haz clic en un punto de la pieza', en: 'Click a point on the part', de: 'Klicke auf einen Punkt des Teils', fr: 'Cliquez sur un point de la pièce', hi: 'भाग के किसी बिंदु पर क्लिक करें', zh: '点击零件上的一个点' },
  'ux6.measure.dockRight': { es: 'Mover el panel al borde derecho', en: 'Move the panel to the right edge', de: 'Bereich an den rechten Rand verschieben', fr: 'Déplacer le panneau vers le bord droit', hi: 'पैनल को दाएँ किनारे पर ले जाएँ', zh: '将面板移到右侧' },
  'ux6.measure.dockLeft': { es: 'Mover el panel al borde izquierdo', en: 'Move the panel to the left edge', de: 'Bereich an den linken Rand verschieben', fr: 'Déplacer le panneau vers le bord gauche', hi: 'पैनल को बाएँ किनारे पर ले जाएँ', zh: '将面板移到左侧' },

  // Diálogo de unidades
  'ux6.unit.other': { es: 'Otra unidad…', en: 'Other unit…', de: 'Andere Einheit…', fr: 'Autre unité…', hi: 'दूसरी इकाई…', zh: '其他单位…' },
  'ux6.unit.title': { es: '¿En qué unidad está este modelo?', en: 'What unit is this model in?', de: 'In welcher Einheit ist dieses Modell?', fr: 'Dans quelle unité est ce modèle ?', hi: 'यह मॉडल किस इकाई में है?', zh: '这个模型使用什么单位?' },
  'ux6.unit.intro': {
    es: '«{name}» mide {size} mm en su lado mayor. Elige la unidad en que se dibujó: el cambio se deshace en un solo paso.',
    en: '“{name}” measures {size} mm on its longest side. Choose the unit it was drawn in: the change undoes in a single step.',
    de: '„{name}“ misst an der längsten Seite {size} mm. Wähle die Einheit, in der es gezeichnet wurde: Die Änderung lässt sich in einem Schritt rückgängig machen.',
    fr: '« {name} » mesure {size} mm sur son plus grand côté. Choisissez l’unité dans laquelle il a été dessiné : la modification s’annule en une seule étape.',
    hi: '«{name}» की सबसे लंबी भुजा {size} mm है। वह इकाई चुनें जिसमें इसे बनाया गया था: बदलाव एक ही चरण में पूर्ववत होता है।',
    zh: '「{name}」最长边为 {size} mm。请选择绘制时使用的单位:此更改可一步撤销。',
  },
  'ux6.unit.kind.meters': { es: 'Metros', en: 'Meters', de: 'Meter', fr: 'Mètres', hi: 'मीटर', zh: '米' },
  'ux6.unit.kind.inches': { es: 'Pulgadas', en: 'Inches', de: 'Zoll', fr: 'Pouces', hi: 'इंच', zh: '英寸' },
  'ux6.unit.kind.centimeters': { es: 'Centímetros', en: 'Centimeters', de: 'Zentimeter', fr: 'Centimètres', hi: 'सेंटीमीटर', zh: '厘米' },
  'ux6.unit.kind.times100': { es: 'Otra escala', en: 'Another scale', de: 'Anderer Maßstab', fr: 'Autre échelle', hi: 'दूसरा पैमाना', zh: '其他比例' },
  'ux6.unit.kind.micrometers': { es: 'Micrómetros', en: 'Micrometers', de: 'Mikrometer', fr: 'Micromètres', hi: 'माइक्रोमीटर', zh: '微米' },
  'ux6.unit.result': { es: '×{factor} · queda en {size} mm', en: '×{factor} · becomes {size} mm', de: '×{factor} · ergibt {size} mm', fr: '×{factor} · devient {size} mm', hi: '×{factor} · {size} mm हो जाएगा', zh: '×{factor} · 变为 {size} mm' },
  'ux6.unit.fit': { es: 'Ajustar el lado mayor a', en: 'Fit the longest side to', de: 'Längste Seite anpassen auf', fr: 'Ajuster le plus grand côté à', hi: 'सबसे लंबी भुजा को इतना करें', zh: '将最长边调整为' },
  'ux6.unit.fitInvalid': { es: 'Escribe un tamaño entre 1 y 5000 mm.', en: 'Enter a size between 1 and 5000 mm.', de: 'Gib eine Größe zwischen 1 und 5000 mm ein.', fr: 'Saisissez une taille entre 1 et 5000 mm.', hi: '1 से 5000 mm के बीच आकार लिखें।', zh: '请输入 1 到 5000 mm 之间的尺寸。' },
  'ux6.unit.apply': { es: 'Aplicar', en: 'Apply', de: 'Anwenden', fr: 'Appliquer', hi: 'लागू करें', zh: '应用' },
  'ux6.unit.options': { es: 'Unidad del modelo', en: 'Model unit', de: 'Einheit des Modells', fr: 'Unité du modèle', hi: 'मॉडल की इकाई', zh: '模型单位' },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof UX6]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(UX6).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const UX6_ES = pick('es');
export const UX6_EN = pick('en');
export const UX6_DE = pick('de');
export const UX6_FR = pick('fr');
export const UX6_HI = pick('hi');
export const UX6_ZH = pick('zh');
