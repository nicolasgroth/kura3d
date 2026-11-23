/**
 * @file src/i18n/locales/rediseno.ts
 * @description Textos del rediseño clásico de la interfaz (lote 1) en los 6 idiomas: barra vertical de
 * herramientas, barra de vista única, menú Acciones (grupos, ítems y motivos de deshabilitado), historial de
 * deshacer, rótulos conmutables y la línea de ayuda de la barra de estado. Cada clave se escribe una vez con
 * sus 6 idiomas; `REDISENO_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const REDISENO = {
  // Barra vertical de herramientas
  'rediseno.tool.move': { es: 'Mover', en: 'Move', de: 'Verschieben', fr: 'Déplacer', hi: 'खिसकाएँ', zh: '移动' },
  'rediseno.tool.rotate': { es: 'Rotar', en: 'Rotate', de: 'Drehen', fr: 'Pivoter', hi: 'घुमाएँ', zh: '旋转' },
  'rediseno.tool.scale': { es: 'Escalar', en: 'Scale', de: 'Skalieren', fr: 'Mettre à l’échelle', hi: 'आकार बदलें', zh: '缩放' },
  'rediseno.help.select': { es: 'Elige objetos con clic; el manipulador mueve, rota o escala.', en: 'Click to pick objects; the manipulator moves, rotates or scales.', de: 'Objekte per Klick wählen; der Manipulator verschiebt, dreht oder skaliert.', fr: 'Clique pour choisir des objets ; le manipulateur déplace, pivote ou met à l’échelle.', hi: 'क्लिक से ऑब्जेक्ट चुनें; मैनिपुलेटर खिसकाता, घुमाता या आकार बदलता है।', zh: '单击选择对象;操纵器可移动、旋转或缩放。' },
  'rediseno.help.move': { es: 'El manipulador desplaza la selección por los ejes.', en: 'The manipulator moves the selection along the axes.', de: 'Der Manipulator verschiebt die Auswahl entlang der Achsen.', fr: 'Le manipulateur déplace la sélection le long des axes.', hi: 'मैनिपुलेटर चयन को अक्षों पर खिसकाता है।', zh: '操纵器沿坐标轴移动所选对象。' },
  'rediseno.help.rotate': { es: 'El manipulador gira la selección; Ctrl ajusta a 15°.', en: 'The manipulator turns the selection; Ctrl snaps to 15°.', de: 'Der Manipulator dreht die Auswahl; Strg rastet auf 15° ein.', fr: 'Le manipulateur fait pivoter la sélection ; Ctrl aimante à 15°.', hi: 'मैनिपुलेटर चयन को घुमाता है; Ctrl 15° पर रोकता है।', zh: '操纵器旋转所选对象;按 Ctrl 以 15° 对齐。' },
  'rediseno.help.scale': { es: 'El manipulador cambia el tamaño; Shift mantiene la proporción.', en: 'The manipulator resizes; Shift keeps the proportions.', de: 'Der Manipulator ändert die Größe; Umschalt behält die Proportionen.', fr: 'Le manipulateur redimensionne ; Maj garde les proportions.', hi: 'मैनिपुलेटर आकार बदलता है; Shift अनुपात बनाए रखता है।', zh: '操纵器调整大小;按 Shift 保持比例。' },
  'rediseno.help.paint': { es: 'Pinta caras con colores de filamento para imprimir en varios colores.', en: 'Paint faces with filament colors for multicolor printing.', de: 'Flächen mit Filamentfarben für den Mehrfarbdruck bemalen.', fr: 'Peins les faces aux couleurs du filament pour imprimer en plusieurs couleurs.', hi: 'बहुरंगी प्रिंट के लिए फ़िलामेंट रंगों से फलक रंगें।', zh: '用耗材颜色为面上色,用于多色打印。' },
  'rediseno.help.cut': { es: 'Corta el objeto con un plano y agrega uniones para armarlo.', en: 'Cut the object with a plane and add connectors to assemble it.', de: 'Das Objekt mit einer Ebene schneiden und Verbinder zum Zusammenbau hinzufügen.', fr: 'Coupe l’objet par un plan et ajoute des connecteurs pour l’assembler.', hi: 'ऑब्जेक्ट को समतल से काटें और जोड़ने के लिए कनेक्टर जोड़ें।', zh: '用平面切割对象并添加连接件以便组装。' },
  'rediseno.help.erase': { es: 'Quita volumen esférico de la malla donde haces clic.', en: 'Removes a spherical volume from the mesh where you click.', de: 'Entfernt ein kugelförmiges Volumen dort, wo du klickst.', fr: 'Retire un volume sphérique du maillage là où tu cliques.', hi: 'जहाँ क्लिक करें वहाँ से गोलाकार आयतन हटाता है।', zh: '在单击处从网格中去除球形体积。' },
  'rediseno.help.measure': { es: 'Mide distancias, ángulos y radios sobre la pieza.', en: 'Measure distances, angles and radii on the part.', de: 'Abstände, Winkel und Radien am Teil messen.', fr: 'Mesure distances, angles et rayons sur la pièce.', hi: 'भाग पर दूरी, कोण और त्रिज्या मापें।', zh: '在零件上测量距离、角度和半径。' },

  // Barra de vista
  'rediseno.view.bar': { es: 'Vista', en: 'View', de: 'Ansicht', fr: 'Vue', hi: 'दृश्य', zh: '视图' },
  'rediseno.view.iso': { es: 'Iso', en: 'Iso', de: 'Iso', fr: 'Iso', hi: 'आइसो', zh: '等轴' },
  'rediseno.view.top': { es: 'Superior', en: 'Top', de: 'Oben', fr: 'Dessus', hi: 'ऊपर', zh: '顶视' },
  'rediseno.view.front': { es: 'Frente', en: 'Front', de: 'Vorne', fr: 'Face', hi: 'सामने', zh: '前视' },
  'rediseno.view.right': { es: 'Derecha', en: 'Right', de: 'Rechts', fr: 'Droite', hi: 'दाएँ', zh: '右视' },
  'rediseno.view.views': { es: 'Vistas', en: 'Views', de: 'Ansichten', fr: 'Vues', hi: 'दृश्य', zh: '视角' },
  'rediseno.view.fit': { es: 'Encuadrar', en: 'Frame', de: 'Einpassen', fr: 'Cadrer', hi: 'फ़िट करें', zh: '适配视图' },
  'rediseno.view.xray': { es: 'Rayos X', en: 'X-ray', de: 'Röntgen', fr: 'Rayons X', hi: 'एक्स-रे', zh: 'X 光' },
  'rediseno.view.snap': { es: 'Rejilla', en: 'Grid', de: 'Raster', fr: 'Grille', hi: 'ग्रिड', zh: '网格' },
  'rediseno.help.viewIso': { es: 'Cámara en diagonal, para ver la pieza completa.', en: 'Diagonal camera to see the whole part.', de: 'Diagonale Kamera, um das ganze Teil zu sehen.', fr: 'Caméra en diagonale pour voir toute la pièce.', hi: 'पूरा भाग देखने के लिए तिरछा कैमरा।', zh: '斜向相机,查看整个零件。' },
  'rediseno.help.viewTop': { es: 'Mira la cama desde arriba.', en: 'Look at the bed from above.', de: 'Das Bett von oben betrachten.', fr: 'Regarde le plateau d’en haut.', hi: 'बेड को ऊपर से देखें।', zh: '从上方查看打印床。' },
  'rediseno.help.viewFront': { es: 'Mira la pieza de frente.', en: 'Look at the part from the front.', de: 'Das Teil von vorne betrachten.', fr: 'Regarde la pièce de face.', hi: 'भाग को सामने से देखें।', zh: '从正面查看零件。' },
  'rediseno.help.viewRight': { es: 'Mira la pieza desde la derecha.', en: 'Look at the part from the right.', de: 'Das Teil von rechts betrachten.', fr: 'Regarde la pièce depuis la droite.', hi: 'भाग को दाईं ओर से देखें।', zh: '从右侧查看零件。' },
  'rediseno.help.views': { es: 'Elige una vista de cámara.', en: 'Choose a camera view.', de: 'Eine Kameraansicht wählen.', fr: 'Choisis une vue de caméra.', hi: 'कैमरा दृश्य चुनें।', zh: '选择相机视角。' },
  'rediseno.help.fit': { es: 'Acerca la cámara para que la selección o la escena quepan.', en: 'Zooms so the selection or scene fits.', de: 'Zoomt, bis Auswahl oder Szene hineinpasst.', fr: 'Zoome pour que la sélection ou la scène tienne.', hi: 'ज़ूम करता है ताकि चयन या दृश्य समा जाए।', zh: '缩放视图以容纳所选对象或整个场景。' },
  'rediseno.help.bed': { es: 'Oculta la cama y deja mirar la pieza por debajo.', en: 'Hides the bed so you can look at the part from below.', de: 'Blendet das Bett aus, um das Teil von unten zu sehen.', fr: 'Masque le plateau pour voir la pièce par en dessous.', hi: 'बेड छिपाता है ताकि भाग को नीचे से देख सकें।', zh: '隐藏打印床,以便从下方查看零件。' },
  'rediseno.help.xray': { es: 'Corta la vista a una altura para revisar paredes e interior.', en: 'Clips the view at a height to inspect walls and inside.', de: 'Schneidet die Ansicht in einer Höhe, um Wände und Inneres zu prüfen.', fr: 'Coupe la vue à une hauteur pour inspecter parois et intérieur.', hi: 'दीवारें और अंदर देखने के लिए दृश्य को किसी ऊँचाई पर काटता है।', zh: '在某一高度剖切视图,检查壁厚和内部。' },
  'rediseno.help.snap': { es: 'Paso con que se mueven los objetos al arrastrar o con las flechas.', en: 'Step objects move by when dragging or with the arrow keys.', de: 'Schrittweite beim Ziehen oder mit den Pfeiltasten.', fr: 'Pas de déplacement en glissant ou avec les flèches.', hi: 'खींचने या तीर कुंजियों से खिसकाने का कदम।', zh: '拖动或使用方向键时的移动步长。' },

  // Barra superior
  'rediseno.top.file': { es: 'Archivo', en: 'File', de: 'Datei', fr: 'Fichier', hi: 'फ़ाइल', zh: '文件' },
  'rediseno.top.edit': { es: 'Edición', en: 'Edit', de: 'Bearbeiten', fr: 'Édition', hi: 'संपादन', zh: '编辑' },
  'rediseno.top.mcp': { es: 'Puente MCP', en: 'MCP bridge', de: 'MCP-Brücke', fr: 'Pont MCP', hi: 'MCP ब्रिज', zh: 'MCP 桥接' },
  'rediseno.top.app': { es: 'Aplicación', en: 'Application', de: 'Anwendung', fr: 'Application', hi: 'ऐप्लिकेशन', zh: '应用' },
  'rediseno.help.import': { es: 'Trae un modelo STL, 3MF, OBJ o PLY, un SVG o una imagen.', en: 'Bring in an STL, 3MF, OBJ or PLY model, an SVG or an image.', de: 'Ein STL-, 3MF-, OBJ- oder PLY-Modell, SVG oder Bild laden.', fr: 'Importe un modèle STL, 3MF, OBJ ou PLY, un SVG ou une image.', hi: 'STL, 3MF, OBJ या PLY मॉडल, SVG या छवि लाएँ।', zh: '导入 STL、3MF、OBJ 或 PLY 模型、SVG 或图片。' },
  'rediseno.help.project': { es: 'Nuevo, abrir y guardar el proyecto .kura.', en: 'New, open and save the .kura project.', de: '.kura-Projekt neu, öffnen und speichern.', fr: 'Nouveau, ouvrir et enregistrer le projet .kura.', hi: '.kura प्रोजेक्ट नया, खोलें और सहेजें।', zh: '新建、打开和保存 .kura 项目。' },
  'rediseno.help.export': { es: 'Guarda las piezas en STL, 3MF, OBJ, GLB o PLY para el laminador.', en: 'Save the parts as STL, 3MF, OBJ, GLB or PLY for the slicer.', de: 'Teile als STL, 3MF, OBJ, GLB oder PLY für den Slicer speichern.', fr: 'Enregistre les pièces en STL, 3MF, OBJ, GLB ou PLY pour le trancheur.', hi: 'स्लाइसर के लिए भागों को STL, 3MF, OBJ, GLB या PLY में सहेजें।', zh: '将零件保存为 STL、3MF、OBJ、GLB 或 PLY,供切片软件使用。' },
  'rediseno.help.undo': { es: 'Deshace la última acción.', en: 'Undoes the last action.', de: 'Macht die letzte Aktion rückgängig.', fr: 'Annule la dernière action.', hi: 'पिछली क्रिया पूर्ववत करता है।', zh: '撤销上一步操作。' },
  'rediseno.help.redo': { es: 'Vuelve a hacer lo deshecho.', en: 'Redoes what was undone.', de: 'Stellt Rückgängiggemachtes wieder her.', fr: 'Rétablit ce qui a été annulé.', hi: 'पूर्ववत किया गया फिर से करता है।', zh: '重做已撤销的操作。' },
  'rediseno.help.palette': { es: 'Busca cualquier comando por su nombre.', en: 'Search any command by name.', de: 'Jeden Befehl nach Namen suchen.', fr: 'Cherche n’importe quelle commande par son nom.', hi: 'किसी भी कमांड को नाम से खोजें।', zh: '按名称搜索任意命令。' },
  'rediseno.help.language': { es: 'Idioma de la interfaz.', en: 'Interface language.', de: 'Sprache der Oberfläche.', fr: 'Langue de l’interface.', hi: 'इंटरफ़ेस की भाषा।', zh: '界面语言。' },
  'rediseno.help.theme': { es: 'Cambia entre tema claro y oscuro.', en: 'Switches between light and dark theme.', de: 'Wechselt zwischen hellem und dunklem Design.', fr: 'Bascule entre thème clair et sombre.', hi: 'हल्की और गहरी थीम के बीच बदलें।', zh: '在浅色和深色主题之间切换。' },
  'rediseno.help.themes': { es: 'Temas de color y apariencia en Ajustes.', en: 'Color themes and appearance in Settings.', de: 'Farbdesigns und Darstellung in den Einstellungen.', fr: 'Thèmes de couleur et apparence dans Réglages.', hi: 'सेटिंग्स में रंग थीम और रूप।', zh: '在设置中选择配色主题和外观。' },
  'rediseno.help.mcp': { es: 'Estado del puente MCP local; clic para configurarlo.', en: 'Local MCP bridge status; click to configure it.', de: 'Status der lokalen MCP-Brücke; Klick zum Einrichten.', fr: 'État du pont MCP local ; clique pour le configurer.', hi: 'स्थानीय MCP ब्रिज की स्थिति; सेट करने के लिए क्लिक करें।', zh: '本地 MCP 桥接状态;单击进行配置。' },
  'rediseno.help.ai': { es: 'Abre o cierra el asistente opcional.', en: 'Opens or closes the optional assistant.', de: 'Öffnet oder schließt den optionalen Assistenten.', fr: 'Ouvre ou ferme l’assistant facultatif.', hi: 'वैकल्पिक सहायक खोलें या बंद करें।', zh: '打开或关闭可选助手。' },
  'rediseno.help.settings': { es: 'Preferencias: apariencia, cama, unidades, MCP e IA.', en: 'Preferences: appearance, bed, units, MCP and AI.', de: 'Einstellungen: Darstellung, Bett, Einheiten, MCP und KI.', fr: 'Préférences : apparence, plateau, unités, MCP et IA.', hi: 'प्राथमिकताएँ: रूप, बेड, इकाइयाँ, MCP और AI।', zh: '偏好设置:外观、打印床、单位、MCP 和 AI。' },

  // Rótulos conmutables (une la densidad Expandido / Compacto en un solo control)
  'rediseno.labels.show': { es: 'Mostrar rótulos', en: 'Show labels', de: 'Beschriftungen zeigen', fr: 'Afficher les libellés', hi: 'लेबल दिखाएँ', zh: '显示标签' },
  'rediseno.labels.hide': { es: 'Ocultar rótulos', en: 'Hide labels', de: 'Beschriftungen ausblenden', fr: 'Masquer les libellés', hi: 'लेबल छिपाएँ', zh: '隐藏标签' },
  'rediseno.labels.toggle': { es: 'Rótulos', en: 'Labels', de: 'Beschriftungen', fr: 'Libellés', hi: 'लेबल', zh: '标签' },
  'rediseno.labels.palette': { es: 'Mostrar u ocultar rótulos (solo iconos)', en: 'Show or hide labels (icons only)', de: 'Beschriftungen zeigen oder ausblenden (nur Symbole)', fr: 'Afficher ou masquer les libellés (icônes seules)', hi: 'लेबल दिखाएँ या छिपाएँ (केवल आइकन)', zh: '显示或隐藏标签(仅图标)' },
  'rediseno.help.labels': { es: 'Alterna entre iconos con texto e iconos solos en todas las barras.', en: 'Switches every bar between icons with text and icons only.', de: 'Schaltet alle Leisten zwischen Symbolen mit Text und nur Symbolen um.', fr: 'Bascule toutes les barres entre icônes avec texte et icônes seules.', hi: 'सभी पट्टियों में टेक्स्ट सहित आइकन और केवल आइकन के बीच बदलें।', zh: '在所有工具栏中切换“图标加文字”与“仅图标”。' },
  'rediseno.zen': { es: 'Modo sin distracciones', en: 'Distraction-free mode', de: 'Ablenkungsfreier Modus', fr: 'Mode sans distraction', hi: 'बिना व्याकुलता मोड', zh: '专注模式' },
  'rediseno.help.zen': { es: 'Oculta barras y paneles para ver solo el visor (Esc vuelve).', en: 'Hides bars and panels to show only the viewport (Esc returns).', de: 'Blendet Leisten und Bereiche aus, nur der Viewport bleibt (Esc zurück).', fr: 'Masque barres et panneaux pour ne garder que la vue (Échap revient).', hi: 'केवल व्यूपोर्ट दिखाने के लिए पट्टियाँ और पैनल छिपाता है (Esc से वापस)।', zh: '隐藏工具栏和面板,只显示视口(按 Esc 返回)。' },

  // Menú Acciones
  'rediseno.actions.menu': { es: 'Acciones', en: 'Actions', de: 'Aktionen', fr: 'Actions', hi: 'क्रियाएँ', zh: '操作' },
  'rediseno.help.actions': { es: 'Operaciones sobre la selección: ahuecar, dividir, reparar, separar, alinear…', en: 'Operations on the selection: hollow, split, repair, separate, align…', de: 'Operationen auf der Auswahl: aushöhlen, teilen, reparieren, trennen, ausrichten…', fr: 'Opérations sur la sélection : évider, diviser, réparer, séparer, aligner…', hi: 'चयन पर क्रियाएँ: खोखला, विभाजन, मरम्मत, अलग, संरेखित…', zh: '对所选对象的操作:抽壳、分割、修复、分离、对齐……' },
  'rediseno.actions.group.prepare': { es: 'Preparar para imprimir', en: 'Prepare for printing', de: 'Für den Druck vorbereiten', fr: 'Préparer l’impression', hi: 'प्रिंट की तैयारी', zh: '打印准备' },
  'rediseno.actions.group.mesh': { es: 'Malla', en: 'Mesh', de: 'Netz', fr: 'Maillage', hi: 'मेश', zh: '网格' },
  'rediseno.actions.group.organize': { es: 'Separar y combinar', en: 'Separate and combine', de: 'Trennen und kombinieren', fr: 'Séparer et combiner', hi: 'अलग करें और मिलाएँ', zh: '分离与合并' },
  'rediseno.actions.group.position': { es: 'Posición y tipo', en: 'Position and type', de: 'Position und Typ', fr: 'Position et type', hi: 'स्थिति और प्रकार', zh: '位置与类型' },
  'rediseno.actions.group.analyze': { es: 'Analizar', en: 'Analyze', de: 'Analysieren', fr: 'Analyser', hi: 'विश्लेषण', zh: '分析' },
  'rediseno.action.hollow': { es: 'Ahuecar…', en: 'Hollow out…', de: 'Aushöhlen…', fr: 'Évider…', hi: 'खोखला करें…', zh: '抽壳…' },
  'rediseno.action.splitForBed': { es: 'Dividir para imprimir…', en: 'Split for printing…', de: 'Zum Drucken teilen…', fr: 'Diviser pour imprimer…', hi: 'प्रिंट के लिए विभाजित करें…', zh: '分割以便打印…' },
  'rediseno.action.fitToBed': { es: 'Ajustar a la impresora…', en: 'Fit to printer…', de: 'An den Drucker anpassen…', fr: 'Ajuster à l’imprimante…', hi: 'प्रिंटर में फ़िट करें…', zh: '适配打印机…' },
  'rediseno.action.mold': { es: 'Generar molde…', en: 'Generate mold…', de: 'Form erzeugen…', fr: 'Générer un moule…', hi: 'साँचा बनाएँ…', zh: '生成模具…' },
  'rediseno.action.project': { es: 'Proyectar texto o SVG en la superficie…', en: 'Project text or SVG onto the surface…', de: 'Text oder SVG auf die Oberfläche projizieren…', fr: 'Projeter un texte ou SVG sur la surface…', hi: 'सतह पर टेक्स्ट या SVG प्रोजेक्ट करें…', zh: '将文字或 SVG 投影到表面…' },
  'rediseno.action.repair': { es: 'Reparar malla', en: 'Repair mesh', de: 'Netz reparieren', fr: 'Réparer le maillage', hi: 'मेश ठीक करें', zh: '修复网格' },
  'rediseno.action.simplify': { es: 'Simplificar…', en: 'Simplify…', de: 'Vereinfachen…', fr: 'Simplifier…', hi: 'सरल करें…', zh: '简化…' },
  'rediseno.action.refine': { es: 'Refinar malla', en: 'Refine mesh', de: 'Netz verfeinern', fr: 'Affiner le maillage', hi: 'मेश परिष्कृत करें', zh: '细化网格' },
  'rediseno.action.hull': { es: 'Envolvente convexa', en: 'Convex hull', de: 'Konvexe Hülle', fr: 'Enveloppe convexe', hi: 'उत्तल आवरण', zh: '凸包' },
  'rediseno.action.splitColors': { es: 'Separar por colores', en: 'Split by colors', de: 'Nach Farben trennen', fr: 'Séparer par couleurs', hi: 'रंगों से अलग करें', zh: '按颜色分离' },
  'rediseno.action.splitParts': { es: 'Separar piezas sueltas', en: 'Separate loose parts', de: 'Lose Teile trennen', fr: 'Séparer les pièces détachées', hi: 'ढीले भाग अलग करें', zh: '分离松散零件' },
  'rediseno.action.group': { es: 'Agrupar', en: 'Group', de: 'Gruppieren', fr: 'Grouper', hi: 'समूह बनाएँ', zh: '编组' },
  'rediseno.action.ungroup': { es: 'Desagrupar', en: 'Ungroup', de: 'Gruppierung aufheben', fr: 'Dégrouper', hi: 'समूह हटाएँ', zh: '取消编组' },
  'rediseno.action.combine': { es: 'Combinar en un objeto', en: 'Combine into one object', de: 'Zu einem Objekt kombinieren', fr: 'Combiner en un objet', hi: 'एक ऑब्जेक्ट में मिलाएँ', zh: '合并为一个对象' },
  'rediseno.action.union': { es: 'Unir selección', en: 'Unite selection', de: 'Auswahl vereinigen', fr: 'Unir la sélection', hi: 'चयन को जोड़ें', zh: '合并所选实体' },
  'rediseno.action.applyHoles': { es: 'Aplicar restas', en: 'Apply subtractions', de: 'Subtraktionen anwenden', fr: 'Appliquer les soustractions', hi: 'घटाव लागू करें', zh: '应用减除' },
  'rediseno.action.convert': { es: 'Convertir en', en: 'Convert to', de: 'Umwandeln in', fr: 'Convertir en', hi: 'में बदलें', zh: '转换为' },
  'rediseno.action.dropToBed': { es: 'Apoyar en la cama', en: 'Drop to bed', de: 'Aufs Bett legen', fr: 'Poser sur le plateau', hi: 'बेड पर रखें', zh: '放到打印床上' },
  'rediseno.action.centerOnBed': { es: 'Centrar en la cama', en: 'Center on bed', de: 'Auf dem Bett zentrieren', fr: 'Centrer sur le plateau', hi: 'बेड पर केंद्रित करें', zh: '在打印床上居中' },
  'rediseno.action.align': { es: 'Alinear y distribuir', en: 'Align and distribute', de: 'Ausrichten und verteilen', fr: 'Aligner et répartir', hi: 'संरेखित और वितरित करें', zh: '对齐与分布' },
  'rediseno.action.validate': { es: 'Revisar si se puede imprimir', en: 'Check printability', de: 'Druckbarkeit prüfen', fr: 'Vérifier l’imprimabilité', hi: 'प्रिंट योग्यता जाँचें', zh: '检查可打印性' },
  'rediseno.action.detect': { es: 'Detectar estructuras', en: 'Detect structures', de: 'Strukturen erkennen', fr: 'Détecter les structures', hi: 'संरचनाएँ पहचानें', zh: '检测结构' },
  'rediseno.reason.noSelection': { es: 'Selecciona un objeto primero', en: 'Select an object first', de: 'Wähle zuerst ein Objekt', fr: 'Sélectionne d’abord un objet', hi: 'पहले एक ऑब्जेक्ट चुनें', zh: '请先选择一个对象' },
  'rediseno.reason.needTwo': { es: 'Selecciona dos o más objetos', en: 'Select two or more objects', de: 'Wähle zwei oder mehr Objekte', fr: 'Sélectionne deux objets ou plus', hi: 'दो या अधिक ऑब्जेक्ट चुनें', zh: '请选择两个或更多对象' },
  'rediseno.reason.locked': { es: 'La selección está bloqueada', en: 'The selection is locked', de: 'Die Auswahl ist gesperrt', fr: 'La sélection est verrouillée', hi: 'चयन लॉक है', zh: '所选对象已锁定' },
  'rediseno.reason.busy': { es: 'Espera a que termine la operación en curso', en: 'Wait for the current operation to finish', de: 'Warte, bis die laufende Operation fertig ist', fr: 'Attends la fin de l’opération en cours', hi: 'चल रही क्रिया पूरी होने दें', zh: '请等待当前操作完成' },
  'rediseno.reason.empty': { es: 'La escena está vacía', en: 'The scene is empty', de: 'Die Szene ist leer', fr: 'La scène est vide', hi: 'दृश्य खाली है', zh: '场景为空' },
  'rediseno.reason.noSubtractions': { es: 'Hace falta un negativo y un sólido visibles', en: 'Needs a visible negative and a visible solid', de: 'Braucht ein sichtbares Negativ und einen sichtbaren Körper', fr: 'Il faut un négatif et un solide visibles', hi: 'एक दिखता नेगेटिव और एक दिखता सॉलिड चाहिए', zh: '需要一个可见的负形和一个可见的实体' },
  'rediseno.reason.singleBody': { es: 'El objeto es una sola pieza', en: 'The object is a single piece', de: 'Das Objekt ist ein einziges Teil', fr: 'L’objet est une seule pièce', hi: 'ऑब्जेक्ट एक ही टुकड़ा है', zh: '该对象只有一个实体' },
  'rediseno.reason.notGrouped': { es: 'La selección no está agrupada', en: 'The selection is not grouped', de: 'Die Auswahl ist nicht gruppiert', fr: 'La sélection n’est pas groupée', hi: 'चयन समूह में नहीं है', zh: '所选对象未编组' },
  'rediseno.reason.oneObject': { es: 'Selecciona un solo objeto', en: 'Select a single object', de: 'Wähle ein einzelnes Objekt', fr: 'Sélectionne un seul objet', hi: 'एक ही ऑब्जेक्ट चुनें', zh: '请只选择一个对象' },
  'rediseno.reason.disabled': { es: 'No disponible: {reason}', en: 'Unavailable: {reason}', de: 'Nicht verfügbar: {reason}', fr: 'Indisponible : {reason}', hi: 'उपलब्ध नहीं: {reason}', zh: '不可用:{reason}' },

  // Historial
  'rediseno.history.button': { es: 'Historial de acciones', en: 'Action history', de: 'Aktionsverlauf', fr: 'Historique des actions', hi: 'क्रिया इतिहास', zh: '操作历史' },
  'rediseno.help.history': { es: 'Lista lo hecho; elige un paso para volver a ese punto.', en: 'Lists what was done; pick a step to go back to that point.', de: 'Listet das Erledigte; wähle einen Schritt, um dorthin zurückzukehren.', fr: 'Liste ce qui a été fait ; choisis une étape pour y revenir.', hi: 'किया गया काम दिखाता है; उस बिंदु पर लौटने के लिए चरण चुनें।', zh: '列出已执行的操作;选择某一步可回到该状态。' },
  'rediseno.history.start': { es: 'Inicio', en: 'Start', de: 'Anfang', fr: 'Début', hi: 'आरंभ', zh: '起点' },
  'rediseno.history.current': { es: 'estado actual', en: 'current state', de: 'aktueller Stand', fr: 'état actuel', hi: 'वर्तमान स्थिति', zh: '当前状态' },
  'rediseno.history.undone': { es: 'deshecho', en: 'undone', de: 'rückgängig gemacht', fr: 'annulé', hi: 'पूर्ववत', zh: '已撤销' },
  'rediseno.history.empty': { es: 'Aún no hay pasos para deshacer', en: 'No steps to undo yet', de: 'Noch keine Schritte zum Rückgängigmachen', fr: 'Aucune étape à annuler pour l’instant', hi: 'अभी पूर्ववत करने के लिए कोई चरण नहीं', zh: '暂无可撤销的步骤' },
  'rediseno.history.older': { es: '{count} {count?paso anterior|pasos anteriores} más', en: '{count} older {count?step|steps}', de: '{count} ältere {count?Schritt|Schritte}', fr: '{count} {count?étape antérieure|étapes antérieures}', hi: '{count} पुराने चरण', zh: '还有 {count} 个更早的步骤' },
  'rediseno.history.step.add': { es: 'Agregar {name}', en: 'Add {name}', de: '{name} hinzufügen', fr: 'Ajouter {name}', hi: '{name} जोड़ें', zh: '添加 {name}' },
  'rediseno.history.step.addMany': { es: 'Agregar {count} objetos', en: 'Add {count} objects', de: '{count} Objekte hinzufügen', fr: 'Ajouter {count} objets', hi: '{count} ऑब्जेक्ट जोड़ें', zh: '添加 {count} 个对象' },
  'rediseno.history.step.remove': { es: 'Eliminar {name}', en: 'Delete {name}', de: '{name} löschen', fr: 'Supprimer {name}', hi: '{name} हटाएँ', zh: '删除 {name}' },
  'rediseno.history.step.removeMany': { es: 'Eliminar {count} objetos', en: 'Delete {count} objects', de: '{count} Objekte löschen', fr: 'Supprimer {count} objets', hi: '{count} ऑब्जेक्ट हटाएँ', zh: '删除 {count} 个对象' },
  'rediseno.history.step.replace': { es: 'Operación sobre {name}', en: 'Operation on {name}', de: 'Operation an {name}', fr: 'Opération sur {name}', hi: '{name} पर क्रिया', zh: '对 {name} 的操作' },
  'rediseno.history.step.move': { es: 'Mover {name}', en: 'Move {name}', de: '{name} verschieben', fr: 'Déplacer {name}', hi: '{name} खिसकाएँ', zh: '移动 {name}' },
  'rediseno.history.step.rotate': { es: 'Rotar {name}', en: 'Rotate {name}', de: '{name} drehen', fr: 'Pivoter {name}', hi: '{name} घुमाएँ', zh: '旋转 {name}' },
  'rediseno.history.step.scale': { es: 'Escalar {name}', en: 'Scale {name}', de: '{name} skalieren', fr: 'Mettre {name} à l’échelle', hi: '{name} का आकार बदलें', zh: '缩放 {name}' },
  'rediseno.history.step.mesh': { es: 'Editar malla de {name}', en: 'Edit mesh of {name}', de: 'Netz von {name} bearbeiten', fr: 'Modifier le maillage de {name}', hi: '{name} का मेश बदलें', zh: '编辑 {name} 的网格' },
  'rediseno.history.step.paint': { es: 'Pintar {name}', en: 'Paint {name}', de: '{name} bemalen', fr: 'Peindre {name}', hi: '{name} रंगें', zh: '为 {name} 上色' },
  'rediseno.history.step.props': { es: 'Cambiar {name}', en: 'Change {name}', de: '{name} ändern', fr: 'Modifier {name}', hi: '{name} बदलें', zh: '更改 {name}' },
  'rediseno.history.step.groups': { es: 'Cambiar grupos', en: 'Change groups', de: 'Gruppen ändern', fr: 'Modifier les groupes', hi: 'समूह बदलें', zh: '更改编组' },
  'rediseno.history.step.many': { es: 'Cambiar {count} objetos', en: 'Change {count} objects', de: '{count} Objekte ändern', fr: 'Modifier {count} objets', hi: '{count} ऑब्जेक्ट बदलें', zh: '更改 {count} 个对象' },
  'rediseno.history.step.other': { es: 'Cambio en la escena', en: 'Scene change', de: 'Änderung der Szene', fr: 'Modification de la scène', hi: 'दृश्य में बदलाव', zh: '场景更改' },

  // Barra de estado
  'rediseno.status.help': { es: 'Ayuda del control', en: 'Control help', de: 'Hilfe zum Bedienelement', fr: 'Aide du contrôle', hi: 'नियंत्रण सहायता', zh: '控件帮助' },
  'rediseno.status.neutral': { es: 'Pasa el cursor sobre un control para ver qué hace', en: 'Hover a control to see what it does', de: 'Fahre über ein Bedienelement, um zu sehen, was es tut', fr: 'Survole un contrôle pour voir ce qu’il fait', hi: 'कोई नियंत्रण क्या करता है यह देखने के लिए उस पर कर्सर रखें', zh: '将指针悬停在控件上即可查看其作用' },
  'rediseno.status.shortcut': { es: 'Atajo: {keys}', en: 'Shortcut: {keys}', de: 'Kürzel: {keys}', fr: 'Raccourci : {keys}', hi: 'शॉर्टकट: {keys}', zh: '快捷键:{keys}' },
  'rediseno.skip.tools': { es: 'Saltar a las herramientas', en: 'Skip to tools', de: 'Zu den Werkzeugen springen', fr: 'Aller aux outils', hi: 'टूल पर जाएँ', zh: '跳到工具' },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof REDISENO]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(REDISENO).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const REDISENO_ES = pick('es');
export const REDISENO_EN = pick('en');
export const REDISENO_DE = pick('de');
export const REDISENO_FR = pick('fr');
export const REDISENO_HI = pick('hi');
export const REDISENO_ZH = pick('zh');
