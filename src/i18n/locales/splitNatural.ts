/**
 * @file src/i18n/locales/splitNatural.ts
 * @description Textos de la estrategia «Por las partes de la figura» de "Dividir para imprimir"
 * (selector «Cómo cortar», su explicación y el resumen de cortes), en los 6 idiomas. Se mezclan en
 * cada diccionario de `translations.ts` y `locales/*.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export const SPLITNATURAL_ES = {
  'split.strategy': 'Cómo cortar',
  'split.strategy.grid': 'Rejilla pareja',
  'split.strategy.natural': 'Por las partes de la figura',
  'split.strategy.gridHelp': 'Planos repartidos parejo y movidos hacia la sección más simple. Sirve para cualquier pieza.',
  'split.strategy.naturalHelp': 'Busca los estrechamientos (cuello, cintura, tobillos, donde las piernas entran a la cadera) y corta ahí, para que las uniones queden chicas y se noten menos. Conviene en figuras y estatuas. Los planos siguen siendo rectos y atraviesan todo el modelo.',
  'split.natural.summary': 'Cortes en partes de la figura: {natural} · cortes rectos adicionales: {straight}',
  'split.natural.none': 'No se encontraron estrechamientos útiles donde cortar: se usan los cortes rectos de la rejilla.',
};

export const SPLITNATURAL_EN = {
  'split.strategy': 'How to cut',
  'split.strategy.grid': 'Even grid',
  'split.strategy.natural': 'By the parts of the figure',
  'split.strategy.gridHelp': 'Planes spread evenly and shifted toward the simplest section. Works for any part.',
  'split.strategy.naturalHelp': 'Looks for the narrowings (neck, waist, ankles, where the legs meet the hips) and cuts there, so joints stay small and less visible. Best for figures and statues. Planes are still straight and cross the whole model.',
  'split.natural.summary': 'Cuts at parts of the figure: {natural} · extra straight cuts: {straight}',
  'split.natural.none': 'No useful narrowings were found to cut at: the straight grid cuts are used.',
};

export const SPLITNATURAL_DE = {
  'split.strategy': 'Wie schneiden',
  'split.strategy.grid': 'Gleichmäßiges Raster',
  'split.strategy.natural': 'Nach den Teilen der Figur',
  'split.strategy.gridHelp': 'Ebenen gleichmäßig verteilt und zum einfachsten Querschnitt verschoben. Passt für jedes Teil.',
  'split.strategy.naturalHelp': 'Sucht die Verengungen (Hals, Taille, Knöchel, wo die Beine in die Hüfte übergehen) und schneidet dort, damit die Verbindungen klein und weniger sichtbar sind. Ideal für Figuren und Statuen. Die Ebenen bleiben gerade und gehen durch das ganze Modell.',
  'split.natural.summary': 'Schnitte an Teilen der Figur: {natural} · zusätzliche gerade Schnitte: {straight}',
  'split.natural.none': 'Keine brauchbaren Verengungen zum Schneiden gefunden: Es werden die geraden Rasterschnitte verwendet.',
};

export const SPLITNATURAL_FR = {
  'split.strategy': 'Comment couper',
  'split.strategy.grid': 'Grille régulière',
  'split.strategy.natural': 'Selon les parties de la figurine',
  'split.strategy.gridHelp': 'Plans répartis régulièrement et décalés vers la section la plus simple. Convient à toute pièce.',
  'split.strategy.naturalHelp': 'Cherche les rétrécissements (cou, taille, chevilles, là où les jambes rejoignent les hanches) et coupe à cet endroit, pour que les jonctions restent petites et discrètes. Idéal pour les figurines et statues. Les plans restent droits et traversent tout le modèle.',
  'split.natural.summary': 'Coupes aux parties de la figurine : {natural} · coupes droites en plus : {straight}',
  'split.natural.none': 'Aucun rétrécissement utile trouvé pour couper : les coupes droites de la grille sont utilisées.',
};

export const SPLITNATURAL_HI = {
  'split.strategy': 'कैसे काटें',
  'split.strategy.grid': 'समान ग्रिड',
  'split.strategy.natural': 'आकृति के हिस्सों के अनुसार',
  'split.strategy.gridHelp': 'तल समान रूप से बँटे और सबसे सरल अनुप्रस्थ काट की ओर खिसकाए जाते हैं। किसी भी भाग के लिए उपयुक्त।',
  'split.strategy.naturalHelp': 'संकरे हिस्से (गर्दन, कमर, टखने, जहाँ पैर कूल्हे से मिलते हैं) खोजकर वहीं काटता है, ताकि जोड़ छोटे और कम दिखें। मूर्तियों और आकृतियों के लिए उपयुक्त। तल अब भी सीधे हैं और पूरे मॉडल से गुज़रते हैं।',
  'split.natural.summary': 'आकृति के हिस्सों पर कट: {natural} · अतिरिक्त सीधे कट: {straight}',
  'split.natural.none': 'काटने के लिए कोई उपयोगी संकरा हिस्सा नहीं मिला: ग्रिड के सीधे कट उपयोग किए जाते हैं।',
};

export const SPLITNATURAL_ZH = {
  'split.strategy': '切割方式',
  'split.strategy.grid': '均匀网格',
  'split.strategy.natural': '按人物的部位',
  'split.strategy.gridHelp': '切割平面均匀分布，并移向最简单的截面。适用于任何零件。',
  'split.strategy.naturalHelp': '寻找收窄处（颈部、腰部、脚踝、腿与髋部相接处）并在那里切割，使接缝小且不显眼。适合人物和雕像。切割平面仍是直的，并贯穿整个模型。',
  'split.natural.summary': '在人物部位的切割：{natural} · 额外的直切：{straight}',
  'split.natural.none': '未找到可用的收窄处：使用网格的直切。',
};
