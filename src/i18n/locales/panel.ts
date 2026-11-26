/**
 * @file src/i18n/locales/panel.ts
 * @description Textos del panel derecho contextual (rediseño, lote 2) en los 6 idiomas: contextos Proyecto,
 * objeto y acción, separador de ancho, anuncios del cambio de contexto, acciones nuevas del menú (Textura,
 * Módulos) y los pendientes del lote 1 (rótulo corto de Esculpir, objeto medido en Capacidad, objetos del
 * borrador recuperable). Cada clave se escribe una vez con sus 6 idiomas; `PANEL_<IDIOMA>` se mezcla en cada
 * diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const PANEL = {
  // Contexto Proyecto (sin selección)
  'panel.project.title': { es: 'Proyecto', en: 'Project', de: 'Projekt', fr: 'Projet', hi: 'प्रोजेक्ट', zh: '项目' },
  'panel.project.name': { es: 'Nombre', en: 'Name', de: 'Name', fr: 'Nom', hi: 'नाम', zh: '名称' },
  'panel.project.objects': { es: 'Objetos', en: 'Objects', de: 'Objekte', fr: 'Objets', hi: 'ऑब्जेक्ट', zh: '对象' },
  'panel.project.bed': { es: 'Cama activa', en: 'Active bed', de: 'Aktives Bett', fr: 'Plateau actif', hi: 'सक्रिय बेड', zh: '当前打印床' },
  'panel.project.units': { es: 'Unidades', en: 'Units', de: 'Einheiten', fr: 'Unités', hi: 'इकाइयाँ', zh: '单位' },
  'panel.project.state': { es: 'Estado', en: 'Status', de: 'Status', fr: 'État', hi: 'स्थिति', zh: '状态' },
  'panel.project.saved': { es: 'Guardado', en: 'Saved', de: 'Gespeichert', fr: 'Enregistré', hi: 'सहेजा गया', zh: '已保存' },
  'panel.project.unsaved': { es: 'Cambios sin guardar', en: 'Unsaved changes', de: 'Ungespeicherte Änderungen', fr: 'Modifications non enregistrées', hi: 'बिना सहेजे बदलाव', zh: '有未保存的更改' },
  'panel.project.location': { es: 'Archivo', en: 'File', de: 'Datei', fr: 'Fichier', hi: 'फ़ाइल', zh: '文件' },
  'panel.project.hint': { es: 'Selecciona un objeto para ver sus propiedades, o elige una operación en el menú Acciones.', en: 'Select an object to see its properties, or pick an operation from the Actions menu.', de: 'Wähle ein Objekt, um seine Eigenschaften zu sehen, oder eine Operation im Menü Aktionen.', fr: 'Sélectionne un objet pour voir ses propriétés, ou choisis une opération dans le menu Actions.', hi: 'गुण देखने के लिए ऑब्जेक्ट चुनें, या Actions मेनू से कोई क्रिया चुनें।', zh: '选择一个对象以查看其属性,或在“操作”菜单中选择一项操作。' },

  // Contexto objeto
  'panel.object.toolsHint': { es: 'Cada una abre solo sus opciones en este panel.', en: 'Each one opens only its options in this panel.', de: 'Jede öffnet nur ihre Optionen in diesem Panel.', fr: 'Chacune ouvre seulement ses options dans ce panneau.', hi: 'हर एक इस पैनल में केवल अपने विकल्प खोलता है।', zh: '每项操作只在此面板中打开自己的选项。' },

  // Contexto acción
  'panel.title.hollow': { es: 'Ahuecar', en: 'Hollow out', de: 'Aushöhlen', fr: 'Évider', hi: 'खोखला करें', zh: '抽壳' },
  'panel.title.simplify': { es: 'Simplificar o refinar', en: 'Simplify or refine mesh', de: 'Netz vereinfachen/verfeinern', fr: 'Simplifier ou affiner', hi: 'मेश सरल या परिष्कृत करें', zh: '简化或细化网格' },
  'panel.title.refine': { es: 'Simplificar o refinar', en: 'Simplify or refine mesh', de: 'Netz vereinfachen/verfeinern', fr: 'Simplifier ou affiner', hi: 'मेश सरल या परिष्कृत करें', zh: '简化或细化网格' },
  'panel.title.texture': { es: 'Textura superficial', en: 'Surface texture', de: 'Oberflächentextur', fr: 'Texture de surface', hi: 'सतह बनावट', zh: '表面纹理' },
  'panel.title.modules': { es: 'Módulos: sumar o restar', en: 'Modules: add or subtract', de: 'Module: addieren/abziehen', fr: 'Modules : ajouter/soustraire', hi: 'मॉड्यूल: जोड़ें या घटाएँ', zh: '模块:添加或减去形状' },
  'panel.title.validate': { es: 'Revisar si se puede imprimir', en: 'Check printability', de: 'Druckbarkeit prüfen', fr: 'Vérifier l’imprimabilité', hi: 'प्रिंट योग्यता जाँचें', zh: '检查可打印性' },
  'panel.title.detect': { es: 'Detectar estructuras', en: 'Detect structures', de: 'Strukturen erkennen', fr: 'Détecter les structures', hi: 'संरचनाएँ पहचानें', zh: '检测结构' },
  'panel.action.target': { es: 'Sobre {name}', en: 'On {name}', de: 'Auf {name}', fr: 'Sur {name}', hi: '{name} पर', zh: '对象:{name}' },
  'panel.action.back': { es: 'Volver', en: 'Back', de: 'Zurück', fr: 'Retour', hi: 'वापस', zh: '返回' },
  'panel.help.back': { es: 'Cierra estas opciones y vuelve al resumen del objeto.', en: 'Closes these options and returns to the object summary.', de: 'Schließt diese Optionen und kehrt zur Objektübersicht zurück.', fr: 'Ferme ces options et revient au résumé de l’objet.', hi: 'ये विकल्प बंद करके ऑब्जेक्ट सारांश पर लौटता है।', zh: '关闭这些选项并返回对象概要。' },

  // Separador y plegado
  'panel.resize': { es: 'Ancho del panel', en: 'Panel width', de: 'Panelbreite', fr: 'Largeur du panneau', hi: 'पैनल की चौड़ाई', zh: '面板宽度' },
  'panel.help.resize': { es: 'Arrastra o usa las flechas para ensanchar o reducir el panel; Inicio y Fin van al mínimo y al máximo.', en: 'Drag or use the arrow keys to widen or narrow the panel; Home and End go to the minimum and maximum.', de: 'Ziehen oder Pfeiltasten nutzen, um das Panel zu verbreitern oder zu verkleinern; Pos1 und Ende gehen zu Minimum und Maximum.', fr: 'Fais glisser ou utilise les flèches pour élargir ou réduire le panneau ; Début et Fin vont au minimum et au maximum.', hi: 'पैनल चौड़ा या छोटा करने के लिए खींचें या तीर कुंजियाँ दबाएँ; Home और End न्यूनतम व अधिकतम पर ले जाते हैं।', zh: '拖动或使用方向键加宽或缩窄面板;Home 和 End 分别跳到最小和最大宽度。' },
  'panel.help.collapse': { es: 'Pliega el panel a una tira o lo vuelve a abrir; el estado se recuerda.', en: 'Folds the panel into a strip or opens it again; the state is remembered.', de: 'Klappt das Panel zu einem Streifen ein oder öffnet es wieder; der Zustand wird gemerkt.', fr: 'Replie le panneau en bande ou le rouvre ; l’état est mémorisé.', hi: 'पैनल को पट्टी में मोड़ता है या फिर खोलता है; स्थिति याद रहती है।', zh: '将面板折叠成窄条或重新打开;状态会被记住。' },

  // Anuncio discreto del cambio de contexto
  'panel.announce.project': { es: 'Panel: proyecto', en: 'Panel: project', de: 'Panel: Projekt', fr: 'Panneau : projet', hi: 'पैनल: प्रोजेक्ट', zh: '面板:项目' },
  'panel.announce.object': { es: 'Panel: {name}', en: 'Panel: {name}', de: 'Panel: {name}', fr: 'Panneau : {name}', hi: 'पैनल: {name}', zh: '面板:{name}' },
  'panel.announce.multi': { es: 'Panel: {count} objetos seleccionados', en: 'Panel: {count} objects selected', de: 'Panel: {count} Objekte ausgewählt', fr: 'Panneau : {count} objets sélectionnés', hi: 'पैनल: {count} ऑब्जेक्ट चुने गए', zh: '面板:已选择 {count} 个对象' },
  'panel.announce.action': { es: 'Panel: opciones de {name}', en: 'Panel: {name} options', de: 'Panel: Optionen für {name}', fr: 'Panneau : options de {name}', hi: 'पैनल: {name} के विकल्प', zh: '面板:{name} 选项' },

  // Acciones nuevas del menú (antes solo en el inspector)
  'rediseno.action.texture': { es: 'Textura superficial…', en: 'Surface texture…', de: 'Oberflächentextur…', fr: 'Texture de surface…', hi: 'सतह बनावट…', zh: '表面纹理…' },
  'rediseno.action.modules': { es: 'Módulos (sumar o restar)…', en: 'Modules (add or subtract)…', de: 'Module (addieren oder abziehen)…', fr: 'Modules (ajouter ou soustraire)…', hi: 'मॉड्यूल (जोड़ें या घटाएँ)…', zh: '模块(添加或减去)…' },

  // Pendientes del lote 1
  'rediseno.tool.eraseShort': { es: 'Esculpir', en: 'Carve', de: 'Schnitzen', fr: 'Sculpter', hi: 'तराशें', zh: '雕刻' },
  'rediseno2.capacity.target': { es: 'Objeto medido: {name}', en: 'Measured object: {name}', de: 'Gemessenes Objekt: {name}', fr: 'Objet mesuré : {name}', hi: 'मापा गया ऑब्जेक्ट: {name}', zh: '已测量对象:{name}' },
  'rediseno2.recovery.objects': { es: '{count} {count?objeto|objetos}', en: '{count} {count?object|objects}', de: '{count} {count?Objekt|Objekte}', fr: '{count} {count?objet|objets}', hi: '{count} ऑब्जेक्ट', zh: '{count} 个对象' },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof PANEL]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(PANEL).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const PANEL_ES = pick('es');
export const PANEL_EN = pick('en');
export const PANEL_DE = pick('de');
export const PANEL_FR = pick('fr');
export const PANEL_HI = pick('hi');
export const PANEL_ZH = pick('zh');
