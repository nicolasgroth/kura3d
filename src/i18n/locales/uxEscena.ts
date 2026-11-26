/**
 * @file src/i18n/locales/uxEscena.ts
 * @description Textos del lote de escena en los 6 idiomas: pieza que creció y se movió a un hueco libre,
 * guardado cancelado o descargado, importación cancelada, archivo con varios cuerpos sueltos y lectura
 * del cambio mientras se arrastra el gizmo. Cada clave se escribe una vez con sus 6 idiomas;
 * `UXESCENA_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const UXESCENA = {
  'uxEscena.grewMoved': {
    es: 'La pieza creció sobre otro objeto: se movió a un hueco libre de la cama.',
    en: 'The part grew into another object: it was moved to a free spot on the bed.',
    de: 'Das Teil ist in ein anderes Objekt gewachsen: Es wurde an eine freie Stelle im Druckbett verschoben.',
    fr: 'La pièce a grandi sur un autre objet : elle a été déplacée vers un emplacement libre du plateau.',
    hi: 'भाग बढ़कर दूसरे ऑब्जेक्ट पर आ गया: इसे बेड पर खाली जगह पर ले जाया गया।',
    zh: '零件变大后与其他对象重叠：已移到打印床上的空位。',
  },
  'uxEscena.saveCancelled': {
    es: 'Guardado cancelado.',
    en: 'Save cancelled.',
    de: 'Speichern abgebrochen.',
    fr: 'Enregistrement annulé.',
    hi: 'सहेजना रद्द किया गया।',
    zh: '已取消保存。',
  },
  'uxEscena.savedDownload': {
    es: 'Este navegador no guarda en sitio: {name} se descargó en tu carpeta de descargas. Confírmalo en el aviso de abajo.',
    en: 'This browser cannot save in place: {name} was downloaded to your downloads folder. Confirm it in the notice below.',
    de: 'Dieser Browser kann nicht direkt speichern: {name} wurde in deinen Download-Ordner heruntergeladen. Bestätige es im Hinweis unten.',
    fr: 'Ce navigateur ne peut pas enregistrer sur place : {name} a été téléchargé dans ton dossier de téléchargements. Confirme-le dans l’avis ci-dessous.',
    hi: 'यह ब्राउज़र उसी जगह सहेज नहीं सकता: {name} आपके डाउनलोड फ़ोल्डर में डाउनलोड हुआ। नीचे दी गई सूचना में पुष्टि करें।',
    zh: '此浏览器无法原地保存：{name} 已下载到你的下载文件夹。请在下方提示中确认。',
  },
  'uxEscena.importCancelled': {
    es: 'Importación cancelada: no se agregó nada a la escena.',
    en: 'Import cancelled: nothing was added to the scene.',
    de: 'Import abgebrochen: Der Szene wurde nichts hinzugefügt.',
    fr: 'Importation annulée : rien n’a été ajouté à la scène.',
    hi: 'आयात रद्द: दृश्य में कुछ नहीं जोड़ा गया।',
    zh: '已取消导入：场景中未添加任何内容。',
  },
  'uxEscena.multiBody': {
    es: '{name}: este archivo trae {count} cuerpos separados en una sola pieza.',
    en: '{name}: this file has {count} separate bodies in a single part.',
    de: '{name}: Diese Datei enthält {count} getrennte Körper in einem einzigen Teil.',
    fr: '{name} : ce fichier contient {count} corps séparés dans une seule pièce.',
    hi: '{name}: इस फ़ाइल में एक ही भाग में {count} अलग-अलग बॉडी हैं।',
    zh: '{name}：此文件在一个零件中包含 {count} 个分离的实体。',
  },
  'uxEscena.multiBody.action': {
    es: 'Separar cuerpos',
    en: 'Separate bodies',
    de: 'Körper trennen',
    fr: 'Séparer les corps',
    hi: 'बॉडी अलग करें',
    zh: '分离实体',
  },
  'uxEscena.drag.label': {
    es: 'Cambio durante el arrastre',
    en: 'Change while dragging',
    de: 'Änderung beim Ziehen',
    fr: 'Changement pendant le glissement',
    hi: 'खींचते समय बदलाव',
    zh: '拖动中的变化',
  },
  'uxEscena.drag.plane': {
    es: 'Plano {plane}',
    en: 'Plane {plane}',
    de: 'Ebene {plane}',
    fr: 'Plan {plane}',
    hi: 'तल {plane}',
    zh: '平面 {plane}',
  },
  'uxEscena.drag.planeHelp': {
    es: 'Arrastrar una pieza: se mueve en el plano de la vista (Frente/Atrás: vertical; Superior e isométrica: horizontal) · Alt: plano vertical frente a la cámara · Mayús: un solo eje',
    en: 'Dragging a part moves it in the plane of the view (Front/Back: vertical; Top and isometric: horizontal) · Alt: vertical plane facing the camera · Shift: single axis',
    de: 'Ein Teil ziehen: Es bewegt sich in der Ebene der Ansicht (Vorne/Hinten: senkrecht; Oben und isometrisch: waagerecht) · Alt: senkrechte Ebene zur Kamera · Umschalt: eine Achse',
    fr: 'Glisser une pièce : elle se déplace dans le plan de la vue (Face/Arrière : vertical ; Dessus et isométrique : horizontal) · Alt : plan vertical face à la caméra · Maj : un seul axe',
    hi: 'भाग खींचें: यह दृश्य के तल में चलता है (सामने/पीछे: ऊर्ध्वाधर; ऊपर और आइसोमेट्रिक: क्षैतिज) · Alt: कैमरे के सामने ऊर्ध्वाधर तल · Shift: एक अक्ष',
    zh: '拖动零件：在视图所在平面内移动（正面/背面：垂直；顶部与等轴测：水平）· Alt：面向相机的垂直平面 · Shift：单轴',
  },
  'uxEscena.drag.move': {
    es: 'ΔX {x} · ΔY {y} · ΔZ {z} {unit}',
    en: 'ΔX {x} · ΔY {y} · ΔZ {z} {unit}',
    de: 'ΔX {x} · ΔY {y} · ΔZ {z} {unit}',
    fr: 'ΔX {x} · ΔY {y} · ΔZ {z} {unit}',
    hi: 'ΔX {x} · ΔY {y} · ΔZ {z} {unit}',
    zh: 'ΔX {x} · ΔY {y} · ΔZ {z} {unit}',
  },
  'uxEscena.drag.rotate': {
    es: 'Giro {axis}: {deg}°',
    en: 'Rotation {axis}: {deg}°',
    de: 'Drehung {axis}: {deg}°',
    fr: 'Rotation {axis} : {deg}°',
    hi: 'घुमाव {axis}: {deg}°',
    zh: '旋转 {axis}：{deg}°',
  },
  'uxEscena.drag.scale': {
    es: 'Escala X {x} % · Y {y} % · Z {z} %',
    en: 'Scale X {x} % · Y {y} % · Z {z} %',
    de: 'Skalierung X {x} % · Y {y} % · Z {z} %',
    fr: 'Échelle X {x} % · Y {y} % · Z {z} %',
    hi: 'स्केल X {x} % · Y {y} % · Z {z} %',
    zh: '缩放 X {x} % · Y {y} % · Z {z} %',
  },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof UXESCENA]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(UXESCENA).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const UXESCENA_ES = pick('es');
export const UXESCENA_EN = pick('en');
export const UXESCENA_DE = pick('de');
export const UXESCENA_FR = pick('fr');
export const UXESCENA_HI = pick('hi');
export const UXESCENA_ZH = pick('zh');
