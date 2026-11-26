/**
 * @file src/i18n/locales/orientar.ts
 * @description Textos de «Orientar para imprimir» (acción, panel contextual, lista de orientaciones, motivos y
 * ayudas) en los 6 idiomas. Cada clave se escribe una vez con sus 6 idiomas; `ORIENT_UI_<IDIOMA>` se mezcla al
 * final de cada diccionario. Los motivos (`orient.reason.*`) se arman desde los datos del motor (`key` + `params`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const ORIENT_UI = {
  // Acción (menú Acciones, menú contextual, paleta)
  'rediseno.action.orient': { es: 'Orientar para imprimir…', en: 'Orient for printing…', de: 'Für den Druck ausrichten…', fr: 'Orienter pour l’impression…', hi: 'प्रिंट के लिए दिशा तय करें…', zh: '为打印确定朝向…' },
  'orient.ui.title': { es: 'Orientar para imprimir', en: 'Orient for printing', de: 'Für den Druck ausrichten', fr: 'Orienter pour l’impression', hi: 'प्रिंट के लिए दिशा', zh: '为打印确定朝向' },
  'orient.ui.openTip': { es: 'Compara cómo apoyar la pieza en la cama para necesitar menos soporte, sin cambiar la escena hasta que apliques.', en: 'Compares ways to lay the part on the bed so it needs less support, without changing the scene until you apply.', de: 'Vergleicht, wie das Teil auf dem Bett liegen kann, damit es weniger Stützen braucht, ohne die Szene zu ändern, bis du anwendest.', fr: 'Compare les façons de poser la pièce sur le plateau pour limiter les supports, sans modifier la scène avant d’appliquer.', hi: 'तुलना करता है कि भाग को बेड पर कैसे रखें ताकि कम सपोर्ट लगे; लागू करने तक दृश्य नहीं बदलता।', zh: '比较零件在打印床上的放置方式,以减少支撑;应用之前不会改动场景。' },
  'orient.ui.reason.needOne': { es: 'Selecciona una sola pieza', en: 'Select a single part', de: 'Wähle nur ein Teil', fr: 'Sélectionne une seule pièce', hi: 'केवल एक भाग चुनें', zh: '请只选择一个零件' },
  'orient.ui.reason.notSolid': { es: 'Solo se orientan piezas sólidas (no negativos ni referencias)', en: 'Only solid parts can be oriented (not negatives or references)', de: 'Nur feste Teile lassen sich ausrichten (keine Negative oder Referenzen)', fr: 'Seules les pièces pleines s’orientent (ni négatifs ni références)', hi: 'केवल ठोस भाग ही घुमाए जा सकते हैं (नेगेटिव या संदर्भ नहीं)', zh: '只能为实体零件确定朝向(负形和参考除外)' },

  // Cálculo
  'orient.ui.calculating': { es: 'Calculando orientaciones…', en: 'Calculating orientations…', de: 'Ausrichtungen werden berechnet…', fr: 'Calcul des orientations…', hi: 'दिशाएँ गिनी जा रही हैं…', zh: '正在计算朝向…' },
  'orient.ui.progress': { es: 'Avance del cálculo', en: 'Calculation progress', de: 'Berechnungsfortschritt', fr: 'Avancement du calcul', hi: 'गणना की प्रगति', zh: '计算进度' },
  'orient.ui.cancel': { es: 'Cancelar', en: 'Cancel', de: 'Abbrechen', fr: 'Annuler', hi: 'रद्द करें', zh: '取消' },
  'orient.ui.cancelled': { es: 'Cálculo cancelado.', en: 'Calculation cancelled.', de: 'Berechnung abgebrochen.', fr: 'Calcul annulé.', hi: 'गणना रद्द की गई।', zh: '计算已取消。' },
  'orient.ui.stale': { es: 'La pieza cambió: las orientaciones mostradas ya no corresponden.', en: 'The part changed: the orientations shown no longer apply.', de: 'Das Teil hat sich geändert: Die angezeigten Ausrichtungen gelten nicht mehr.', fr: 'La pièce a changé : les orientations affichées ne correspondent plus.', hi: 'भाग बदल गया: दिखाई गई दिशाएँ अब लागू नहीं हैं।', zh: '零件已变化:显示的朝向已不适用。' },
  'orient.ui.recalc': { es: 'Calcular de nuevo', en: 'Calculate again', de: 'Erneut berechnen', fr: 'Recalculer', hi: 'फिर से गिनें', zh: '重新计算' },

  // Resumen
  'orient.ui.summary.best': { es: 'La orientación actual ya es la mejor: no hace falta moverla.', en: 'The current orientation is already the best: no need to move it.', de: 'Die aktuelle Ausrichtung ist bereits die beste: Sie muss nicht bewegt werden.', fr: 'L’orientation actuelle est déjà la meilleure : inutile de la changer.', hi: 'मौजूदा दिशा पहले से सबसे अच्छी है: इसे बदलने की ज़रूरत नहीं।', zh: '当前朝向已经是最好的,无需改动。' },
  'orient.ui.summary.equivalent': { es: 'Todas las orientaciones son equivalentes para imprimir: no hay una recomendada.', en: 'All orientations are equivalent for printing: none is recommended.', de: 'Alle Ausrichtungen sind für den Druck gleichwertig: Keine wird empfohlen.', fr: 'Toutes les orientations sont équivalentes pour imprimer : aucune n’est recommandée.', hi: 'प्रिंट के लिए सभी दिशाएँ बराबर हैं: कोई सुझाई नहीं गई है।', zh: '所有朝向对打印来说都等效,因此没有推荐项。' },
  'orient.ui.summary.better': { es: 'Se compararon {count} orientaciones. La recomendada necesita menos soporte que la actual.', en: '{count} orientations were compared. The recommended one needs less support than the current one.', de: '{count} Ausrichtungen wurden verglichen. Die empfohlene braucht weniger Stützen als die aktuelle.', fr: '{count} orientations comparées. La recommandée demande moins de supports que l’actuelle.', hi: '{count} दिशाओं की तुलना की गई। सुझाई गई दिशा में मौजूदा से कम सपोर्ट लगता है।', zh: '已比较 {count} 种朝向。推荐项所需的支撑比当前朝向更少。' },
  'orient.ui.noStableBase': { es: 'La pieza no se sostiene sola en ninguna de estas orientaciones: no tiene una cara plana que apoye en la cama. Necesitará soporte, balsa o un corte plano.', en: 'The part cannot stand on its own in any of these orientations: no flat face rests on the bed. It will need supports, a raft or a flat cut.', de: 'Das Teil steht in keiner dieser Ausrichtungen von selbst: Keine ebene Fläche liegt auf dem Bett. Es braucht Stützen, ein Floß (Raft) oder einen ebenen Schnitt.', fr: 'La pièce ne tient seule dans aucune de ces orientations : aucune face plane ne repose sur le plateau. Il faudra des supports, un radeau ou une coupe plane.', hi: 'इनमें से किसी भी दिशा में भाग अपने आप नहीं टिकता: कोई समतल फलक बेड पर नहीं टिकता। इसे सपोर्ट, राफ्ट या एक समतल कट की ज़रूरत होगी।', zh: '在这些朝向中零件都无法自行立稳:没有平面贴在打印床上。需要支撑、底筏(raft)或切出一个平面。' },

  // Ajuste del umbral
  'orient.ui.angle': { es: 'Ángulo de voladizo (°)', en: 'Overhang angle (°)', de: 'Überhangwinkel (°)', fr: 'Angle de surplomb (°)', hi: 'ओवरहैंग कोण (°)', zh: '悬垂角度 (°)' },
  'orient.ui.angleHint': { es: 'Una pared más inclinada que este ángulo desde la vertical cuenta como voladizo. Entre {min}° y {max}°.', en: 'A wall tilted past this angle from vertical counts as an overhang. Between {min}° and {max}°.', de: 'Eine Wand, die stärker als dieser Winkel von der Senkrechten abweicht, gilt als Überhang. Zwischen {min}° und {max}°.', fr: 'Une paroi plus inclinée que cet angle par rapport à la verticale compte comme surplomb. Entre {min}° et {max}°.', hi: 'ऊर्ध्वाधर से इस कोण से अधिक झुकी दीवार ओवरहैंग गिनी जाती है। {min}° से {max}° के बीच।', zh: '与竖直方向夹角超过此值的壁面算作悬垂。范围 {min}° 到 {max}°。' },
  'orient.ui.angleInvalid': { es: 'Escribe un valor entre {min}° y {max}°.', en: 'Enter a value between {min}° and {max}°.', de: 'Gib einen Wert zwischen {min}° und {max}° ein.', fr: 'Saisis une valeur entre {min}° et {max}°.', hi: '{min}° और {max}° के बीच मान लिखें।', zh: '请输入 {min}° 到 {max}° 之间的值。' },

  // Lista
  'orient.ui.list': { es: 'Orientaciones posibles', en: 'Possible orientations', de: 'Mögliche Ausrichtungen', fr: 'Orientations possibles', hi: 'संभावित दिशाएँ', zh: '可选朝向' },
  'orient.ui.listHint': { es: 'Flechas para recorrer (muestra la vista previa), Enter para aplicar, Esc para volver.', en: 'Arrow keys to browse (shows the preview), Enter to apply, Esc to go back.', de: 'Pfeiltasten zum Durchgehen (zeigt die Vorschau), Enter zum Anwenden, Esc zum Zurückgehen.', fr: 'Flèches pour parcourir (affiche l’aperçu), Entrée pour appliquer, Échap pour revenir.', hi: 'ब्राउज़ करने के लिए तीर कुंजियाँ (पूर्वावलोकन दिखता है), लागू करने के लिए Enter, वापस जाने के लिए Esc।', zh: '用方向键浏览(显示预览),Enter 应用,Esc 返回。' },
  'orient.ui.option': { es: 'Opción {n}', en: 'Option {n}', de: 'Option {n}', fr: 'Option {n}', hi: 'विकल्प {n}', zh: '选项 {n}' },
  'orient.ui.badge.current': { es: 'Actual', en: 'Current', de: 'Aktuell', fr: 'Actuelle', hi: 'मौजूदा', zh: '当前' },
  'orient.ui.badge.recommended': { es: 'Recomendada', en: 'Recommended', de: 'Empfohlen', fr: 'Recommandée', hi: 'सुझाई गई', zh: '推荐' },
  'orient.ui.badge.chosen': { es: 'Elegida', en: 'Chosen', de: 'Gewählt', fr: 'Choisie', hi: 'चुनी गई', zh: '已选' },
  'orient.ui.stat.support': { es: 'Soporte aprox.', en: 'Support (approx.)', de: 'Stützen (ca.)', fr: 'Supports (approx.)', hi: 'सपोर्ट (लगभग)', zh: '支撑(约)' },
  'orient.ui.stat.overhang': { es: 'Área en voladizo', en: 'Overhang area', de: 'Überhangfläche', fr: 'Surface en surplomb', hi: 'ओवरहैंग क्षेत्र', zh: '悬垂面积' },
  'orient.ui.stat.base': { es: 'Base de apoyo', en: 'Contact base', de: 'Auflagefläche', fr: 'Base d’appui', hi: 'आधार संपर्क', zh: '接触底面' },
  'orient.ui.stat.height': { es: 'Altura', en: 'Height', de: 'Höhe', fr: 'Hauteur', hi: 'ऊँचाई', zh: '高度' },

  // Motivos (desde los datos del motor)
  'orient.reason.current': { es: 'Es como está la pieza ahora.', en: 'This is how the part sits now.', de: 'So liegt das Teil jetzt.', fr: 'C’est la position actuelle de la pièce.', hi: 'भाग अभी ऐसे ही रखा है।', zh: '这是零件现在的摆放方式。' },
  'orient.reason.noOverhangs': { es: 'Sin voladizos: no necesita soporte.', en: 'No overhangs: needs no support.', de: 'Keine Überhänge: braucht keine Stützen.', fr: 'Sans surplomb : aucun support nécessaire.', hi: 'कोई ओवरहैंग नहीं: सपोर्ट नहीं लगेगा।', zh: '没有悬垂:不需要支撑。' },
  'orient.reason.supportLess': { es: '{percent} % menos soporte que ahora.', en: '{percent}% less support than now.', de: '{percent} % weniger Stützen als jetzt.', fr: '{percent} % de supports en moins qu’actuellement.', hi: 'अभी से {percent}% कम सपोर्ट।', zh: '支撑比现在少 {percent}%。' },
  'orient.reason.supportMore': { es: '{percent} % más soporte que ahora.', en: '{percent}% more support than now.', de: '{percent} % mehr Stützen als jetzt.', fr: '{percent} % de supports en plus qu’actuellement.', hi: 'अभी से {percent}% अधिक सपोर्ट।', zh: '支撑比现在多 {percent}%。' },
  'orient.reason.supportAdded': { es: 'Necesita soporte (unos {volume}) y la actual no.', en: 'Needs support (about {volume}) and the current one does not.', de: 'Braucht Stützen (etwa {volume}), die aktuelle nicht.', fr: 'Demande des supports (environ {volume}) alors que l’actuelle non.', hi: 'सपोर्ट लगेगा (लगभग {volume}) जबकि मौजूदा में नहीं लगता।', zh: '需要支撑(约 {volume}),而当前朝向不需要。' },
  'orient.reason.baseVsCurrent': { es: 'Base {factor} veces mayor que ahora.', en: 'Base {factor} times larger than now.', de: 'Auflagefläche {factor}-mal größer als jetzt.', fr: 'Base {factor} fois plus grande qu’actuellement.', hi: 'आधार अभी से {factor} गुना बड़ा।', zh: '底面是现在的 {factor} 倍。' },
  'orient.reason.lowerVsCurrent': { es: '{percent} % más baja que ahora.', en: '{percent}% lower than now.', de: '{percent} % niedriger als jetzt.', fr: '{percent} % plus basse qu’actuellement.', hi: 'अभी से {percent}% नीची।', zh: '比现在矮 {percent}%。' },
  'orient.reason.equivalentToBest': { es: 'Tan buena para imprimir como la mejor.', en: 'As good for printing as the best one.', de: 'Fürs Drucken so gut wie die beste.', fr: 'Aussi bonne pour imprimer que la meilleure.', hi: 'प्रिंट के लिए सबसे अच्छी जितनी ही अच्छी।', zh: '打印效果与最佳项相当。' },
  'orient.reason.unstable': { es: 'Inestable: puede volcarse (se inclina {angle}° antes de caer).', en: 'Unstable: it can tip over (it tilts {angle}° before falling).', de: 'Instabil: kann umkippen (kippt nach {angle}°).', fr: 'Instable : peut basculer (bascule après {angle}° d’inclinaison).', hi: 'अस्थिर: पलट सकता है ({angle}° झुकने पर गिरता है)।', zh: '不稳定:可能倾倒(倾斜 {angle}° 就会倒)。' },
  'orient.reason.noBase': { es: 'Sin base: solo toca la cama con aristas o puntos y no se sostiene sola.', en: 'No base: only edges or points touch the bed and it cannot stand on its own.', de: 'Keine Auflagefläche: nur Kanten oder Punkte berühren das Bett, es hält nicht von selbst.', fr: 'Sans base : seules des arêtes ou des pointes touchent le plateau, elle ne tient pas seule.', hi: 'आधार नहीं: बेड को केवल किनारे या बिंदु छूते हैं, यह अपने आप नहीं टिकता।', zh: '没有底面:只有棱边或顶点接触打印床,无法自行立稳。' },
  'orient.reason.doesNotFit': { es: 'No cabe en la cama.', en: 'Does not fit on the bed.', de: 'Passt nicht auf das Druckbett.', fr: 'Ne tient pas sur le plateau.', hi: 'बेड पर नहीं समाता।', zh: '放不进打印床。' },

  // Aplicar
  'orient.ui.keepPosition': { es: 'Conservar posición en la cama', en: 'Keep position on the bed', de: 'Position auf dem Bett beibehalten', fr: 'Conserver la position sur le plateau', hi: 'बेड पर स्थिति बनाए रखें', zh: '保持在打印床上的位置' },
  'orient.ui.keepPositionHint': { es: 'Si lo desactivas, la pieza queda centrada en la cama.', en: 'If you turn it off, the part is centered on the bed.', de: 'Wenn du es ausschaltest, wird das Teil auf dem Bett zentriert.', fr: 'Si tu le désactives, la pièce est centrée sur le plateau.', hi: 'बंद करने पर भाग बेड के केंद्र में रखा जाता है।', zh: '关闭后零件会居中放置在打印床上。' },
  'orient.ui.apply': { es: 'Aplicar orientación', en: 'Apply orientation', de: 'Ausrichtung anwenden', fr: 'Appliquer l’orientation', hi: 'दिशा लागू करें', zh: '应用朝向' },
  'orient.ui.applyAnyway': { es: 'Aplicar de todos modos', en: 'Apply anyway', de: 'Trotzdem anwenden', fr: 'Appliquer quand même', hi: 'फिर भी लागू करें', zh: '仍然应用' },
  'orient.ui.noBaseGroup': { es: 'No recomendadas: sin base de apoyo ({count})', en: 'Not recommended: no supporting base ({count})', de: 'Nicht empfohlen: ohne Auflagefläche ({count})', fr: 'Non recommandées : sans base d’appui ({count})', hi: 'अनुशंसित नहीं: सहारे का आधार नहीं ({count})', zh: '不推荐：没有支撑底面（{count}）' },
  'orient.ui.noBaseGroupHint': { es: 'Solo tocan la cama con una arista o un punto: la pieza puede moverse al imprimir. Elígelas solo si no hay otra opción.', en: 'They touch the bed only with an edge or a point: the part may shift while printing. Choose them only if there is no other option.', de: 'Sie berühren das Bett nur mit einer Kante oder einem Punkt: Das Teil kann sich beim Drucken verschieben. Wähle sie nur, wenn es keine andere Option gibt.', fr: 'Elles ne touchent le plateau que par une arête ou un point : la pièce peut bouger pendant l’impression. Ne les choisis que s’il n’y a pas d’autre option.', hi: 'ये बेड को केवल किनारे या एक बिंदु से छूती हैं: छपाई में भाग खिसक सकता है। केवल तभी चुनें जब कोई और विकल्प न हो।', zh: '它们只用一条边或一个点接触打印床：打印时零件可能移动。仅在没有其他选项时选择。' },
  'orient.ui.confirmNoBase': { es: 'Esta orientación no tiene base de apoyo. Pulsa «Aplicar de todos modos» para confirmarla.', en: 'This orientation has no supporting base. Press “Apply anyway” to confirm it.', de: 'Diese Ausrichtung hat keine Auflagefläche. Drücke „Trotzdem anwenden“, um sie zu bestätigen.', fr: 'Cette orientation n’a pas de base d’appui. Appuie sur « Appliquer quand même » pour la confirmer.', hi: 'इस दिशा में सहारे का आधार नहीं है। पुष्टि के लिए “फिर भी लागू करें” दबाएँ।', zh: '此朝向没有支撑底面。请按“仍然应用”确认。' },
  'orient.ui.applyNeed': { es: 'Elige una orientación distinta de la actual para aplicarla.', en: 'Choose an orientation other than the current one to apply it.', de: 'Wähle eine andere Ausrichtung als die aktuelle, um sie anzuwenden.', fr: 'Choisis une orientation différente de l’actuelle pour l’appliquer.', hi: 'लागू करने के लिए मौजूदा से अलग दिशा चुनें।', zh: '请选择与当前不同的朝向再应用。' },
  'orient.ui.applied': { es: '«{name}» orientada y apoyada en la cama.', en: '“{name}” oriented and resting on the bed.', de: '„{name}“ ausgerichtet und auf das Bett gelegt.', fr: '« {name} » orientée et posée sur le plateau.', hi: '“{name}” की दिशा तय हुई और वह बेड पर टिकी है।', zh: '“{name}”已调整朝向并落在打印床上。' },

  'orient.ui.appliedNoBase': { es: '«{name}» orientada, pero sin base: solo toca la cama con aristas o puntos.', en: '“{name}” oriented, but with no base: only edges or points touch the bed.', de: '„{name}“ ausgerichtet, aber ohne Auflagefläche: nur Kanten oder Punkte berühren das Bett.', fr: '« {name} » orientée, mais sans base : seules des arêtes ou des pointes touchent le plateau.', hi: '“{name}” की दिशा तय हुई, पर आधार नहीं: बेड को केवल किनारे या बिंदु छूते हैं।', zh: '“{name}”已调整朝向,但没有底面:只有棱边或顶点接触打印床。' },

  // Leyenda y nota
  'orient.ui.legend': { es: 'Zonas que necesitarían soporte', en: 'Areas that would need support', de: 'Bereiche, die Stützen bräuchten', fr: 'Zones qui demanderaient des supports', hi: 'वे हिस्से जिन्हें सपोर्ट चाहिए', zh: '需要支撑的区域' },
  'orient.ui.legendHint': { es: 'Se muestran en naranja sobre la vista previa de la orientación en foco.', en: 'Shown in orange on the preview of the focused orientation.', de: 'In Orange auf der Vorschau der fokussierten Ausrichtung dargestellt.', fr: 'Affichées en orange sur l’aperçu de l’orientation ciblée.', hi: 'फ़ोकस की गई दिशा के पूर्वावलोकन पर नारंगी रंग में दिखते हैं।', zh: '在当前聚焦朝向的预览上以橙色显示。' },
  'orient.ui.note': { es: 'El volumen de soporte es aproximado y los puentes cortos cuentan como voladizo. La decisión final es tuya. Kurra Studio no genera soportes: solo orienta y mide.', en: 'The support volume is approximate and short bridges count as overhangs. The final decision is yours. Kurra Studio does not generate supports: it only orients and measures.', de: 'Das Stützvolumen ist eine Näherung, und kurze Brücken zählen als Überhang. Die Entscheidung liegt bei dir. Kurra Studio erzeugt keine Stützen: Es richtet nur aus und misst.', fr: 'Le volume de supports est approximatif et les ponts courts comptent comme surplombs. La décision finale t’appartient. Kurra Studio ne génère pas de supports : il oriente et mesure seulement.', hi: 'सपोर्ट की मात्रा अनुमानित है और छोटे पुल ओवरहैंग गिने जाते हैं। अंतिम निर्णय आपका है। Kurra Studio सपोर्ट नहीं बनाता: वह केवल दिशा तय करता और नापता है।', zh: '支撑体积是近似值,短桥也按悬垂计算。最终由你决定。Kurra Studio 不生成支撑,只负责确定朝向和测量。' },

  // Ayudas de control
  'orient.help.option': { es: 'Muestra esta orientación en el visor; Enter la aplica.', en: 'Shows this orientation in the viewport; Enter applies it.', de: 'Zeigt diese Ausrichtung im Ansichtsfenster; Enter wendet sie an.', fr: 'Affiche cette orientation dans la vue ; Entrée l’applique.', hi: 'व्यूपोर्ट में यह दिशा दिखाता है; Enter इसे लागू करता है।', zh: '在视图中显示此朝向;按 Enter 应用。' },
  'orient.help.angle': { es: 'Ángulo desde la vertical a partir del cual una pared cuenta como voladizo; recalcula la lista.', en: 'Angle from vertical beyond which a wall counts as an overhang; recalculates the list.', de: 'Winkel zur Senkrechten, ab dem eine Wand als Überhang gilt; berechnet die Liste neu.', fr: 'Angle par rapport à la verticale au-delà duquel une paroi compte comme surplomb ; recalcule la liste.', hi: 'ऊर्ध्वाधर से वह कोण जिसके बाद दीवार ओवरहैंग गिनी जाती है; सूची फिर से बनती है।', zh: '与竖直方向夹角超过该值的壁面算作悬垂;会重新计算列表。' },
  'orient.help.keepPosition': { es: 'Mantiene el lugar de la pieza sobre la cama; apagado la centra.', en: 'Keeps the part where it is on the bed; off centers it.', de: 'Behält die Position des Teils auf dem Bett; ausgeschaltet wird es zentriert.', fr: 'Garde la pièce à sa place sur le plateau ; désactivé, elle est centrée.', hi: 'भाग को बेड पर उसी जगह रखता है; बंद होने पर उसे केंद्र में रखता है।', zh: '保持零件在打印床上的位置;关闭则居中。' },
  'orient.help.apply': { es: 'Gira la pieza a la orientación elegida y la apoya en la cama; se deshace en un paso.', en: 'Rotates the part to the chosen orientation and rests it on the bed; undoes in one step.', de: 'Dreht das Teil in die gewählte Ausrichtung und legt es auf das Bett; in einem Schritt rückgängig zu machen.', fr: 'Fait pivoter la pièce vers l’orientation choisie et la pose sur le plateau ; s’annule en une étape.', hi: 'भाग को चुनी दिशा में घुमाकर बेड पर रखता है; एक ही चरण में पूर्ववत होता है।', zh: '把零件转到所选朝向并落在打印床上;一步即可撤销。' },
  'orient.help.cancel': { es: 'Detiene el cálculo en curso.', en: 'Stops the running calculation.', de: 'Stoppt die laufende Berechnung.', fr: 'Arrête le calcul en cours.', hi: 'चल रही गणना रोकता है।', zh: '停止正在进行的计算。' },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof ORIENT_UI]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(ORIENT_UI).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const ORIENT_UI_ES = pick('es');
export const ORIENT_UI_EN = pick('en');
export const ORIENT_UI_DE = pick('de');
export const ORIENT_UI_FR = pick('fr');
export const ORIENT_UI_HI = pick('hi');
export const ORIENT_UI_ZH = pick('zh');
