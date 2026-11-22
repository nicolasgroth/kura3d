/**
 * @file src/i18n/locales/splitPrefs.ts
 * @description Textos de las preferencias de "Dividir para imprimir" (Ajustes → División y uniones), de
 * la casilla "Reforzar uniones débiles" y del botón "Reforzar" de la unión débil, en los 6 idiomas. Se
 * mezclan en cada diccionario de `translations.ts` y `locales/*.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export const SPLITPREFS_ES = {
  'settings.split.title': 'División y uniones',
  'settings.split.help': 'Valores con los que se abren «Dividir para imprimir» y el corte por plano. Cambiarlos dentro de esos diálogos no modifica estas preferencias.',
  'settings.split.connector': 'Conector por defecto',
  'settings.split.tolerance': 'Holgura por defecto (mm)',
  'settings.split.toleranceHelp': 'Juego entre el conector y su ranura. Más holgura ensambla más suelto; menos puede no encajar.',
  'settings.split.reinforce': 'Reforzar uniones débiles por defecto',
  'settings.split.reinforceHelp': 'Es el valor inicial de la casilla «Reforzar uniones débiles» de Dividir para imprimir. Viene apagada.',
  'split.reinforce': 'Reforzar uniones débiles',
  'split.reinforceTip': 'Agranda o agrega conectores cuando la unión queda débil; cambia el radio que pediste',
  'split.reinforceHelp': 'Agranda o agrega conectores cuando la unión queda débil para su tamaño; cambia el radio que pediste. Apagada, solo se avisa de la unión débil y tú decides.',
  'splitJoints.reinforce': 'Reforzar y dividir de nuevo',
  'splitJoints.reinforceTip': 'Deshace la división y la repite con los mismos parámetros y el refuerzo de uniones activo',
  'splitJoints.reinforceHow': 'Para reforzarla: deshaz la división, activa «Reforzar uniones débiles» en Dividir para imprimir y divide de nuevo.',
  'splitJoints.note.weak': 'Unión débil: el conector tiene radio {measured} mm y se recomienda {recommended} mm. Cuídala al imprimir (más perímetros y buena adhesión entre capas) y al armar (pegamento y sin forzar). También puedes dividir de nuevo con «Reforzar uniones débiles» activo.',
  'engineWarning.SPLIT_CONNECTOR_REINFORCED': 'Unión {label} ({a}–{b}): se aumentó el conector. Pedido: radio {requested} mm ×{requestedCount} → aplicado: radio {size} mm ×{count}.',
  'splitJoints.note.weakLimit': 'Unión aún débil tras reforzar: el conector tiene radio {measured} mm y se recomienda {recommended} mm. No cabe uno mayor sin dejar la pared bajo el mínimo (o se llegó al tope de refuerzo). Puedes pedir un conector mayor o más conectores, o dejar esta unión para pegar. Cuídala al imprimir y al armar (pegamento, sin forzar).',
};

export const SPLITPREFS_EN = {
  'settings.split.title': 'Split and joints',
  'settings.split.help': 'Values that "Split to print" and the plane cut open with. Changing them inside those dialogs does not change these preferences.',
  'settings.split.connector': 'Default connector',
  'settings.split.tolerance': 'Default clearance (mm)',
  'settings.split.toleranceHelp': 'Play between the connector and its slot. More clearance assembles looser; less may not fit.',
  'settings.split.reinforce': 'Reinforce weak joints by default',
  'settings.split.reinforceHelp': 'Initial value of the "Reinforce weak joints" checkbox in Split to print. It starts off.',
  'split.reinforce': 'Reinforce weak joints',
  'split.reinforceTip': 'Enlarges or adds connectors when a joint is weak; it changes the radius you asked for',
  'split.reinforceHelp': 'Enlarges or adds connectors when a joint is weak for its size; it changes the radius you asked for. When off, weak joints are only reported and you decide.',
  'splitJoints.reinforce': 'Reinforce and split again',
  'splitJoints.reinforceTip': 'Undoes the split and repeats it with the same parameters and joint reinforcement on',
  'splitJoints.reinforceHow': 'To reinforce it: undo the split, turn on "Reinforce weak joints" in Split to print and split again.',
  'splitJoints.note.weak': 'Weak joint: the connector radius is {measured} mm and {recommended} mm is recommended. Take care when printing (more perimeters, good layer adhesion) and when assembling (glue, no forcing). You can also split again with "Reinforce weak joints" on.',
  'engineWarning.SPLIT_CONNECTOR_REINFORCED': 'Joint {label} ({a}–{b}): the connector was enlarged. Requested: radius {requested} mm ×{requestedCount} → applied: radius {size} mm ×{count}.',
  'splitJoints.note.weakLimit': 'Joint still weak after reinforcing: the connector radius is {measured} mm and {recommended} mm is recommended. A larger one does not fit without leaving the wall under the minimum (or the reinforcement limit was reached). You can ask for a larger connector or more connectors, or leave this joint to glue. Take care when printing and assembling (glue, no forcing).',
};

export const SPLITPREFS_DE = {
  'settings.split.title': 'Teilen und Verbindungen',
  'settings.split.help': 'Werte, mit denen „Zum Drucken teilen“ und der Ebenenschnitt starten. Änderungen in diesen Dialogen ändern diese Einstellungen nicht.',
  'settings.split.connector': 'Standard-Verbinder',
  'settings.split.tolerance': 'Standard-Spiel (mm)',
  'settings.split.toleranceHelp': 'Spiel zwischen Verbinder und Nut. Mehr Spiel sitzt lockerer; weniger passt eventuell nicht.',
  'settings.split.reinforce': 'Schwache Verbindungen standardmäßig verstärken',
  'settings.split.reinforceHelp': 'Startwert des Kontrollkästchens „Schwache Verbindungen verstärken“ in „Zum Drucken teilen“. Standardmäßig aus.',
  'split.reinforce': 'Schwache Verbindungen verstärken',
  'split.reinforceTip': 'Vergrößert oder ergänzt Verbinder bei schwachen Verbindungen; der gewünschte Radius ändert sich',
  'split.reinforceHelp': 'Vergrößert oder ergänzt Verbinder, wenn eine Verbindung für ihre Größe schwach ist; der gewünschte Radius ändert sich. Ausgeschaltet wird nur gewarnt und du entscheidest.',
  'splitJoints.reinforce': 'Verstärken und neu teilen',
  'splitJoints.reinforceTip': 'Macht die Teilung rückgängig und wiederholt sie mit denselben Parametern und aktiver Verstärkung',
  'splitJoints.reinforceHow': 'Zum Verstärken: Teilung rückgängig machen, in „Zum Drucken teilen“ „Schwache Verbindungen verstärken“ einschalten und neu teilen.',
  'splitJoints.note.weak': 'Schwache Verbindung: Der Verbinderradius beträgt {measured} mm, empfohlen sind {recommended} mm. Achte beim Drucken (mehr Wände, gute Schichthaftung) und beim Zusammenbau (Kleber, nicht erzwingen) darauf. Du kannst auch mit „Schwache Verbindungen verstärken“ neu teilen.',
  'engineWarning.SPLIT_CONNECTOR_REINFORCED': 'Verbindung {label} ({a}–{b}): Der Verbinder wurde vergrößert. Gewünscht: Radius {requested} mm ×{requestedCount} → angewendet: Radius {size} mm ×{count}.',
  'splitJoints.note.weakLimit': 'Verbindung nach der Verstärkung noch schwach: Der Verbinderradius beträgt {measured} mm, empfohlen sind {recommended} mm. Ein größerer passt nicht, ohne die Wand unter das Minimum zu bringen (oder die Verstärkungsgrenze ist erreicht). Du kannst einen größeren Verbinder oder mehr Verbinder wählen oder diese Verbindung zum Kleben lassen. Achte beim Drucken und Zusammenbau darauf (Kleber, nicht erzwingen).',
};

export const SPLITPREFS_FR = {
  'settings.split.title': 'Découpe et jonctions',
  'settings.split.help': 'Valeurs avec lesquelles s’ouvrent « Découper pour imprimer » et la coupe par plan. Les modifier dans ces dialogues ne change pas ces préférences.',
  'settings.split.connector': 'Connecteur par défaut',
  'settings.split.tolerance': 'Jeu par défaut (mm)',
  'settings.split.toleranceHelp': 'Jeu entre le connecteur et sa rainure. Plus de jeu assemble plus lâche ; moins peut ne pas rentrer.',
  'settings.split.reinforce': 'Renforcer les jonctions fragiles par défaut',
  'settings.split.reinforceHelp': 'Valeur initiale de la case « Renforcer les jonctions fragiles » de Découper pour imprimer. Elle est décochée au départ.',
  'split.reinforce': 'Renforcer les jonctions fragiles',
  'split.reinforceTip': 'Agrandit ou ajoute des connecteurs quand une jonction est fragile ; le rayon demandé change',
  'split.reinforceHelp': 'Agrandit ou ajoute des connecteurs quand une jonction est fragile pour sa taille ; le rayon demandé change. Décochée, on signale seulement la jonction fragile et tu décides.',
  'splitJoints.reinforce': 'Renforcer et redécouper',
  'splitJoints.reinforceTip': 'Annule la découpe et la refait avec les mêmes paramètres et le renforcement actif',
  'splitJoints.reinforceHow': 'Pour la renforcer : annule la découpe, active « Renforcer les jonctions fragiles » dans Découper pour imprimer et redécoupe.',
  'splitJoints.note.weak': 'Jonction fragile : le rayon du connecteur est de {measured} mm et {recommended} mm sont recommandés. Fais attention à l’impression (plus de périmètres, bonne adhérence des couches) et à l’assemblage (colle, sans forcer). Tu peux aussi redécouper avec « Renforcer les jonctions fragiles » activé.',
  'engineWarning.SPLIT_CONNECTOR_REINFORCED': 'Jonction {label} ({a}–{b}) : le connecteur a été agrandi. Demandé : rayon {requested} mm ×{requestedCount} → appliqué : rayon {size} mm ×{count}.',
  'splitJoints.note.weakLimit': 'Jonction encore fragile après renforcement : le rayon du connecteur est de {measured} mm et {recommended} mm sont recommandés. Un connecteur plus grand ne tient pas sans laisser la paroi sous le minimum (ou la limite de renforcement est atteinte). Tu peux demander un connecteur plus grand ou plus de connecteurs, ou laisser cette jonction à coller. Fais attention à l’impression et à l’assemblage (colle, sans forcer).',
};

export const SPLITPREFS_HI = {
  'settings.split.title': 'विभाजन और जोड़',
  'settings.split.help': 'इन मानों से «प्रिंट के लिए विभाजित करें» और तल से कटाई खुलती हैं। उन संवादों में बदलने से ये पसंद नहीं बदलतीं।',
  'settings.split.connector': 'डिफ़ॉल्ट कनेक्टर',
  'settings.split.tolerance': 'डिफ़ॉल्ट ढील (मिमी)',
  'settings.split.toleranceHelp': 'कनेक्टर और उसकी खाँचे के बीच खेल। ज़्यादा ढील से जोड़ ढीला बैठता है; कम हो तो फिट न हो।',
  'settings.split.reinforce': 'कमज़ोर जोड़ों को डिफ़ॉल्ट रूप से मज़बूत करें',
  'settings.split.reinforceHelp': 'प्रिंट के लिए विभाजित करें में «कमज़ोर जोड़ मज़बूत करें» बॉक्स का आरंभिक मान। यह बंद रहता है।',
  'split.reinforce': 'कमज़ोर जोड़ मज़बूत करें',
  'split.reinforceTip': 'जोड़ कमज़ोर होने पर कनेक्टर बड़ा करता या जोड़ता है; आपकी माँगी त्रिज्या बदल जाती है',
  'split.reinforceHelp': 'जोड़ अपने आकार के लिए कमज़ोर हो तो कनेक्टर बड़ा करता या जोड़ता है; आपकी माँगी त्रिज्या बदल जाती है। बंद होने पर केवल चेतावनी मिलती है और निर्णय आपका रहता है।',
  'splitJoints.reinforce': 'मज़बूत करें और फिर विभाजित करें',
  'splitJoints.reinforceTip': 'विभाजन पूर्ववत करता है और वही पैरामीटर तथा सक्रिय सुदृढ़ीकरण के साथ दोहराता है',
  'splitJoints.reinforceHow': 'मज़बूत करने के लिए: विभाजन पूर्ववत करें, प्रिंट के लिए विभाजित करें में «कमज़ोर जोड़ मज़बूत करें» चालू करें और फिर विभाजित करें।',
  'splitJoints.note.weak': 'कमज़ोर जोड़: कनेक्टर की त्रिज्या {measured} मिमी है और {recommended} मिमी अनुशंसित है। प्रिंट करते समय (अधिक परिधि, परतों की अच्छी चिपकन) और जोड़ते समय (गोंद, ज़ोर न लगाएँ) ध्यान रखें। «कमज़ोर जोड़ मज़बूत करें» चालू करके दोबारा विभाजित भी कर सकते हैं।',
  'engineWarning.SPLIT_CONNECTOR_REINFORCED': 'जोड़ {label} ({a}–{b}): कनेक्टर बड़ा किया गया। माँगा: त्रिज्या {requested} मिमी ×{requestedCount} → लागू: त्रिज्या {size} मिमी ×{count}।',
  'splitJoints.note.weakLimit': 'मज़बूत करने के बाद भी जोड़ कमज़ोर है: कनेक्टर की त्रिज्या {measured} मिमी है और {recommended} मिमी अनुशंसित है। दीवार को न्यूनतम से नीचे छोड़े बिना बड़ा कनेक्टर नहीं आता (या मज़बूती की सीमा आ गई)। आप बड़ा कनेक्टर या ज़्यादा कनेक्टर माँग सकते हैं, या इस जोड़ को गोंद के लिए छोड़ सकते हैं। प्रिंट और जोड़ते समय ध्यान रखें (गोंद, ज़ोर न लगाएँ)।',
};

export const SPLITPREFS_ZH = {
  'settings.split.title': '分割与接合',
  'settings.split.help': '“分割以便打印”和平面切割打开时使用的值。在这些对话框中修改不会改变这里的偏好。',
  'settings.split.connector': '默认连接件',
  'settings.split.tolerance': '默认间隙（毫米）',
  'settings.split.toleranceHelp': '连接件与槽之间的配合间隙。间隙大则装配较松；间隙小可能装不进去。',
  'settings.split.reinforce': '默认加固较弱接合',
  'settings.split.reinforceHelp': '“分割以便打印”中“加固较弱接合”复选框的初始值。默认关闭。',
  'split.reinforce': '加固较弱接合',
  'split.reinforceTip': '接合较弱时放大或增加连接件；会改变你设定的半径',
  'split.reinforceHelp': '当接合相对其尺寸偏弱时，放大或增加连接件；会改变你设定的半径。关闭时只提示较弱接合，由你决定。',
  'splitJoints.reinforce': '加固并重新分割',
  'splitJoints.reinforceTip': '撤销分割，并用相同参数和已开启的加固重新分割',
  'splitJoints.reinforceHow': '要加固它：撤销分割，在“分割以便打印”中开启“加固较弱接合”，然后重新分割。',
  'splitJoints.note.weak': '接合较弱：连接件半径为 {measured} 毫米，建议 {recommended} 毫米。打印时（增加外壳层数、保证层间附着）和装配时（用胶水、不要硬塞）请多加留意。也可以开启“加固较弱接合”后重新分割。',
  'engineWarning.SPLIT_CONNECTOR_REINFORCED': '接合 {label}（{a}–{b}）：连接件已加大。请求：半径 {requested} 毫米 ×{requestedCount} → 实际：半径 {size} 毫米 ×{count}。',
  'splitJoints.note.weakLimit': '加固后接合仍较弱：连接件半径为 {measured} 毫米，建议 {recommended} 毫米。更大的连接件会使壁厚低于最小值（或已达到加固上限）。可以请求更大的连接件或更多连接件，或将此接合留作粘接。打印和装配时请多加留意（用胶水、不要硬塞）。',
};
