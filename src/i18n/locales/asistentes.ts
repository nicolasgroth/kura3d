/**
 * @file src/i18n/locales/asistentes.ts
 * @description Textos de la interfaz de Asistentes (crear una pieza paso a paso desde una receta) en los 6 idiomas.
 * Solo es lo que pone la interfaz: los textos de cada receta (título, parámetros, reglas) salen de la propia receta.
 * Cada clave lleva [es, en, de, fr, hi, zh]; `ASISTENTES_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const ASISTENTES_TABLE = {
  'asis.title': ['Asistentes', 'Assistants', 'Assistenten', 'Assistants', 'सहायक', '向导'],
  'asis.menuTip': [
    'Crea una pieza paso a paso: caja con tapa, llavero, placa de enchufe…',
    'Create a part step by step: box with lid, keychain, socket plate…',
    'Erstelle ein Teil Schritt für Schritt: Box mit Deckel, Schlüsselanhänger, Steckdosenplatte …',
    'Crée une pièce pas à pas : boîte avec couvercle, porte-clés, plaque de prise…',
    'चरण दर चरण भाग बनाएँ: ढक्कन वाला डिब्बा, कीचेन, सॉकेट प्लेट…',
    '分步创建零件:带盖盒子、钥匙扣、插座面板……',
  ],
  'asis.listIntro': [
    'Elige un asistente: te pregunta lo necesario y crea la pieza.',
    'Choose an assistant: it asks what it needs and creates the part.',
    'Wähle einen Assistenten: Er fragt, was nötig ist, und erstellt das Teil.',
    'Choisis un assistant : il pose les questions utiles et crée la pièce.',
    'एक सहायक चुनें: वह ज़रूरी बातें पूछता है और भाग बना देता है।',
    '选择一个向导:它会询问所需信息并创建零件。',
  ],
  'asis.listLabel': ['Asistentes disponibles', 'Available assistants', 'Verfügbare Assistenten', 'Assistants disponibles', 'उपलब्ध सहायक', '可用向导'],
  'asis.openTip': ['Abre el asistente «{name}»', 'Open the “{name}” assistant', 'Assistent „{name}“ öffnen', 'Ouvrir l’assistant « {name} »', '“{name}” सहायक खोलें', '打开向导“{name}”'],
  'asis.variants': [
    '{count} {count?variante|variantes}',
    '{count} {count?variant|variants}',
    '{count} {count?Variante|Varianten}',
    '{count} {count?variante|variantes}',
    '{count} विकल्प',
    '{count} 个变体',
  ],
  'asis.back': ['Volver a la lista', 'Back to the list', 'Zurück zur Liste', 'Retour à la liste', 'सूची पर लौटें', '返回列表'],
  'asis.backTip': [
    'Vuelve a la lista de asistentes (Esc)',
    'Back to the list of assistants (Esc)',
    'Zurück zur Liste der Assistenten (Esc)',
    'Retour à la liste des assistants (Échap)',
    'सहायकों की सूची पर लौटें (Esc)',
    '返回向导列表(Esc)',
  ],
  'asis.form': ['Opciones de «{name}»', 'Options for “{name}”', 'Optionen für „{name}“', 'Options de « {name} »', '“{name}” के विकल्प', '“{name}”的选项'],
  'asis.variant': ['Variante', 'Variant', 'Variante', 'Variante', 'विकल्प', '变体'],
  'asis.variant.none': ['Medidas por defecto', 'Default sizes', 'Standardmaße', 'Dimensions par défaut', 'डिफ़ॉल्ट माप', '默认尺寸'],
  'asis.variant.unverified': ['{label} (sin verificar)', '{label} (unverified)', '{label} (ungeprüft)', '{label} (non vérifié)', '{label} (असत्यापित)', '{label}(未验证)'],
  'asis.variant.hint': [
    'Rellena las medidas; luego puedes ajustarlas.',
    'Fills in the sizes; you can adjust them afterwards.',
    'Füllt die Maße aus; du kannst sie danach anpassen.',
    'Remplit les dimensions ; tu peux les ajuster ensuite.',
    'माप भर देता है; बाद में बदल सकते हैं।',
    '会填入尺寸,之后仍可调整。',
  ],
  'asis.create': ['Crear', 'Create', 'Erstellen', 'Créer', 'बनाएँ', '创建'],
  'asis.createTip': [
    'Crea las piezas en la escena (Enter)',
    'Create the parts in the scene (Enter)',
    'Erstellt die Teile in der Szene (Enter)',
    'Crée les pièces dans la scène (Entrée)',
    'दृश्य में भाग बनाता है (Enter)',
    '在场景中创建零件(Enter)',
  ],
  'asis.createBlocked': [
    'Corrige los campos marcados para poder crear.',
    'Fix the marked fields to be able to create.',
    'Korrigiere die markierten Felder, um zu erstellen.',
    'Corrige les champs signalés pour pouvoir créer.',
    'बनाने के लिए चिह्नित फ़ील्ड ठीक करें।',
    '请先修正标记的字段才能创建。',
  ],
  'asis.running': ['Creando «{name}»…', 'Creating “{name}”…', '„{name}“ wird erstellt …', 'Création de « {name} »…', '“{name}” बन रहा है…', '正在创建“{name}”……'],
  'asis.created': ['Se creó: {names}.', 'Created: {names}.', 'Erstellt: {names}.', 'Créé : {names}.', 'बनाया गया: {names}।', '已创建:{names}。'],
  'asis.fitsBed': [
    'Alguna pieza no cabe en la cama: puedes dividirla para imprimir.',
    'A part does not fit on the bed: you can split it to print.',
    'Ein Teil passt nicht auf das Druckbett: Du kannst es zum Drucken teilen.',
    'Une pièce ne tient pas sur le plateau : tu peux la diviser pour l’imprimer.',
    'कोई भाग बेड पर नहीं आता: छापने के लिए उसे बाँट सकते हैं।',
    '有零件放不进打印床:可以拆分后再打印。',
  ],
  'asis.problems': [
    'Corrige esto antes de crear:',
    'Fix this before creating:',
    'Korrigiere dies vor dem Erstellen:',
    'Corrige ceci avant de créer :',
    'बनाने से पहले इसे ठीक करें:',
    '创建前请先修正:',
  ],
  'asis.level.error': ['Error', 'Error', 'Fehler', 'Erreur', 'त्रुटि', '错误'],
  'asis.level.warning': ['Aviso', 'Warning', 'Warnung', 'Avertissement', 'चेतावनी', '警告'],
  'asis.level.info': ['Nota', 'Note', 'Hinweis', 'Note', 'टिप्पणी', '说明'],
  'asis.optional': ['(opcional)', '(optional)', '(optional)', '(facultatif)', '(वैकल्पिक)', '(可选)'],
  'asis.object.none': ['Ninguno', 'None', 'Keines', 'Aucun', 'कोई नहीं', '无'],
  'asis.object.pick': ['Elige un objeto de la escena', 'Choose an object from the scene', 'Wähle ein Objekt der Szene', 'Choisis un objet de la scène', 'दृश्य से कोई वस्तु चुनें', '从场景中选择对象'],
  'asis.object.empty': [
    'No hay objetos en la escena para elegir.',
    'There are no objects in the scene to choose from.',
    'Es gibt keine Objekte in der Szene zur Auswahl.',
    'Aucun objet de la scène à choisir.',
    'चुनने के लिए दृश्य में कोई वस्तु नहीं है।',
    '场景中没有可选的对象。',
  ],
  'asis.file.choose': ['Elegir archivo…', 'Choose file…', 'Datei wählen …', 'Choisir un fichier…', 'फ़ाइल चुनें…', '选择文件……'],
  'asis.file.none': ['Ningún archivo elegido', 'No file chosen', 'Keine Datei gewählt', 'Aucun fichier choisi', 'कोई फ़ाइल नहीं चुनी', '未选择文件'],
  'asis.file.remove': ['Quitar archivo', 'Remove file', 'Datei entfernen', 'Retirer le fichier', 'फ़ाइल हटाएँ', '移除文件'],
  'asis.file.formats': ['Formatos: {types}', 'Formats: {types}', 'Formate: {types}', 'Formats : {types}', 'प्रारूप: {types}', '格式:{types}'],
  'asis.file.tooBig': [
    'El archivo es demasiado grande (máximo {max} MB).',
    'The file is too large (maximum {max} MB).',
    'Die Datei ist zu groß (maximal {max} MB).',
    'Le fichier est trop volumineux (maximum {max} Mo).',
    'फ़ाइल बहुत बड़ी है (अधिकतम {max} MB)।',
    '文件太大(最大 {max} MB)。',
  ],
  'asis.file.badType': [
    'El contenido del archivo no es de un tipo admitido ({types}).',
    'The file content is not a supported type ({types}).',
    'Der Dateiinhalt ist kein unterstützter Typ ({types}).',
    'Le contenu du fichier n’est pas d’un type accepté ({types}).',
    'फ़ाइल की सामग्री समर्थित प्रकार की नहीं है ({types})।',
    '文件内容不是支持的类型({types})。',
  ],
  'asis.empty': [
    'La receta no produjo piezas. La escena no cambió.',
    'The recipe produced no parts. The scene did not change.',
    'Das Rezept hat keine Teile erzeugt. Die Szene blieb unverändert.',
    'La recette n’a produit aucune pièce. La scène n’a pas changé.',
    'रेसिपी से कोई भाग नहीं बना। दृश्य नहीं बदला।',
    '配方没有生成任何零件。场景未发生变化。',
  ],
  'asis.checkOther': [
    'La receta avisó de un problema con el resultado: revisa las piezas antes de imprimir.',
    'The recipe flagged a problem with the result: check the parts before printing.',
    'Das Rezept meldet ein Problem mit dem Ergebnis: Prüfe die Teile vor dem Drucken.',
    'La recette signale un problème avec le résultat : vérifie les pièces avant d’imprimer.',
    'रेसिपी ने परिणाम में समस्या बताई: छापने से पहले भाग जाँच लें।',
    '配方提示结果有问题:打印前请检查零件。',
  ],
  'asis.file.readError': ['No se pudo leer el archivo.', 'The file could not be read.', 'Die Datei konnte nicht gelesen werden.', 'Le fichier n’a pas pu être lu.', 'फ़ाइल पढ़ी नहीं जा सकी।', '无法读取该文件。'],
  'asis.cmd.recipe': ['Asistente: {name}', 'Assistant: {name}', 'Assistent: {name}', 'Assistant : {name}', 'सहायक: {name}', '向导:{name}'],
  'asis.cmd.keywords': [
    'asistente receta paso a paso caja llavero placa enchufe',
    'assistant recipe wizard step by step box keychain socket plate',
    'assistent rezept schritt für schritt box schlüsselanhänger steckdose',
    'assistant recette pas à pas boîte porte-clés prise',
    'सहायक रेसिपी चरण डिब्बा कीचेन सॉकेट',
    '向导 配方 分步 盒子 钥匙扣 插座',
  ],
} satisfies Record<string, Row>;

type AsistentesKey = keyof typeof ASISTENTES_TABLE;

const pick = (index: number) =>
  Object.fromEntries(Object.entries(ASISTENTES_TABLE).map(([key, row]) => [key, row[index]])) as Record<AsistentesKey, string>;

export const ASISTENTES_ES = pick(0);
export const ASISTENTES_EN = pick(1);
export const ASISTENTES_DE = pick(2);
export const ASISTENTES_FR = pick(3);
export const ASISTENTES_HI = pick(4);
export const ASISTENTES_ZH = pick(5);
