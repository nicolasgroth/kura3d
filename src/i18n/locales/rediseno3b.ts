/**
 * @file src/i18n/locales/rediseno3b.ts
 * @description Textos de los ajustes al rediseño (lote 3b) en los 6 idiomas: motivos de herramienta apagada, panel
 * derecho por herramienta, secciones plegables, operaciones compactas y paleta de pintura personalizable. Cada
 * clave se escribe una vez con sus 6 idiomas; `REDISENO3B_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const REDISENO3B = {
  // Herramientas apagadas
  'rediseno3b.reason.emptyScene': { es: 'la escena está vacía: agrega o importa un objeto', en: 'the scene is empty: add or import an object', de: 'die Szene ist leer: füge ein Objekt hinzu oder importiere eines', fr: 'la scène est vide : ajoute ou importe un objet', hi: 'दृश्य खाली है: कोई वस्तु जोड़ें या आयात करें', zh: '场景为空:请添加或导入对象' },
  'rediseno3b.reason.noEditable': { es: 'todos los objetos están ocultos o con candado', en: 'every object is hidden or locked', de: 'alle Objekte sind ausgeblendet oder gesperrt', fr: 'tous les objets sont masqués ou verrouillés', hi: 'सभी वस्तुएँ छिपी या लॉक हैं', zh: '所有对象均已隐藏或锁定' },
  'rediseno3b.reason.noPaintable': { es: 'no hay objetos que se puedan pintar (ocultos, con candado o de referencia)', en: 'no object can be painted (hidden, locked or reference)', de: 'kein Objekt kann bemalt werden (ausgeblendet, gesperrt oder Referenz)', fr: 'aucun objet ne peut être peint (masqué, verrouillé ou de référence)', hi: 'रंगने योग्य कोई वस्तु नहीं (छिपी, लॉक या संदर्भ)', zh: '没有可上色的对象(已隐藏、已锁定或为参考)' },
  'rediseno3b.reason.noVisible': { es: 'todos los objetos están ocultos', en: 'every object is hidden', de: 'alle Objekte sind ausgeblendet', fr: 'tous les objets sont masqués', hi: 'सभी वस्तुएँ छिपी हैं', zh: '所有对象均已隐藏' },
  'rediseno3b.reason.toolOff': { es: '{tool} no disponible: {reason}', en: '{tool} unavailable: {reason}', de: '{tool} nicht verfügbar: {reason}', fr: '{tool} indisponible : {reason}', hi: '{tool} उपलब्ध नहीं: {reason}', zh: '{tool}不可用:{reason}' },

  // Panel por herramienta
  'rediseno3b.panel.paintOptions': { es: 'Pincel y colores', en: 'Brush and colors', de: 'Pinsel und Farben', fr: 'Pinceau et couleurs', hi: 'ब्रश और रंग', zh: '画笔与颜色' },
  'rediseno3b.panel.pickObject': { es: 'Haz clic en un objeto para usar la herramienta', en: 'Click an object to use the tool', de: 'Klicke auf ein Objekt, um das Werkzeug zu nutzen', fr: 'Clique sur un objet pour utiliser l’outil', hi: 'टूल इस्तेमाल करने के लिए किसी वस्तु पर क्लिक करें', zh: '单击对象即可使用该工具' },
  'rediseno3b.panel.measureHint': { es: 'Haz clic en dos puntos de la pieza; las medidas aparecen en la barra del visor.', en: 'Click two points on the part; the measurements appear in the viewport bar.', de: 'Klicke auf zwei Punkte des Teils; die Maße erscheinen in der Leiste der Ansicht.', fr: 'Clique sur deux points de la pièce ; les mesures apparaissent dans la barre de la vue.', hi: 'भाग पर दो बिंदुओं पर क्लिक करें; माप व्यूपोर्ट बार में दिखते हैं।', zh: '在零件上单击两个点;测量结果显示在视图栏中。' },
  'rediseno3b.panel.showSummary': { es: 'Ver todo el objeto', en: 'Show the whole object', de: 'Ganzes Objekt zeigen', fr: 'Voir tout l’objet', hi: 'पूरी वस्तु दिखाएँ', zh: '查看整个对象' },
  'rediseno3b.panel.showSummaryTip': { es: 'Vuelve al resumen completo del objeto (como con Seleccionar)', en: 'Back to the full object summary (as with Select)', de: 'Zurück zur vollständigen Objektübersicht (wie bei Auswählen)', fr: 'Revenir au résumé complet de l’objet (comme avec Sélectionner)', hi: 'वस्तु के पूरे सारांश पर लौटें (चुनें की तरह)', zh: '返回完整的对象摘要(与"选择"相同)' },

  // Secciones plegables
  'rediseno3b.fold.collapse': { es: 'Plegar «{name}»', en: 'Collapse “{name}”', de: '„{name}“ einklappen', fr: 'Replier « {name} »', hi: '“{name}” समेटें', zh: '折叠"{name}"' },
  'rediseno3b.fold.expand': { es: 'Desplegar «{name}»', en: 'Expand “{name}”', de: '„{name}“ ausklappen', fr: 'Déplier « {name} »', hi: '“{name}” फैलाएँ', zh: '展开"{name}"' },
  'rediseno3b.fold.parameters': { es: 'Parámetros', en: 'Parameters', de: 'Parameter', fr: 'Paramètres', hi: 'पैरामीटर', zh: '参数' },
  'rediseno3b.fold.transform': { es: 'Transformación', en: 'Transform', de: 'Transformation', fr: 'Transformation', hi: 'रूपांतरण', zh: '变换' },

  // Operaciones compactas
  'rediseno3b.ops.moreVariants': { es: 'Más variantes', en: 'More variants', de: 'Weitere Varianten', fr: 'Plus de variantes', hi: 'और विकल्प', zh: '更多变体' },
  'rediseno3b.ops.chooseDepth': { es: 'Elegir la profundidad', en: 'Choose the depth', de: 'Tiefe wählen', fr: 'Choisir la profondeur', hi: 'गहराई चुनें', zh: '选择深度' },
  'rediseno3b.ops.variants': { es: 'Variantes de {name}', en: '{name} variants', de: 'Varianten von {name}', fr: 'Variantes de {name}', hi: '{name} के विकल्प', zh: '{name}的变体' },

  // Paleta de pintura
  'rediseno3b.palette.editHint': { es: 'clic derecho o Mayús+F10 para cambiarla', en: 'right-click or Shift+F10 to change it', de: 'Rechtsklick oder Umschalt+F10 zum Ändern', fr: 'clic droit ou Maj+F10 pour la modifier', hi: 'बदलने के लिए राइट-क्लिक या Shift+F10', zh: '右键单击或按 Shift+F10 进行修改' },
  'rediseno3b.palette.editTitle': { es: 'Muestra: {name}', en: 'Swatch: {name}', de: 'Farbfeld: {name}', fr: 'Échantillon : {name}', hi: 'नमूना: {name}', zh: '色样:{name}' },
  'rediseno3b.palette.change': { es: 'Cambiar el color', en: 'Change the color', de: 'Farbe ändern', fr: 'Changer la couleur', hi: 'रंग बदलें', zh: '更改颜色' },
  'rediseno3b.palette.remove': { es: 'Quitar de la paleta', en: 'Remove from the palette', de: 'Aus der Palette entfernen', fr: 'Retirer de la palette', hi: 'पैलेट से हटाएँ', zh: '从调色板移除' },
  'rediseno3b.palette.removeOff': { es: 'La paleta necesita al menos un color', en: 'The palette needs at least one color', de: 'Die Palette braucht mindestens eine Farbe', fr: 'La palette doit garder au moins une couleur', hi: 'पैलेट में कम से कम एक रंग होना चाहिए', zh: '调色板至少需要一种颜色' },
  'rediseno3b.palette.add': { es: 'Agregar el color actual a la paleta', en: 'Add the current color to the palette', de: 'Aktuelle Farbe zur Palette hinzufügen', fr: 'Ajouter la couleur actuelle à la palette', hi: 'मौजूदा रंग पैलेट में जोड़ें', zh: '将当前颜色添加到调色板' },
  'rediseno3b.palette.addOff': { es: 'El color actual ya está en la paleta (elige otro con el selector de color)', en: 'The current color is already in the palette (pick another with the color picker)', de: 'Die aktuelle Farbe ist schon in der Palette (wähle eine andere mit der Farbauswahl)', fr: 'La couleur actuelle est déjà dans la palette (choisis-en une autre avec le sélecteur)', hi: 'मौजूदा रंग पहले से पैलेट में है (रंग चयनक से दूसरा चुनें)', zh: '当前颜色已在调色板中(请用取色器选择其他颜色)' },
  'rediseno3b.palette.options': { es: 'Opciones de la paleta', en: 'Palette options', de: 'Palettenoptionen', fr: 'Options de la palette', hi: 'पैलेट विकल्प', zh: '调色板选项' },
  'rediseno3b.palette.close': { es: 'Cerrar', en: 'Close', de: 'Schließen', fr: 'Fermer', hi: 'बंद करें', zh: '关闭' },
  'rediseno3b.palette.preset': { es: 'Paleta', en: 'Palette', de: 'Palette', fr: 'Palette', hi: 'पैलेट', zh: '调色板' },
  'rediseno3b.palette.preset.original': { es: 'Original', en: 'Original', de: 'Original', fr: 'Originale', hi: 'मूल', zh: '原始' },
  'rediseno3b.palette.preset.vivid': { es: 'Vivos', en: 'Vivid', de: 'Kräftig', fr: 'Vives', hi: 'चटकीले', zh: '鲜艳' },
  'rediseno3b.palette.preset.sober': { es: 'Sobrios', en: 'Sober', de: 'Dezent', fr: 'Sobres', hi: 'सौम्य', zh: '沉稳' },
  'rediseno3b.palette.preset.pastel': { es: 'Pastel', en: 'Pastel', de: 'Pastell', fr: 'Pastel', hi: 'पेस्टल', zh: '粉彩' },
  'rediseno3b.palette.preset.grays': { es: 'Escala de grises', en: 'Grayscale', de: 'Graustufen', fr: 'Niveaux de gris', hi: 'ग्रेस्केल', zh: '灰度' },
  'rediseno3b.palette.preset.custom': { es: 'Personalizada', en: 'Custom', de: 'Eigene', fr: 'Personnalisée', hi: 'कस्टम', zh: '自定义' },
  'rediseno3b.palette.project': { es: 'Agregar los colores del proyecto', en: 'Add the project colors', de: 'Farben des Projekts hinzufügen', fr: 'Ajouter les couleurs du projet', hi: 'प्रोजेक्ट के रंग जोड़ें', zh: '添加项目中的颜色' },
  'rediseno3b.palette.projectTip': { es: 'Suma a la paleta los colores del proyecto que le faltan (hay {count}), de más a menos usado', en: 'Add the project colors the palette is missing (there are {count}), most used first', de: 'Fügt der Palette die fehlenden Farben des Projekts hinzu ({count} vorhanden), die häufigsten zuerst', fr: 'Ajoute à la palette les couleurs du projet qui lui manquent ({count} en tout), des plus utilisées aux moins utilisées', hi: 'पैलेट में प्रोजेक्ट के वे रंग जोड़ें जो उसमें नहीं हैं (कुल {count}), सबसे ज़्यादा इस्तेमाल वाले पहले', zh: '把调色板中缺少的项目颜色加进去(共 {count} 种),按使用量从多到少' },
  'rediseno3b.palette.projectOff': { es: 'El proyecto todavía no tiene colores', en: 'The project has no colors yet', de: 'Das Projekt hat noch keine Farben', fr: 'Le projet n’a pas encore de couleurs', hi: 'प्रोजेक्ट में अभी कोई रंग नहीं है', zh: '项目中尚无颜色' },
  'rediseno3b.palette.reset': { es: 'Volver a la paleta original', en: 'Back to the original palette', de: 'Zurück zur Originalpalette', fr: 'Revenir à la palette originale', hi: 'मूल पैलेट पर लौटें', zh: '恢复原始调色板' },
  'rediseno3b.palette.more': { es: '{count} más', en: '{count} more', de: '{count} weitere', fr: '{count} de plus', hi: '{count} और', zh: '另外 {count} 种' },
  'rediseno3b.palette.less': { es: 'Mostrar menos', en: 'Show less', de: 'Weniger zeigen', fr: 'Afficher moins', hi: 'कम दिखाएँ', zh: '收起' },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof REDISENO3B]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(REDISENO3B).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const REDISENO3B_ES = pick('es');
export const REDISENO3B_EN = pick('en');
export const REDISENO3B_DE = pick('de');
export const REDISENO3B_FR = pick('fr');
export const REDISENO3B_HI = pick('hi');
export const REDISENO3B_ZH = pick('zh');
