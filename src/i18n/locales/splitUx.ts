/**
 * @file src/i18n/locales/splitUx.ts
 * @description Textos de la mejora de usabilidad de "Dividir para imprimir" y "Uniones y armado" en los 6
 * idiomas: tamaño de conector automático y su nombre único (diámetro Ø), resumen único de uniones débiles,
 * filas compactas, plurales correctos, resaltado/encuadre de la unión y estado del grupo armado. Cada clave
 * se escribe una vez con sus 6 idiomas; `SPLITUX_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const UX = {
  // --- Tamaño del conector: automático y diámetro Ø ---
  'split.size.auto': {
    es: 'Tamaño automático (recomendado)', en: 'Automatic size (recommended)', de: 'Automatische Größe (empfohlen)',
    fr: 'Taille automatique (recommandée)', hi: 'स्वचालित आकार (अनुशंसित)', zh: '自动尺寸（推荐）',
  },
  'split.size.autoHelp': {
    es: 'Cada unión usa el diámetro que recomienda Kura3D según su superficie de contacto y la pieza que sostiene, respetando la pared mínima.',
    en: 'Each joint uses the diameter Kura3D recommends for its contact area and the part it holds, keeping the minimum wall.',
    de: 'Jede Verbindung nutzt den von Kura3D empfohlenen Durchmesser für ihre Kontaktfläche und das gehaltene Teil und wahrt die Mindestwand.',
    fr: 'Chaque jonction utilise le diamètre recommandé par Kura3D selon sa surface de contact et la pièce qu\'elle tient, en respectant la paroi minimale.',
    hi: 'हर जोड़ अपने संपर्क क्षेत्र और थामे जाने वाले भाग के लिए Kura3D का अनुशंसित व्यास इस्तेमाल करता है, न्यूनतम दीवार का ध्यान रखते हुए।',
    zh: '每个接合根据其接触面积和所承载的部件使用 Kura3D 推荐的直径，并保证最小壁厚。',
  },
  'split.size.label': {
    es: 'Diámetro del conector Ø', en: 'Connector diameter Ø', de: 'Verbinderdurchmesser Ø',
    fr: 'Diamètre du connecteur Ø', hi: 'कनेक्टर का व्यास Ø', zh: '连接件直径 Ø',
  },
  'split.size.help': {
    es: 'Ø es el diámetro: el ancho total del conector (el doble de su radio). Si pones uno menor al recomendado, la unión puede quedar débil.',
    en: 'Ø is the diameter: the total width of the connector (twice its radius). A value under the recommended one can leave the joint weak.',
    de: 'Ø ist der Durchmesser: die gesamte Breite des Verbinders (doppelter Radius). Ein Wert unter dem empfohlenen kann die Verbindung schwächen.',
    fr: 'Ø est le diamètre : la largeur totale du connecteur (le double du rayon). Une valeur sous la recommandation peut fragiliser la jonction.',
    hi: 'Ø व्यास है: कनेक्टर की पूरी चौड़ाई (त्रिज्या का दोगुना)। अनुशंसित से कम मान जोड़ को कमज़ोर कर सकता है।',
    zh: 'Ø 是直径：连接件的总宽度（半径的两倍）。低于推荐值可能使接合较弱。',
  },
  'split.size.autoTip': {
    es: 'Automático: cada unión usa su diámetro recomendado', en: 'Automatic: each joint uses its recommended diameter',
    de: 'Automatisch: Jede Verbindung nutzt ihren empfohlenen Durchmesser', fr: 'Automatique : chaque jonction utilise son diamètre recommandé',
    hi: 'स्वचालित: हर जोड़ अपना अनुशंसित व्यास इस्तेमाल करता है', zh: '自动：每个接合使用其推荐直径',
  },
  'settings.split.size': {
    es: 'Tamaño del conector por defecto', en: 'Default connector size', de: 'Standard-Verbindergröße',
    fr: 'Taille de connecteur par défaut', hi: 'डिफ़ॉल्ट कनेक्टर आकार', zh: '默认连接件尺寸',
  },
  'settings.split.sizeAuto': {
    es: 'Automático (recomendado)', en: 'Automatic (recommended)', de: 'Automatisch (empfohlen)',
    fr: 'Automatique (recommandé)', hi: 'स्वचालित (अनुशंसित)', zh: '自动（推荐）',
  },
  'settings.split.sizeValue': {
    es: 'Diámetro Ø por defecto (mm)', en: 'Default diameter Ø (mm)', de: 'Standarddurchmesser Ø (mm)',
    fr: 'Diamètre Ø par défaut (mm)', hi: 'डिफ़ॉल्ट व्यास Ø (मिमी)', zh: '默认直径 Ø（毫米）',
  },
  'settings.split.sizeHelp': {
    es: 'Automático elige el diámetro de cada unión según su superficie y la pieza que sostiene. Un valor fijo se respeta tal cual y puede dejar uniones débiles.',
    en: 'Automatic picks each joint\'s diameter from its contact area and the part it holds. A fixed value is respected as typed and may leave weak joints.',
    de: 'Automatisch wählt den Durchmesser jeder Verbindung nach Fläche und gehaltenem Teil. Ein fester Wert wird unverändert übernommen und kann schwache Verbindungen ergeben.',
    fr: 'Automatique choisit le diamètre de chaque jonction selon sa surface et la pièce qu\'elle tient. Une valeur fixe est respectée telle quelle et peut laisser des jonctions fragiles.',
    hi: 'स्वचालित हर जोड़ का व्यास उसके क्षेत्र और थामे भाग के अनुसार चुनता है। निश्चित मान जैसा है वैसा रखा जाता है और जोड़ कमज़ोर हो सकते हैं।',
    zh: '“自动”会根据每个接合的接触面积和所承载的部件选择直径。固定值将按输入使用，可能产生较弱的接合。',
  },

  // --- Resumen único de uniones débiles ---
  'splitUx.weak.summary.one': {
    es: '{count} unión es más débil de lo recomendado', en: '{count} joint is weaker than recommended', de: '{count} Verbindung ist schwächer als empfohlen',
    fr: '{count} jonction est plus fragile que recommandé', hi: '{count} जोड़ अनुशंसित से कमज़ोर है', zh: '{count} 个接合比推荐的更弱',
  },
  'splitUx.weak.summary.other': {
    es: '{count} uniones son más débiles de lo recomendado', en: '{count} joints are weaker than recommended', de: '{count} Verbindungen sind schwächer als empfohlen',
    fr: '{count} jonctions sont plus fragiles que recommandé', hi: '{count} जोड़ अनुशंसित से कमज़ोर हैं', zh: '{count} 个接合比推荐的更弱',
  },
  'splitUx.weak.advice': {
    es: 'Un conector delgado puede romperse al encajar o con el uso. «Reforzar y dividir de nuevo» lo agranda hasta el diámetro recomendado (deshace la división y la repite). También puedes dividir de nuevo con «Tamaño automático (recomendado)».',
    en: 'A thin connector can break when fitted or in use. "Reinforce and split again" enlarges it to the recommended diameter (it undoes the split and repeats it). You can also split again with "Automatic size (recommended)".',
    de: 'Ein dünner Verbinder kann beim Fügen oder im Gebrauch brechen. „Verstärken und neu teilen“ vergrößert ihn auf den empfohlenen Durchmesser (macht die Teilung rückgängig und wiederholt sie). Du kannst auch mit „Automatische Größe (empfohlen)“ neu teilen.',
    fr: 'Un connecteur fin peut casser à l\'emboîtement ou à l\'usage. « Renforcer et diviser à nouveau » l\'agrandit au diamètre recommandé (annule la division et la refait). Tu peux aussi diviser à nouveau avec « Taille automatique (recommandée) ».',
    hi: 'पतला कनेक्टर जोड़ते समय या उपयोग में टूट सकता है। “मज़बूत करें और फिर विभाजित करें” इसे अनुशंसित व्यास तक बड़ा करता है (विभाजन पूर्ववत करके दोहराता है)। आप “स्वचालित आकार (अनुशंसित)” से भी फिर विभाजित कर सकते हैं।',
    zh: '较细的连接件在装配或使用时可能断裂。“加固并重新分割”会把它放大到推荐直径（撤销分割后重做）。也可以用“自动尺寸（推荐）”重新分割。',
  },
  'splitUx.weak.adviceLimit': {
    es: 'Ya se reforzó, pero un conector más grande dejaría la pared demasiado delgada. Pega estas caras con adhesivo, imprime con más perímetros o mueve el plano de corte a una sección más ancha.',
    en: 'It was already reinforced, but a larger connector would leave the wall too thin. Glue these faces, print with more perimeters or move the cut plane to a wider section.',
    de: 'Es wurde bereits verstärkt, aber ein größerer Verbinder würde die Wand zu dünn machen. Klebe diese Flächen, drucke mit mehr Wänden oder verschiebe die Schnittebene an einen breiteren Querschnitt.',
    fr: 'Déjà renforcé, mais un connecteur plus grand laisserait la paroi trop fine. Colle ces faces, imprime avec plus de périmètres ou déplace le plan de coupe vers une section plus large.',
    hi: 'पहले ही मज़बूत किया जा चुका है, पर बड़ा कनेक्टर दीवार को बहुत पतला कर देगा। इन सतहों को चिपकाएँ, अधिक परिधि से प्रिंट करें या कट प्लेन को चौड़े भाग में ले जाएँ।',
    zh: '已经加固过，但更大的连接件会使壁过薄。请用胶水粘合这些面，增加打印外壳层数，或把切割面移到更宽的截面。',
  },
  'splitUx.weak.short': {
    es: 'Débil · Ø{measured}, recomendado Ø{recommended}', en: 'Weak · Ø{measured}, recommended Ø{recommended}', de: 'Schwach · Ø{measured}, empfohlen Ø{recommended}',
    fr: 'Fragile · Ø{measured}, recommandé Ø{recommended}', hi: 'कमज़ोर · Ø{measured}, अनुशंसित Ø{recommended}', zh: '较弱 · Ø{measured}，推荐 Ø{recommended}',
  },
  'splitUx.weak.shortLimit': {
    es: 'Sigue débil · Ø{measured}, recomendado Ø{recommended}', en: 'Still weak · Ø{measured}, recommended Ø{recommended}', de: 'Weiter schwach · Ø{measured}, empfohlen Ø{recommended}',
    fr: 'Toujours fragile · Ø{measured}, recommandé Ø{recommended}', hi: 'अब भी कमज़ोर · Ø{measured}, अनुशंसित Ø{recommended}', zh: '仍较弱 · Ø{measured}，推荐 Ø{recommended}',
  },
  'splitUx.reinforced': {
    es: 'Se agrandó el conector. Pedido: Ø{requested} mm ×{requestedCount} → aplicado: Ø{size} mm ×{count}.',
    en: 'The connector was enlarged. Requested: Ø{requested} mm ×{requestedCount} → applied: Ø{size} mm ×{count}.',
    de: 'Der Verbinder wurde vergrößert. Gewünscht: Ø{requested} mm ×{requestedCount} → angewendet: Ø{size} mm ×{count}.',
    fr: 'Le connecteur a été agrandi. Demandé : Ø{requested} mm ×{requestedCount} → appliqué : Ø{size} mm ×{count}.',
    hi: 'कनेक्टर बड़ा किया गया। माँगा: Ø{requested} मिमी ×{requestedCount} → लागू: Ø{size} मिमी ×{count}।',
    zh: '连接件已加大。请求：Ø{requested} 毫米 ×{requestedCount} → 实际：Ø{size} 毫米 ×{count}。',
  },
  'splitUx.detail': {
    es: 'Detalle', en: 'Details', de: 'Details', fr: 'Détails', hi: 'विवरण', zh: '详情',
  },
  'splitUx.detailOf': {
    es: 'Detalle de la unión {label}', en: 'Details of joint {label}', de: 'Details der Verbindung {label}',
    fr: 'Détails de la jonction {label}', hi: 'जोड़ {label} का विवरण', zh: '接合 {label} 的详情',
  },
  'splitUx.common.title': {
    es: 'Avisos que se repiten', en: 'Repeated notices', de: 'Wiederkehrende Hinweise', fr: 'Avis répétés', hi: 'दोहराई गई सूचनाएँ', zh: '重复的提示',
  },
  'splitUx.common.count.one': {
    es: '{text} (afecta a {count} unión)', en: '{text} (affects {count} joint)', de: '{text} (betrifft {count} Verbindung)',
    fr: '{text} (concerne {count} jonction)', hi: '{text} ({count} जोड़ पर लागू)', zh: '{text}（影响 {count} 个接合）',
  },
  'splitUx.common.count.other': {
    es: '{text} (afecta a {count} uniones)', en: '{text} (affects {count} joints)', de: '{text} (betrifft {count} Verbindungen)',
    fr: '{text} (concerne {count} jonctions)', hi: '{text} ({count} जोड़ पर लागू)', zh: '{text}（影响 {count} 个接合）',
  },
  'splitUx.list.label': {
    es: 'Lista de uniones. Usa las flechas arriba y abajo para moverte entre ellas.',
    en: 'Joint list. Use the up and down arrows to move between them.',
    de: 'Verbindungsliste. Mit den Pfeiltasten auf und ab wechselst du zwischen den Einträgen.',
    fr: 'Liste des jonctions. Utilise les flèches haut et bas pour passer de l\'une à l\'autre.',
    hi: 'जोड़ों की सूची। उनके बीच जाने के लिए ऊपर और नीचे तीर कुंजियाँ इस्तेमाल करें।',
    zh: '接合列表。使用上下方向键在其间移动。',
  },
  'splitUx.focus.hint': {
    es: 'Elige una unión para verla resaltada y encuadrada en el visor.',
    en: 'Choose a joint to see it highlighted and framed in the viewport.',
    de: 'Wähle eine Verbindung, um sie im Viewport hervorgehoben und eingerahmt zu sehen.',
    fr: 'Choisis une jonction pour la voir en surbrillance et cadrée dans la vue.',
    hi: 'व्यूपोर्ट में हाइलाइट और फ़्रेम में देखने के लिए कोई जोड़ चुनें।',
    zh: '选择一个接合，即可在视图中高亮并取景查看。',
  },

  // --- Plurales ---
  'splitUx.parts.one': { es: '{count} pieza', en: '{count} piece', de: '{count} Teil', fr: '{count} pièce', hi: '{count} भाग', zh: '{count} 个部件' },
  'splitUx.parts.other': { es: '{count} piezas', en: '{count} pieces', de: '{count} Teile', fr: '{count} pièces', hi: '{count} भाग', zh: '{count} 个部件' },
  'splitUx.plates.one': { es: '{count} placa', en: '{count} plate', de: '{count} Platte', fr: '{count} plateau', hi: '{count} प्लेट', zh: '{count} 个打印板' },
  'splitUx.plates.other': { es: '{count} placas', en: '{count} plates', de: '{count} Platten', fr: '{count} plateaux', hi: '{count} प्लेट', zh: '{count} 个打印板' },
  'splitUx.fixed.glued.one': {
    es: 'dejó {count} unión para pegar', en: 'left {count} joint for gluing', de: 'hat {count} Verbindung zum Kleben belassen',
    fr: 'a laissé {count} jonction à coller', hi: '{count} जोड़ चिपकाने के लिए छोड़ा', zh: '将 {count} 个接合改为粘合',
  },
  'splitUx.fixed.glued.other': {
    es: 'dejó {count} uniones para pegar', en: 'left {count} joints for gluing', de: 'hat {count} Verbindungen zum Kleben belassen',
    fr: 'a laissé {count} jonctions à coller', hi: '{count} जोड़ चिपकाने के लिए छोड़े', zh: '将 {count} 个接合改为粘合',
  },
  'splitUx.fixed.changed.one': {
    es: 'cambió el tipo de conector en {count} unión', en: 'changed the connector type on {count} joint', de: 'hat bei {count} Verbindung den Verbindertyp geändert',
    fr: 'a changé le type de connecteur sur {count} jonction', hi: '{count} जोड़ पर कनेक्टर प्रकार बदला', zh: '更换了 {count} 个接合的连接件类型',
  },
  'splitUx.fixed.changed.other': {
    es: 'cambió el tipo de conector en {count} uniones', en: 'changed the connector type on {count} joints', de: 'hat bei {count} Verbindungen den Verbindertyp geändert',
    fr: 'a changé le type de connecteur sur {count} jonctions', hi: '{count} जोड़ों पर कनेक्टर प्रकार बदला', zh: '更换了 {count} 个接合的连接件类型',
  },
  'splitUx.fixed.intro': {
    es: 'Para que se pueda montar, Kura3D {actions}.', en: 'So it can be assembled, Kura3D {actions}.', de: 'Damit sich alles montieren lässt, {actions}.',
    fr: 'Pour que le montage soit possible, Kura3D {actions}.', hi: 'असेंबली संभव करने के लिए Kura3D ने {actions}।', zh: '为了能够装配，Kura3D {actions}。',
  },
  'splitUx.fixed.and': { es: ' y ', en: ' and ', de: ' und ', fr: ' et ', hi: ' और ', zh: '，并' },
  'splitUx.warn.rotated.one': {
    es: '{count} pieza irá acostada para caber.', en: '{count} piece will be laid down to fit.', de: '{count} Teil wird zum Passen hingelegt.',
    fr: '{count} pièce sera couchée pour tenir.', hi: '{count} भाग समाने के लिए लिटाया जाएगा।', zh: '{count} 个部件将被放倒以便放入。',
  },
  'splitUx.warn.rotated.other': {
    es: '{count} piezas irán acostadas para caber.', en: '{count} pieces will be laid down to fit.', de: '{count} Teile werden zum Passen hingelegt.',
    fr: '{count} pièces seront couchées pour tenir.', hi: '{count} भाग समाने के लिए लिटाए जाएँगे।', zh: '{count} 个部件将被放倒以便放入。',
  },
  'splitUx.warn.diagonal.one': {
    es: '{count} pieza irá en diagonal sobre la cama para caber.', en: '{count} piece will go diagonally on the bed to fit.', de: '{count} Teil kommt diagonal aufs Bett, damit es passt.',
    fr: '{count} pièce ira en diagonale sur le plateau pour tenir.', hi: '{count} भाग समाने के लिए बेड पर तिरछा रखा जाएगा।', zh: '{count} 个部件将斜放在打印床上以便放入。',
  },
  'splitUx.warn.diagonal.other': {
    es: '{count} piezas irán en diagonal sobre la cama para caber.', en: '{count} pieces will go diagonally on the bed to fit.', de: '{count} Teile kommen diagonal aufs Bett, damit sie passen.',
    fr: '{count} pièces iront en diagonale sur le plateau pour tenir.', hi: '{count} भाग समाने के लिए बेड पर तिरछे रखे जाएँगे।', zh: '{count} 个部件将斜放在打印床上以便放入。',
  },

  // --- Armado ---
  'splitUx.assembled.badge': {
    es: 'Armado', en: 'Assembled', de: 'Zusammengebaut', fr: 'Assemblé', hi: 'जुड़ा हुआ', zh: '已装配',
  },
  'splitUx.assembled.status': {
    es: 'Armado: usa «Preparar para imprimir» para ver las placas', en: 'Assembled: use "Prepare to print" to see the plates',
    de: 'Zusammengebaut: Mit „Zum Drucken vorbereiten“ siehst du die Platten', fr: 'Assemblé : utilise « Préparer pour imprimer » pour voir les plateaux',
    hi: 'जुड़ा हुआ: प्लेट देखने के लिए “प्रिंट के लिए तैयार करें” इस्तेमाल करें', zh: '已装配：使用“准备打印”查看打印板',
  },

  // --- Explosión ---
  'splitUx.explode.label': {
    es: 'Separación de las piezas (explosión)', en: 'Piece separation (explode)', de: 'Teileabstand (Explosion)',
    fr: 'Écartement des pièces (éclaté)', hi: 'भागों का अलगाव (एक्सप्लोड)', zh: '部件分离（爆炸视图）',
  },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof UX]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(UX).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const SPLITUX_ES = pick('es');
export const SPLITUX_EN = pick('en');
export const SPLITUX_DE = pick('de');
export const SPLITUX_FR = pick('fr');
export const SPLITUX_HI = pick('hi');
export const SPLITUX_ZH = pick('zh');
