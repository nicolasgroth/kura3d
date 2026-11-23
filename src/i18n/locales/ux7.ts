/**
 * @file src/i18n/locales/ux7.ts
 * @description Textos del lote ux7 en los 6 idiomas: acciones de avisos que no se pierden (historial con
 * botones y motivo si ya no aplican), enlace de unidades en el inspector, árbol de escena (ayuda «?»),
 * menú contextual con varios objetos, Medir › Capacidad, colores, exportar y recuperación. Cada clave se
 * escribe una vez con sus 6 idiomas; `UX7_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const UX7 = {
  // Acciones de avisos en el historial
  'ux7.toast.applied': { es: 'Ya se aplicó', en: 'Already applied', de: 'Bereits angewendet', fr: 'Déjà appliqué', hi: 'पहले ही लागू किया गया', zh: '已应用' },
  'ux7.toast.gone': { es: 'El objeto ya no existe', en: 'The object no longer exists', de: 'Das Objekt existiert nicht mehr', fr: 'L’objet n’existe plus', hi: 'वस्तु अब मौजूद नहीं है', zh: '对象已不存在' },
  'ux7.toast.stale': { es: 'Ya no aplica: la escena cambió', en: 'No longer applies: the scene changed', de: 'Gilt nicht mehr: Die Szene hat sich geändert', fr: 'Ne s’applique plus : la scène a changé', hi: 'अब लागू नहीं: दृश्य बदल गया', zh: '不再适用:场景已更改' },
  // Árbol de escena
  'ux7.tree.help': { es: 'Atajos del árbol de escena', en: 'Scene tree shortcuts', de: 'Tastenkürzel der Szenenliste', fr: 'Raccourcis de l’arborescence de scène', hi: 'दृश्य सूची के शॉर्टकट', zh: '场景树快捷键' },
  // Dividir: resumen de uniones en lenguaje claro
  'ux7.split.jointsUpTo': {
    es: '{count} {count?unión|uniones}: hasta {with} con conector; el resto se pega (al armar puede quedar alguna más para pegar)',
    en: '{count} {count?joint|joints}: up to {with} with a connector; the rest are glued (assembly may leave a few more to glue)',
    de: '{count} {count?Verbindung|Verbindungen}: bis zu {with} mit Verbinder; der Rest wird geklebt (beim Zusammenbau können weitere zum Kleben bleiben)',
    fr: '{count} {count?jonction|jonctions} : jusqu’à {with} avec connecteur ; le reste se colle (l’assemblage peut en laisser d’autres à coller)',
    hi: '{count} {count?जोड़|जोड़}: अधिकतम {with} कनेक्टर के साथ; बाकी चिपकाए जाते हैं (जोड़ते समय कुछ और चिपकाने पड़ सकते हैं)',
    zh: '{count} 处连接:最多 {with} 处带连接件;其余需粘合(装配时可能还有几处需要粘合)',
  },
  'ux7.split.jointsNoRoom': {
    es: '{count} {count?unión|uniones}, todas para pegar: ningún corte deja espacio para un conector',
    en: '{count} {count?joint|joints}, all glued: no cut leaves room for a connector',
    de: '{count} {count?Verbindung|Verbindungen}, alle zum Kleben: kein Schnitt bietet Platz für einen Verbinder',
    fr: '{count} {count?jonction|jonctions}, toutes à coller : aucune coupe ne laisse de place pour un connecteur',
    hi: '{count} {count?जोड़|जोड़}, सभी चिपकाने के लिए: किसी कट में कनेक्टर की जगह नहीं है',
    zh: '{count} 处连接,全部需粘合:没有切面能放下连接件',
  },
  // Menú contextual con varios objetos
  'ux7.menu.objects': { es: '{count} {count?objeto|objetos}', en: '{count} {count?object|objects}', de: '{count} {count?Objekt|Objekte}', fr: '{count} {count?objet|objets}', hi: '{count} {count?ऑब्जेक्ट|ऑब्जेक्ट}', zh: '{count} 个对象' },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof UX7]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(UX7).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const UX7_ES = pick('es');
export const UX7_EN = pick('en');
export const UX7_DE = pick('de');
export const UX7_FR = pick('fr');
export const UX7_HI = pick('hi');
export const UX7_ZH = pick('zh');
