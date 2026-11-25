/**
 * @file src/i18n/locales/imanesUnion.ts
 * @description Imanes como unión del corte en Dividir para imprimir: tipo de unión, opciones del imán (preajuste,
 * holguras, cantidad), ayuda, polaridad, aviso de imán cuadrado y avisos del motor, en los 6 idiomas. Se mezclan al
 * final de cada diccionario de `translations.ts` y `locales/*.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export const IMANES_UNION_ES = {
  'split.joint.magnet': 'Imanes (desmontable)',
  'splitJoints.type.magnet': 'Imanes',
  'splitMagnet.preset': 'Imán',
  'splitMagnet.clearance': 'Holgura del diámetro',
  'splitMagnet.depthClearance': 'Holgura de profundidad',
  'splitMagnet.countAuto': 'Cantidad automática',
  'splitMagnet.count': 'Imanes por unión',
  'splitMagnet.help': 'Cada imán abre dos alojamientos enfrentados, uno en cada cara del corte, de Ø{width} × {depth} mm. Automática: al menos uno por isla y dos por unión si caben, para que no gire. Donde no cabe un imán con 1,2 mm de pared, no se pone y la unión lo avisa.',
  'splitMagnet.polarity': 'Pega los imanes de cada par con polos opuestos; prueba el par antes de pegar.',
  'splitMagnet.squareNote': 'Por ahora las uniones con imanes son solo para imanes redondos: con uno cuadrado la unión queda para pegar. Elige un imán redondo.',
  'engineWarning.SPLIT_MAGNET_NO_ROOM': 'En la unión {label} ({a}–{b}) no cabe un imán de Ø{diameter} × {height} mm con {wall} mm de pared alrededor y hacia el exterior: queda para pegar. Elige un imán más chico o mueve el corte a una zona más ancha.',
  'engineWarning.SPLIT_MAGNET_REDUCED': 'En la unión {label} ({a}–{b}) caben {count} imanes de los {requested} pedidos, cada uno con su pared mínima.',
  'engineWarning.SPLIT_MAGNET_SQUARE': 'La unión {label} ({a}–{b}) no lleva imanes: por ahora las uniones con imanes son solo para imanes redondos.',
};

export const IMANES_UNION_EN = {
  'split.joint.magnet': 'Magnets (removable)',
  'splitJoints.type.magnet': 'Magnets',
  'splitMagnet.preset': 'Magnet',
  'splitMagnet.clearance': 'Diameter clearance',
  'splitMagnet.depthClearance': 'Depth clearance',
  'splitMagnet.countAuto': 'Automatic count',
  'splitMagnet.count': 'Magnets per joint',
  'splitMagnet.help': 'Each magnet opens two facing pockets, one on each face of the cut, Ø{width} × {depth} mm. Automatic: at least one per island and two per joint when they fit, so it does not twist. Where a magnet does not fit with a 1.2 mm wall it is left out and the joint says so.',
  'splitMagnet.polarity': 'Glue the magnets of each pair with opposite poles facing; test the pair before gluing.',
  'splitMagnet.squareNote': 'For now magnet joints only take round magnets: with a square one the joint is left for gluing. Pick a round magnet.',
  'engineWarning.SPLIT_MAGNET_NO_ROOM': 'Joint {label} ({a}–{b}) has no room for a Ø{diameter} × {height} mm magnet with a {wall} mm wall around it and to the outside: it is left for gluing. Pick a smaller magnet or move the cut to a wider area.',
  'engineWarning.SPLIT_MAGNET_REDUCED': 'Joint {label} ({a}–{b}) fits {count} of the {requested} magnets requested, each with its minimum wall.',
  'engineWarning.SPLIT_MAGNET_SQUARE': 'Joint {label} ({a}–{b}) has no magnets: for now magnet joints only take round magnets.',
};

export const IMANES_UNION_DE = {
  'split.joint.magnet': 'Magnete (zerlegbar)',
  'splitJoints.type.magnet': 'Magnete',
  'splitMagnet.preset': 'Magnet',
  'splitMagnet.clearance': 'Spiel im Durchmesser',
  'splitMagnet.depthClearance': 'Spiel in der Tiefe',
  'splitMagnet.countAuto': 'Anzahl automatisch',
  'splitMagnet.count': 'Magnete pro Verbindung',
  'splitMagnet.help': 'Jeder Magnet öffnet zwei gegenüberliegende Aufnahmen, eine auf jeder Schnittfläche, Ø{width} × {depth} mm. Automatisch: mindestens einer pro Insel und zwei pro Verbindung, wenn sie passen, damit nichts verdreht. Wo ein Magnet mit 1,2 mm Wand nicht passt, entfällt er und die Verbindung meldet es.',
  'splitMagnet.polarity': 'Die Magnete jedes Paars mit entgegengesetzten Polen einkleben; das Paar vor dem Kleben testen.',
  'splitMagnet.squareNote': 'Magnetverbindungen nehmen vorerst nur runde Magnete: mit einem eckigen bleibt die Verbindung zum Kleben. Einen runden Magnet wählen.',
  'engineWarning.SPLIT_MAGNET_NO_ROOM': 'An Verbindung {label} ({a}–{b}) passt kein Magnet Ø{diameter} × {height} mm mit {wall} mm Wand ringsum und nach außen: sie bleibt zum Kleben. Einen kleineren Magnet wählen oder den Schnitt in einen breiteren Bereich verschieben.',
  'engineWarning.SPLIT_MAGNET_REDUCED': 'An Verbindung {label} ({a}–{b}) passen {count} der {requested} gewünschten Magnete, jeder mit seiner Mindestwand.',
  'engineWarning.SPLIT_MAGNET_SQUARE': 'Verbindung {label} ({a}–{b}) hat keine Magnete: Magnetverbindungen nehmen vorerst nur runde Magnete.',
};

export const IMANES_UNION_FR = {
  'split.joint.magnet': 'Aimants (démontable)',
  'splitJoints.type.magnet': 'Aimants',
  'splitMagnet.preset': 'Aimant',
  'splitMagnet.clearance': 'Jeu sur le diamètre',
  'splitMagnet.depthClearance': 'Jeu en profondeur',
  'splitMagnet.countAuto': 'Nombre automatique',
  'splitMagnet.count': 'Aimants par jonction',
  'splitMagnet.help': 'Chaque aimant ouvre deux logements face à face, un sur chaque face de la coupe, de Ø{width} × {depth} mm. Automatique : au moins un par îlot et deux par jonction s’ils tiennent, pour qu’elle ne tourne pas. Là où un aimant ne tient pas avec 1,2 mm de paroi, il n’est pas placé et la jonction le signale.',
  'splitMagnet.polarity': 'Collez les aimants de chaque paire pôles opposés face à face ; testez la paire avant de coller.',
  'splitMagnet.squareNote': 'Pour l’instant les jonctions à aimants n’acceptent que des aimants ronds : avec un carré, la jonction reste à coller. Choisissez un aimant rond.',
  'engineWarning.SPLIT_MAGNET_NO_ROOM': 'À la jonction {label} ({a}–{b}), un aimant de Ø{diameter} × {height} mm ne tient pas avec {wall} mm de paroi autour et vers l’extérieur : elle reste à coller. Choisissez un aimant plus petit ou déplacez la coupe vers une zone plus large.',
  'engineWarning.SPLIT_MAGNET_REDUCED': 'À la jonction {label} ({a}–{b}), {count} des {requested} aimants demandés tiennent, chacun avec sa paroi minimale.',
  'engineWarning.SPLIT_MAGNET_SQUARE': 'La jonction {label} ({a}–{b}) n’a pas d’aimants : pour l’instant les jonctions à aimants n’acceptent que des aimants ronds.',
};

export const IMANES_UNION_HI = {
  'split.joint.magnet': 'चुंबक (अलग करने योग्य)',
  'splitJoints.type.magnet': 'चुंबक',
  'splitMagnet.preset': 'चुंबक',
  'splitMagnet.clearance': 'व्यास की छूट',
  'splitMagnet.depthClearance': 'गहराई की छूट',
  'splitMagnet.countAuto': 'स्वचालित संख्या',
  'splitMagnet.count': 'प्रति जोड़ चुंबक',
  'splitMagnet.help': 'हर चुंबक दो आमने-सामने खाँचे खोलता है, कट की हर सतह पर एक, Ø{width} × {depth} मिमी। स्वचालित: हर द्वीप में कम से कम एक और समा सकें तो हर जोड़ में दो, ताकि जोड़ घूमे नहीं। जहाँ 1.2 मिमी दीवार के साथ चुंबक नहीं समाता, वहाँ नहीं लगता और जोड़ यह बताता है।',
  'splitMagnet.polarity': 'हर जोड़ी के चुंबक विपरीत ध्रुव आमने-सामने रखकर चिपकाएँ; चिपकाने से पहले जोड़ी को परखें।',
  'splitMagnet.squareNote': 'अभी चुंबक वाले जोड़ केवल गोल चुंबक लेते हैं: चौकोर चुंबक से जोड़ चिपकाने के लिए रह जाता है। गोल चुंबक चुनें।',
  'engineWarning.SPLIT_MAGNET_NO_ROOM': 'जोड़ {label} ({a}–{b}) में Ø{diameter} × {height} मिमी का चुंबक चारों ओर और बाहर की ओर {wall} मिमी दीवार के साथ नहीं समाता: यह चिपकाने के लिए रह गया। छोटा चुंबक चुनें या कट को चौड़े हिस्से पर ले जाएँ।',
  'engineWarning.SPLIT_MAGNET_REDUCED': 'जोड़ {label} ({a}–{b}) में माँगे गए {requested} में से {count} चुंबक समाते हैं, हर एक अपनी न्यूनतम दीवार के साथ।',
  'engineWarning.SPLIT_MAGNET_SQUARE': 'जोड़ {label} ({a}–{b}) में चुंबक नहीं हैं: अभी चुंबक वाले जोड़ केवल गोल चुंबक लेते हैं।',
};

export const IMANES_UNION_ZH = {
  'split.joint.magnet': '磁铁（可拆卸）',
  'splitJoints.type.magnet': '磁铁',
  'splitMagnet.preset': '磁铁',
  'splitMagnet.clearance': '直径余量',
  'splitMagnet.depthClearance': '深度余量',
  'splitMagnet.countAuto': '自动数量',
  'splitMagnet.count': '每个接合的磁铁数',
  'splitMagnet.help': '每个磁铁在切面两侧各开一个相对的槽，尺寸 Ø{width} × {depth} 毫米。自动：每个岛至少一个，放得下时每个接合两个，防止转动。放不下带 1.2 毫米壁厚的磁铁时不放置，接合会提示。',
  'splitMagnet.polarity': '每对磁铁以相反磁极相对粘贴；粘贴前先试一下这一对。',
  'splitMagnet.squareNote': '目前磁铁接合只支持圆形磁铁：选方形磁铁时接合留作粘合。请选择圆形磁铁。',
  'engineWarning.SPLIT_MAGNET_NO_ROOM': '接合 {label}（{a}–{b}）放不下 Ø{diameter} × {height} 毫米的磁铁（四周及外侧需 {wall} 毫米壁厚）：留作粘合。请选更小的磁铁，或将切口移到更宽的位置。',
  'engineWarning.SPLIT_MAGNET_REDUCED': '接合 {label}（{a}–{b}）放得下所需 {requested} 个磁铁中的 {count} 个，每个都保留最小壁厚。',
  'engineWarning.SPLIT_MAGNET_SQUARE': '接合 {label}（{a}–{b}）没有磁铁：目前磁铁接合只支持圆形磁铁。',
};
