/**
 * @file src/i18n/locales/uxTexto.ts
 * @description Textos nuevos de la revisión de usabilidad: avisos de piezas agrupadas con su objeto, ayudas de
 * Dividir, resultado de validar el armado y avisos del análisis, en los 6 idiomas. Se mezclan en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export const UXTEXTO_ES = {
  'dialog.cut.sizeRecommended': 'Recomendado para esta sección (como el modo Automático de Dividir): se recalcula al mover el plano o cambiar el conector. Puedes editarlo.',
  'split.section.bedCuts': 'Cama y cortes',
  'split.section.joints': 'Uniones',
  'split.section.marks': 'Marcas',
  'split.section.marksHint': 'Rotula cada pieza con su código (A1, B2…) para armarlas.',
  'split.section.advanced': 'Avanzado',
  'split.section.advancedHint': 'Mueve a mano la posición de cada plano de corte.',
  'split.sum.marginHelp': 'Distancia que sobra entre la pieza que entra más justa y el borde de la cama. Si es menor que 2 mm la impresión puede no caber.',
  'splitJoints.result.region': 'Resultado de la validación del armado',
  'dialog.shortcuts.moveAll': 'Mover (manipulador e inspector); G y W hacen lo mismo',
  'dialog.shortcuts.undoRedoMax': 'Deshacer / Rehacer (hasta {max} pasos; se cambia en Ajustes)',
  'toast.printabilityHelp': 'Es una nota de 0 a 100: sobre 70 se imprime sin problemas. Abre el detalle para ver qué mejorar.',
  'toast.printabilityDetails': 'Ver detalles',
  'toast.pieceGrouped': 'Pieza agregada: {name}. Quedó agrupada con «{target}»: se mueven juntas.',
  'toast.pieceNegativeGrouped': 'Pieza negativa agregada y agrupada con «{target}». Muévela y ajusta su tamaño; luego pulsa «Aplicar restas».',
};

export const UXTEXTO_EN = {
  'dialog.cut.sizeRecommended': 'Recommended for this section (like the Automatic mode of Split): it is recalculated when you move the plane or change the connector. You can edit it.',
  'split.section.bedCuts': 'Bed and cuts',
  'split.section.joints': 'Joints',
  'split.section.marks': 'Marks',
  'split.section.marksHint': 'Labels each piece with its code (A1, B2…) to help you assemble them.',
  'split.section.advanced': 'Advanced',
  'split.section.advancedHint': 'Move each cutting plane by hand.',
  'split.sum.marginHelp': 'Space left between the tightest-fitting piece and the bed edge. Under 2 mm the print may not fit.',
  'splitJoints.result.region': 'Assembly validation result',
  'dialog.shortcuts.moveAll': 'Move (handle and inspector); G and W do the same',
  'dialog.shortcuts.undoRedoMax': 'Undo / Redo (up to {max} steps; change it in Settings)',
  'toast.printabilityHelp': 'A score from 0 to 100: above 70 prints without trouble. Open the details to see what to improve.',
  'toast.printabilityDetails': 'View details',
  'toast.pieceGrouped': 'Part added: {name}. It is grouped with "{target}", so they move together.',
  'toast.pieceNegativeGrouped': 'Negative part added and grouped with "{target}". Move and resize it, then click "Apply subtractions".',
};

export const UXTEXTO_DE = {
  'dialog.cut.sizeRecommended': 'Für diesen Querschnitt empfohlen (wie der Automatikmodus von Teilen): wird beim Verschieben der Ebene oder Ändern des Verbinders neu berechnet. Du kannst ihn ändern.',
  'split.section.bedCuts': 'Druckbett und Schnitte',
  'split.section.joints': 'Verbindungen',
  'split.section.marks': 'Markierungen',
  'split.section.marksHint': 'Beschriftet jedes Teil mit seinem Code (A1, B2 …) zum Zusammenbauen.',
  'split.section.advanced': 'Erweitert',
  'split.section.advancedHint': 'Jede Schnittebene von Hand verschieben.',
  'split.sum.marginHelp': 'Verbleibender Abstand zwischen dem am knappsten passenden Teil und dem Druckbettrand. Unter 2 mm passt der Druck eventuell nicht.',
  'splitJoints.result.region': 'Ergebnis der Montageprüfung',
  'dialog.shortcuts.moveAll': 'Verschieben (Gizmo und Inspektor); G und W tun dasselbe',
  'dialog.shortcuts.undoRedoMax': 'Rückgängig / Wiederholen (bis zu {max} Schritte; in den Einstellungen änderbar)',
  'toast.printabilityHelp': 'Eine Note von 0 bis 100: über 70 druckt ohne Probleme. Öffne die Details, um zu sehen, was sich verbessern lässt.',
  'toast.printabilityDetails': 'Details ansehen',
  'toast.pieceGrouped': 'Teil hinzugefügt: {name}. Es ist mit „{target}“ gruppiert und bewegt sich mit.',
  'toast.pieceNegativeGrouped': 'Negatives Teil hinzugefügt und mit „{target}“ gruppiert. Verschieben und anpassen, dann „Abzüge anwenden“ klicken.',
};

export const UXTEXTO_FR = {
  'dialog.cut.sizeRecommended': 'Recommandé pour cette section (comme le mode Automatique de Diviser) : recalculé quand tu déplaces le plan ou changes le connecteur. Tu peux le modifier.',
  'split.section.bedCuts': 'Plateau et coupes',
  'split.section.joints': 'Jonctions',
  'split.section.marks': 'Repères',
  'split.section.marksHint': 'Étiquette chaque pièce avec son code (A1, B2…) pour l’assemblage.',
  'split.section.advanced': 'Avancé',
  'split.section.advancedHint': 'Déplace à la main chaque plan de coupe.',
  'split.sum.marginHelp': 'Distance restante entre la pièce qui entre le plus juste et le bord du plateau. Sous 2 mm, l’impression peut ne pas tenir.',
  'splitJoints.result.region': 'Résultat de la validation de l’assemblage',
  'dialog.shortcuts.moveAll': 'Déplacer (gizmo et inspecteur) ; G et W font la même chose',
  'dialog.shortcuts.undoRedoMax': 'Annuler / Rétablir (jusqu’à {max} étapes ; modifiable dans les Réglages)',
  'toast.printabilityHelp': 'Une note de 0 à 100 : au-dessus de 70, l’impression se passe sans problème. Ouvre le détail pour voir quoi améliorer.',
  'toast.printabilityDetails': 'Voir les détails',
  'toast.pieceGrouped': 'Pièce ajoutée : {name}. Elle est groupée avec « {target} » : elles se déplacent ensemble.',
  'toast.pieceNegativeGrouped': 'Pièce négative ajoutée et groupée avec « {target} ». Déplace-la et ajuste sa taille, puis clique sur « Appliquer les soustractions ».',
};

export const UXTEXTO_HI = {
  'dialog.cut.sizeRecommended': 'इस सेक्शन के लिए अनुशंसित (Dividir के स्वचालित मोड जैसा): तल हिलाने या कनेक्टर बदलने पर दोबारा गणना होती है। आप इसे बदल सकते हैं।',
  'split.section.bedCuts': 'बेड और कट',
  'split.section.joints': 'जोड़',
  'split.section.marks': 'निशान',
  'split.section.marksHint': 'हर भाग पर उसका कोड (A1, B2…) लिखता है ताकि जोड़ना आसान हो।',
  'split.section.advanced': 'उन्नत',
  'split.section.advancedHint': 'हर कट-तल की स्थिति हाथ से बदलें।',
  'split.sum.marginHelp': 'सबसे कसकर बैठने वाले भाग और बेड के किनारे के बीच बचा फासला। 2 mm से कम हो तो प्रिंट शायद न समाए।',
  'splitJoints.result.region': 'असेंबली जाँच का परिणाम',
  'dialog.shortcuts.moveAll': 'खिसकाएँ (गिज़्मो और इंस्पेक्टर); G और W भी यही करते हैं',
  'dialog.shortcuts.undoRedoMax': 'पूर्ववत / फिर से करें ({max} चरणों तक; सेटिंग्स में बदलें)',
  'toast.printabilityHelp': '0 से 100 का स्कोर: 70 से ऊपर बिना दिक्कत प्रिंट होता है। क्या सुधारें, यह देखने के लिए विवरण खोलें।',
  'toast.printabilityDetails': 'विवरण देखें',
  'toast.pieceGrouped': 'भाग जोड़ा गया: {name}। यह «{target}» के साथ समूहित है, इसलिए दोनों साथ हिलते हैं।',
  'toast.pieceNegativeGrouped': 'ऋणात्मक भाग जोड़ा गया और «{target}» के साथ समूहित किया गया। उसे हिलाएँ और आकार बदलें, फिर "घटाव लागू करें" दबाएँ।',
};

export const UXTEXTO_ZH = {
  'dialog.cut.sizeRecommended': '为此截面推荐的值（与“分割”的自动模式一致）：移动平面或更换连接件时会重新计算，你也可以手动修改。',
  'split.section.bedCuts': '打印床与切割',
  'split.section.joints': '接合',
  'split.section.marks': '标记',
  'split.section.marksHint': '在每个部件上标注编码（A1、B2……），方便装配。',
  'split.section.advanced': '高级',
  'split.section.advancedHint': '手动移动每个切割平面。',
  'split.sum.marginHelp': '最贴合的部件与打印床边缘之间剩余的距离。小于 2 mm 时可能放不下。',
  'splitJoints.result.region': '装配验证结果',
  'dialog.shortcuts.moveAll': '移动（操纵杆与检查器）；G 和 W 作用相同',
  'dialog.shortcuts.undoRedoMax': '撤销 / 重做（最多 {max} 步；可在设置中修改）',
  'toast.printabilityHelp': '0 到 100 的评分：高于 70 可顺利打印。打开详情查看可改进之处。',
  'toast.printabilityDetails': '查看详情',
  'toast.pieceGrouped': '已添加部件:{name}。它已与“{target}”编组,会一起移动。',
  'toast.pieceNegativeGrouped': '已添加负形部件并与“{target}”编组。请移动并调整大小,然后点击“应用减法”。',
};
