/**
 * @file src/i18n/locales/datosProyecto.ts
 * @description Textos de los datos del proyecto (descripción, notas, autor, fechas y tiempo de trabajo; sección del
 * panel «Proyecto», aviso de notas al abrir y línea de proyectos recientes) en los 6 idiomas. Cada clave se escribe
 * una vez con sus 6 idiomas; `DATOS_PROYECTO_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const DATOS_PROYECTO = {
  'projectInfo.title': { es: 'Datos del proyecto', en: 'Project details', de: 'Projektdaten', fr: 'Données du projet', hi: 'प्रोजेक्ट का विवरण', zh: '项目信息' },
  'projectInfo.description': { es: 'Descripción', en: 'Description', de: 'Beschreibung', fr: 'Description', hi: 'विवरण', zh: '描述' },
  'projectInfo.descriptionTip': { es: 'Una línea que describe el proyecto; se muestra en los recientes.', en: 'One line describing the project; shown in recent projects.', de: 'Eine Zeile zur Beschreibung des Projekts; wird in den zuletzt verwendeten angezeigt.', fr: 'Une ligne qui décrit le projet ; affichée dans les projets récents.', hi: 'प्रोजेक्ट का एक पंक्ति में विवरण; हाल के प्रोजेक्ट में दिखता है।', zh: '一行项目说明;显示在最近项目中。' },
  'projectInfo.descriptionPlaceholder': { es: 'Qué es este proyecto', en: 'What this project is', de: 'Worum es in diesem Projekt geht', fr: 'De quoi parle ce projet', hi: 'यह प्रोजेक्ट क्या है', zh: '这个项目是什么' },
  'projectInfo.notes': { es: 'Notas', en: 'Notes', de: 'Notizen', fr: 'Notes', hi: 'नोट्स', zh: '备注' },
  'projectInfo.notesTip': { es: 'Notas libres del proyecto (texto simple, hasta {max} caracteres). Se guardan en el archivo.', en: 'Free notes for the project (plain text, up to {max} characters). Saved in the file.', de: 'Freie Notizen zum Projekt (reiner Text, bis zu {max} Zeichen). Werden in der Datei gespeichert.', fr: 'Notes libres du projet (texte brut, jusqu’à {max} caractères). Enregistrées dans le fichier.', hi: 'प्रोजेक्ट के लिए खुले नोट्स (सादा पाठ, {max} अक्षर तक)। फ़ाइल में सहेजे जाते हैं।', zh: '项目的自由备注(纯文本,最多 {max} 个字符)。保存在文件中。' },
  'projectInfo.notesPlaceholder': { es: 'Medidas, materiales, pendientes…', en: 'Measurements, materials, to-dos…', de: 'Maße, Materialien, Offenes …', fr: 'Mesures, matériaux, à faire…', hi: 'माप, सामग्री, बाकी काम…', zh: '尺寸、材料、待办事项…' },
  'projectInfo.notesCount': { es: '{count} de {max} caracteres', en: '{count} of {max} characters', de: '{count} von {max} Zeichen', fr: '{count} sur {max} caractères', hi: '{max} में से {count} अक्षर', zh: '{count} / {max} 个字符' },
  'projectInfo.author': { es: 'Autor', en: 'Author', de: 'Autor', fr: 'Auteur', hi: 'लेखक', zh: '作者' },
  'projectInfo.authorTip': { es: 'Opcional. Lo escribes tú: la app no lo rellena sola.', en: 'Optional. You type it: the app never fills it in.', de: 'Optional. Du gibst es selbst ein: Die App füllt es nie aus.', fr: 'Facultatif. Tu l’écris toi-même : l’app ne le remplit jamais.', hi: 'वैकल्पिक। आप खुद लिखते हैं: ऐप इसे अपने आप नहीं भरता।', zh: '可选。由你自己填写:应用不会自动填入。' },
  'projectInfo.authorPlaceholder': { es: 'Tu nombre (opcional)', en: 'Your name (optional)', de: 'Dein Name (optional)', fr: 'Ton nom (facultatif)', hi: 'आपका नाम (वैकल्पिक)', zh: '你的名字(可选)' },
  'projectInfo.created': { es: 'Creado', en: 'Created', de: 'Erstellt', fr: 'Créé', hi: 'बनाया गया', zh: '创建时间' },
  'projectInfo.modified': { es: 'Modificado', en: 'Modified', de: 'Geändert', fr: 'Modifié', hi: 'संशोधित', zh: '修改时间' },
  'projectInfo.work': { es: 'Tiempo de trabajo', en: 'Work time', de: 'Arbeitszeit', fr: 'Temps de travail', hi: 'कार्य समय', zh: '工作时间' },
  'projectInfo.workTip': { es: 'Tiempo con la app en primer plano y actividad reciente. Solo se guarda en este archivo.', en: 'Time with the app in the foreground and recent activity. Only saved in this file.', de: 'Zeit mit der App im Vordergrund und kürzlicher Aktivität. Wird nur in dieser Datei gespeichert.', fr: 'Temps avec l’app au premier plan et une activité récente. Enregistré uniquement dans ce fichier.', hi: 'ऐप के अग्रभूमि में होने और हाल की गतिविधि का समय। केवल इसी फ़ाइल में सहेजा जाता है।', zh: '应用在前台且近期有操作的时间。仅保存在此文件中。' },
  'projectInfo.noDate': { es: 'Sin fecha', en: 'No date', de: 'Kein Datum', fr: 'Sans date', hi: 'कोई तारीख नहीं', zh: '无日期' },
  'projectInfo.notSavedYet': { es: 'Aún sin guardar', en: 'Not saved yet', de: 'Noch nicht gespeichert', fr: 'Pas encore enregistré', hi: 'अभी सहेजा नहीं गया', zh: '尚未保存' },
  'projectInfo.work.under': { es: 'Menos de 1 min', en: 'Under 1 min', de: 'Weniger als 1 Min.', fr: 'Moins d’1 min', hi: '1 मिनट से कम', zh: '不到 1 分钟' },
  'projectInfo.work.min': { es: '{m} min', en: '{m} min', de: '{m} Min.', fr: '{m} min', hi: '{m} मिनट', zh: '{m} 分钟' },
  'projectInfo.work.h': { es: '{h} h', en: '{h} h', de: '{h} Std.', fr: '{h} h', hi: '{h} घंटा', zh: '{h} 小时' },
  'projectInfo.work.hm': { es: '{h} h {m} min', en: '{h} h {m} min', de: '{h} Std. {m} Min.', fr: '{h} h {m} min', hi: '{h} घंटा {m} मिनट', zh: '{h} 小时 {m} 分钟' },
  'projectInfo.hint': { es: 'Se guardan en el archivo .kura. Editarlos marca el proyecto como modificado, pero no entran al historial de Deshacer (igual que el nombre).', en: 'Saved in the .kura file. Editing them marks the project as modified, but they are not part of the Undo history (like the name).', de: 'Werden in der .kura-Datei gespeichert. Das Bearbeiten markiert das Projekt als geändert, gehört aber nicht zum Rückgängig-Verlauf (wie der Name).', fr: 'Enregistrées dans le fichier .kura. Les modifier marque le projet comme modifié, mais elles ne font pas partie de l’historique Annuler (comme le nom).', hi: '.kura फ़ाइल में सहेजे जाते हैं। इन्हें बदलने से प्रोजेक्ट संशोधित माना जाता है, लेकिन ये पूर्ववत इतिहास में नहीं आते (नाम की तरह)।', zh: '保存在 .kura 文件中。编辑它们会将项目标记为已修改,但不进入撤销历史(与名称相同)。' },
  'projectInfo.notesNotice': { es: 'Este proyecto tiene notas.', en: 'This project has notes.', de: 'Dieses Projekt hat Notizen.', fr: 'Ce projet a des notes.', hi: 'इस प्रोजेक्ट में नोट्स हैं।', zh: '此项目有备注。' },
  'projectInfo.notesView': { es: 'Ver notas', en: 'View notes', de: 'Notizen ansehen', fr: 'Voir les notes', hi: 'नोट्स देखें', zh: '查看备注' },
  'projectInfo.notesViewAria': { es: 'Ver las notas del proyecto', en: 'View the project notes', de: 'Projektnotizen ansehen', fr: 'Voir les notes du projet', hi: 'प्रोजेक्ट के नोट्स देखें', zh: '查看项目备注' },
  'projectInfo.recent.modified': { es: 'Modificado {date}', en: 'Modified {date}', de: 'Geändert {date}', fr: 'Modifié {date}', hi: 'संशोधित {date}', zh: '修改于 {date}' },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof DATOS_PROYECTO]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(DATOS_PROYECTO).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const DATOS_PROYECTO_ES = pick('es');
export const DATOS_PROYECTO_EN = pick('en');
export const DATOS_PROYECTO_DE = pick('de');
export const DATOS_PROYECTO_FR = pick('fr');
export const DATOS_PROYECTO_HI = pick('hi');
export const DATOS_PROYECTO_ZH = pick('zh');
