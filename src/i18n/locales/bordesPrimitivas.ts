/**
 * @file src/i18n/locales/bordesPrimitivas.ts
 * @description Textos del grupo «Bordes» del inspector (Caja, Cilindro, Tubo y Prisma): acabado
 * recto, redondeado o achaflanado, tamaño, aristas afectadas y nota cuando el tamaño se acota.
 * Cada clave se escribe una vez con sus 6 idiomas; `BORDES_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const BORDES = {
  'inspector.params.edges.title': { es: 'Bordes', en: 'Edges', de: 'Kanten', fr: 'Arêtes', hi: 'किनारे', zh: '边缘' },
  'inspector.params.edges.style': { es: 'Acabado', en: 'Finish', de: 'Ausführung', fr: 'Finition', hi: 'फ़िनिश', zh: '样式' },
  'inspector.params.edges.style.sharp': { es: 'Rectos', en: 'Sharp', de: 'Scharf', fr: 'Vives', hi: 'सीधे', zh: '直角' },
  'inspector.params.edges.style.round': { es: 'Redondeados', en: 'Rounded', de: 'Abgerundet', fr: 'Arrondies', hi: 'गोल', zh: '圆角' },
  'inspector.params.edges.style.chamfer': { es: 'Achaflanados', en: 'Chamfered', de: 'Gefast', fr: 'Chanfreinées', hi: 'चैम्फ़र', zh: '倒角' },
  'inspector.params.edges.sizeRound': { es: 'Radio', en: 'Radius', de: 'Radius', fr: 'Rayon', hi: 'त्रिज्या', zh: '半径' },
  'inspector.params.edges.sizeChamfer': { es: 'Chaflán', en: 'Chamfer', de: 'Fase', fr: 'Chanfrein', hi: 'चैम्फ़र', zh: '倒角尺寸' },
  'inspector.params.edges.scope': { es: 'Aristas', en: 'Which edges', de: 'Welche Kanten', fr: 'Arêtes concernées', hi: 'कौन से किनारे', zh: '作用边' },
  'inspector.params.edges.scope.all': { es: 'Todas', en: 'All', de: 'Alle', fr: 'Toutes', hi: 'सभी', zh: '全部' },
  'inspector.params.edges.scope.vertical': { es: 'Solo verticales', en: 'Vertical only', de: 'Nur senkrechte', fr: 'Verticales seules', hi: 'केवल खड़े', zh: '仅竖边' },
  'inspector.params.edges.scope.top': { es: 'Solo superior', en: 'Top only', de: 'Nur oben', fr: 'Dessus seul', hi: 'केवल ऊपर', zh: '仅顶部' },
  'inspector.params.edges.scopeTip.vertical': {
    es: 'Redondea las esquinas en planta: la base queda plana y se imprime sin voladizo.',
    en: 'Rounds the corners seen from above: the base stays flat and prints without overhang.',
    de: 'Rundet die Ecken in der Draufsicht: Die Unterseite bleibt flach und druckt ohne Überhang.',
    fr: 'Arrondit les coins vus de dessus : la base reste plane et s’imprime sans porte-à-faux.',
    hi: 'ऊपर से दिखने वाले कोनों को गोल करता है: आधार सपाट रहता है और बिना ओवरहैंग के प्रिंट होता है।',
    zh: '只处理俯视的转角:底面保持平整,打印无悬垂。',
  },
  'inspector.params.edges.scopeTip.top': {
    es: 'Solo el borde de arriba: la base queda recta sobre la cama.',
    en: 'Only the top rim: the base stays square on the bed.',
    de: 'Nur die obere Kante: Die Unterseite bleibt gerade auf dem Druckbett.',
    fr: 'Seulement le bord supérieur : la base reste droite sur le plateau.',
    hi: 'केवल ऊपरी किनारा: आधार बेड पर सीधा रहता है।',
    zh: '仅顶部边缘:底面在打印床上保持直角。',
  },
  'inspector.params.edges.scopeTip.all': {
    es: 'Todas las aristas, también las de la base (puede necesitar soportes en el borde inferior).',
    en: 'Every edge, including the base (the bottom rim may need supports).',
    de: 'Alle Kanten, auch an der Unterseite (die untere Kante kann Stützen brauchen).',
    fr: 'Toutes les arêtes, y compris celles de la base (le bord inférieur peut demander des supports).',
    hi: 'सभी किनारे, आधार वाले भी (निचले किनारे को सपोर्ट की ज़रूरत हो सकती है)।',
    zh: '所有边,包括底面(底部边缘可能需要支撑)。',
  },
  'inspector.params.edges.clamped': {
    es: 'Se aplicó {size} mm: es lo máximo que cabe con estas medidas (pediste {requested} mm).',
    en: '{size} mm applied: the most that fits these dimensions (you asked for {requested} mm).',
    de: '{size} mm angewendet: mehr passt bei diesen Maßen nicht (gewünscht: {requested} mm).',
    fr: '{size} mm appliqués : c’est le maximum pour ces dimensions (demandé : {requested} mm).',
    hi: '{size} mm लागू किया गया: इन माप में इससे अधिक नहीं आता (आपने {requested} mm माँगा था)।',
    zh: '已应用 {size} mm:这是当前尺寸能容纳的最大值(你输入的是 {requested} mm)。',
  },
} satisfies Record<string, Row>;

type Dict = { [K in keyof typeof BORDES]: string };

function pick(lang: keyof Row): Dict {
  return Object.fromEntries(Object.entries(BORDES).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const BORDES_ES = pick('es');
export const BORDES_EN = pick('en');
export const BORDES_DE = pick('de');
export const BORDES_FR = pick('fr');
export const BORDES_HI = pick('hi');
export const BORDES_ZH = pick('zh');
