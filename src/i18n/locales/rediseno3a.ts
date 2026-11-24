/**
 * @file src/i18n/locales/rediseno3a.ts
 * @description Textos de los ajustes al rediseño (lote 3a) en los 6 idiomas: botón y panel Proyecto (acciones de
 * archivo, nombre editable, cama y unidades en línea), botón «Agregar» de la barra vertical, menú «Insertar»,
 * submenús de «Acciones», barra lateral de Escena, MCP sin rótulos y selector de idioma con bandera. Cada clave
 * se escribe una vez con sus 6 idiomas; `REDISENO3A_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const REDISENO3A = {
  // Botón y panel Proyecto
  'r3a.help.project': { es: 'Muestra el panel del proyecto: nombre, guardar, abrir, cama y unidades.', en: 'Shows the project panel: name, save, open, bed and units.', de: 'Zeigt das Projektfeld: Name, Speichern, Öffnen, Bett und Einheiten.', fr: 'Affiche le panneau du projet : nom, enregistrer, ouvrir, plateau et unités.', hi: 'प्रोजेक्ट पैनल दिखाता है: नाम, सहेजें, खोलें, बेड और इकाइयाँ।', zh: '显示项目面板:名称、保存、打开、打印床和单位。' },
  'r3a.project.file': { es: 'Archivo del proyecto', en: 'Project file', de: 'Projektdatei', fr: 'Fichier du projet', hi: 'प्रोजेक्ट फ़ाइल', zh: '项目文件' },
  'r3a.project.newShort': { es: 'Nuevo', en: 'New', de: 'Neu', fr: 'Nouveau', hi: 'नया', zh: '新建' },
  'r3a.project.openShort': { es: 'Abrir', en: 'Open', de: 'Öffnen', fr: 'Ouvrir', hi: 'खोलें', zh: '打开' },
  'r3a.project.saveShort': { es: 'Guardar', en: 'Save', de: 'Speichern', fr: 'Enregistrer', hi: 'सहेजें', zh: '保存' },
  'r3a.project.saveAsShort': { es: 'Guardar como', en: 'Save as', de: 'Speichern unter', fr: 'Enregistrer sous', hi: 'इस रूप में सहेजें', zh: '另存为' },
  'r3a.project.blocked': { es: 'Espera a que termine la operación en curso.', en: 'Wait for the current operation to finish.', de: 'Warte, bis der laufende Vorgang fertig ist.', fr: 'Attends la fin de l’opération en cours.', hi: 'चल रही प्रक्रिया पूरी होने तक रुकें।', zh: '请等待当前操作完成。' },

  // Nombre editable
  'r3a.name.edit': { es: 'Cambiar nombre del proyecto', en: 'Rename project', de: 'Projekt umbenennen', fr: 'Renommer le projet', hi: 'प्रोजेक्ट का नाम बदलें', zh: '重命名项目' },
  'r3a.name.editTip': { es: 'Cambiar nombre (Enter o F2)', en: 'Rename (Enter or F2)', de: 'Umbenennen (Enter oder F2)', fr: 'Renommer (Entrée ou F2)', hi: 'नाम बदलें (Enter या F2)', zh: '重命名(Enter 或 F2)' },
  'r3a.name.field': { es: 'Nombre del proyecto', en: 'Project name', de: 'Projektname', fr: 'Nom du projet', hi: 'प्रोजेक्ट का नाम', zh: '项目名称' },
  'r3a.name.hint': { es: 'Enter confirma · Esc cancela. Se usa al guardar.', en: 'Enter confirms · Esc cancels. Used when saving.', de: 'Enter bestätigt · Esc bricht ab. Wird beim Speichern verwendet.', fr: 'Entrée valide · Échap annule. Utilisé à l’enregistrement.', hi: 'Enter पुष्टि · Esc रद्द। सहेजते समय उपयोग होता है।', zh: 'Enter 确认 · Esc 取消。保存时使用。' },
  'r3a.name.empty': { es: 'El nombre no puede quedar vacío.', en: 'The name cannot be empty.', de: 'Der Name darf nicht leer sein.', fr: 'Le nom ne peut pas être vide.', hi: 'नाम खाली नहीं हो सकता।', zh: '名称不能为空。' },
  'r3a.name.confirm': { es: 'Confirmar nombre', en: 'Confirm name', de: 'Namen bestätigen', fr: 'Valider le nom', hi: 'नाम की पुष्टि करें', zh: '确认名称' },
  'r3a.name.cancel': { es: 'Cancelar cambio de nombre', en: 'Cancel rename', de: 'Umbenennen abbrechen', fr: 'Annuler le renommage', hi: 'नाम बदलना रद्द करें', zh: '取消重命名' },
  'r3a.name.renamed': { es: 'Proyecto renombrado a {name}. Guarda para conservarlo.', en: 'Project renamed to {name}. Save to keep it.', de: 'Projekt in {name} umbenannt. Speichern, um es zu behalten.', fr: 'Projet renommé en {name}. Enregistre pour le conserver.', hi: 'प्रोजेक्ट का नाम {name} किया गया। रखने के लिए सहेजें।', zh: '项目已重命名为 {name}。请保存以保留。' },

  // Cama y unidades en línea
  'r3a.bed.edit': { es: 'Cambiar cama activa', en: 'Change active bed', de: 'Aktives Bett ändern', fr: 'Changer le plateau actif', hi: 'सक्रिय बेड बदलें', zh: '更改当前打印床' },
  'r3a.units.edit': { es: 'Cambiar unidades', en: 'Change units', de: 'Einheiten ändern', fr: 'Changer les unités', hi: 'इकाइयाँ बदलें', zh: '更改单位' },
  'r3a.edit.done': { es: 'Listo', en: 'Done', de: 'Fertig', fr: 'Terminé', hi: 'हो गया', zh: '完成' },
  'r3a.edit.close': { es: 'Cerrar editor', en: 'Close editor', de: 'Editor schließen', fr: 'Fermer l’éditeur', hi: 'संपादक बंद करें', zh: '关闭编辑器' },

  // Agregar (barra vertical) e Insertar (barra superior)
  'r3a.add.button': { es: 'Agregar', en: 'Add', de: 'Hinzufügen', fr: 'Ajouter', hi: 'जोड़ें', zh: '添加' },
  'r3a.add.help': { es: 'Agrega una forma básica a la cama.', en: 'Adds a basic shape to the bed.', de: 'Fügt dem Bett eine Grundform hinzu.', fr: 'Ajoute une forme de base sur le plateau.', hi: 'बेड पर एक मूल आकृति जोड़ता है।', zh: '向打印床添加基本形状。' },
  'r3a.add.menu': { es: 'Agregar forma', en: 'Add shape', de: 'Form hinzufügen', fr: 'Ajouter une forme', hi: 'आकृति जोड़ें', zh: '添加形状' },
  'r3a.insert.menu': { es: 'Insertar', en: 'Insert', de: 'Einfügen', fr: 'Insérer', hi: 'डालें', zh: '插入' },
  'r3a.insert.help': { es: 'Formas, texto 3D, SVG, imagen, rosca y cubo de calibración.', en: 'Shapes, 3D text, SVG, image, thread and calibration cube.', de: 'Formen, 3D-Text, SVG, Bild, Gewinde und Kalibrierwürfel.', fr: 'Formes, texte 3D, SVG, image, filetage et cube de calibration.', hi: 'आकृतियाँ, 3D टेक्स्ट, SVG, छवि, थ्रेड और कैलिब्रेशन घन।', zh: '形状、3D 文字、SVG、图片、螺纹和校准方块。' },
  'r3a.insert.shapes': { es: 'Formas básicas', en: 'Basic shapes', de: 'Grundformen', fr: 'Formes de base', hi: 'मूल आकृतियाँ', zh: '基本形状' },
  'r3a.insert.generators': { es: 'Desde archivo o generador', en: 'From file or generator', de: 'Aus Datei oder Generator', fr: 'Depuis un fichier ou un générateur', hi: 'फ़ाइल या जनरेटर से', zh: '来自文件或生成器' },
  'r3a.insert.shapeTip': { es: 'Agrega {name} a la cama', en: 'Add {name} to the bed', de: '{name} zum Bett hinzufügen', fr: 'Ajouter {name} au plateau', hi: 'बेड पर {name} जोड़ें', zh: '将{name}添加到打印床' },
  'r3a.insert.textTip': { es: 'Escribe un texto y créalo en 3D', en: 'Type a text and create it in 3D', de: 'Text eingeben und in 3D erstellen', fr: 'Saisis un texte et crée-le en 3D', hi: 'टेक्स्ट लिखें और उसे 3D में बनाएँ', zh: '输入文字并生成 3D' },
  'r3a.text.panel': { es: 'Texto 3D', en: '3D text', de: '3D-Text', fr: 'Texte 3D', hi: '3D टेक्स्ट', zh: '3D 文字' },

  // Acciones con submenús
  'r3a.actions.groupTip': { es: '{name}: {count} acciones', en: '{name}: {count} actions', de: '{name}: {count} Aktionen', fr: '{name} : {count} actions', hi: '{name}: {count} क्रियाएँ', zh: '{name}:{count} 个操作' },

  // Barra lateral (Escena) y hoja móvil Agregar
  'r3a.sidebar.label': { es: 'Escena', en: 'Scene', de: 'Szene', fr: 'Scène', hi: 'दृश्य', zh: '场景' },
  'r3a.sidebar.hide': { es: 'Ocultar la escena', en: 'Hide the scene', de: 'Szene ausblenden', fr: 'Masquer la scène', hi: 'दृश्य छिपाएँ', zh: '隐藏场景' },
  'r3a.sidebar.show': { es: 'Mostrar la escena', en: 'Show the scene', de: 'Szene einblenden', fr: 'Afficher la scène', hi: 'दृश्य दिखाएँ', zh: '显示场景' },
  'r3a.sidebar.tip': { es: 'Muestra u oculta el árbol de la escena; oculto, el visor gana ese ancho.', en: 'Shows or hides the scene tree; when hidden, the viewport gains that width.', de: 'Zeigt oder verbirgt den Szenenbaum; ausgeblendet gewinnt die Ansicht diese Breite.', fr: 'Affiche ou masque l’arbre de la scène ; masqué, la vue gagne cette largeur.', hi: 'दृश्य ट्री दिखाता या छिपाता है; छिपा होने पर व्यूपोर्ट को वह चौड़ाई मिलती है।', zh: '显示或隐藏场景树;隐藏时视图获得该宽度。' },
  'r3a.sheet.addTip': { es: 'Formas, texto, SVG, imagen y rosca', en: 'Shapes, text, SVG, image and thread', de: 'Formen, Text, SVG, Bild und Gewinde', fr: 'Formes, texte, SVG, image et filetage', hi: 'आकृतियाँ, टेक्स्ट, SVG, छवि और थ्रेड', zh: '形状、文字、SVG、图片和螺纹' },

  // MCP y rótulos
  'r3a.mcp.short': { es: 'MCP', en: 'MCP', de: 'MCP', fr: 'MCP', hi: 'MCP', zh: 'MCP' },

  // Muestra de color en el árbol de la escena
  'r3a.swatch.one': { es: 'color: {name}', en: 'color: {name}', de: 'Farbe: {name}', fr: 'couleur : {name}', hi: 'रंग: {name}', zh: '颜色:{name}' },
  'r3a.swatch.many': { es: 'colores: {names}', en: 'colors: {names}', de: 'Farben: {names}', fr: 'couleurs : {names}', hi: 'रंग: {names}', zh: '颜色:{names}' },
  'r3a.swatch.more': { es: '+{count}', en: '+{count}', de: '+{count}', fr: '+{count}', hi: '+{count}', zh: '+{count}' },

  // Idioma
  'r3a.lang.current': { es: 'Idioma: {name}', en: 'Language: {name}', de: 'Sprache: {name}', fr: 'Langue : {name}', hi: 'भाषा: {name}', zh: '语言:{name}' },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof REDISENO3A]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(REDISENO3A).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const REDISENO3A_ES = pick('es');
export const REDISENO3A_EN = pick('en');
export const REDISENO3A_DE = pick('de');
export const REDISENO3A_FR = pick('fr');
export const REDISENO3A_HI = pick('hi');
export const REDISENO3A_ZH = pick('zh');
