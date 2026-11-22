/**
 * @file src/i18n/locales/flowUx.ts
 * @description Textos del lote de flujo de usabilidad: repetir con F4, aviso de pintar sobre piezas
 * paramétricas, vaciar la cama con confirmación y «Deshacer», cavidad cerrada en el análisis de
 * imprimibilidad y ahuecado desde el menú contextual, en los 6 idiomas. Se mezclan en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export const FLOWUX_ES = {
  'repeat.done': 'Repetido: {name}',
  'paint.parametric.title': 'Pintar quita los parámetros',
  'paint.parametric.message': 'Al pintar «{name}» su malla se refina y la pieza dejará de editarse por parámetros (medidas, segmentos). Puedes deshacer el trazo para recuperarla intacta.',
  'paint.parametric.paint': 'Pintar igual',
  'paint.parametric.paintAlways': 'Pintar igual y no volver a preguntar',
  'scene.clear.title': 'Vaciar la cama',
  'scene.clear.message.one': 'Se eliminará 1 objeto de la cama. Después podrás deshacerlo.',
  'scene.clear.message.other': 'Se eliminarán {count} objetos de la cama. Después podrás deshacerlo.',
  'scene.clear.confirm': 'Vaciar cama',
  'toast.sceneCleared.one': 'Cama vaciada (1 objeto)',
  'toast.sceneCleared.other': 'Cama vaciada ({count} objetos)',
  'toast.undo': 'Deshacer',
  'printWarning.SEALED_CAVITY': 'Cavidad cerrada sin salida ({volume} cm³ encerrados): no se puede vaciar ni limpiar. Agrega un orificio de drenaje si necesitas sacar material.',
  'toast.hollowSealed': 'Queda una cavidad cerrada, sin salida. Si necesitas vaciarla, ahueca con orificio de drenaje.',
  'ctx.hollowOpen': 'Ahuecar pieza…',
  'ctx.hollowOpenTip': 'Abre el panel de ahuecado con la pared por defecto (2,2 mm)',
  'toast.hollowPanelOpened': 'Ajusta la pared y pulsa «Ahuecar». Sin orificio de drenaje queda una cavidad cerrada.',
};

export const FLOWUX_EN = {
  'repeat.done': 'Repeated: {name}',
  'paint.parametric.title': 'Painting removes the parameters',
  'paint.parametric.message': 'Painting "{name}" refines its mesh and the part will stop being editable by parameters (sizes, segments). You can undo the stroke to get it back intact.',
  'paint.parametric.paint': 'Paint anyway',
  'paint.parametric.paintAlways': 'Paint anyway and do not ask again',
  'scene.clear.title': 'Clear the bed',
  'scene.clear.message.one': '1 object will be removed from the bed. You can undo it right after.',
  'scene.clear.message.other': '{count} objects will be removed from the bed. You can undo it right after.',
  'scene.clear.confirm': 'Clear bed',
  'toast.sceneCleared.one': 'Bed cleared (1 object)',
  'toast.sceneCleared.other': 'Bed cleared ({count} objects)',
  'toast.undo': 'Undo',
  'printWarning.SEALED_CAVITY': 'Closed cavity with no way out ({volume} cm³ enclosed): it cannot be emptied or cleaned. Add a drain hole if you need to get material out.',
  'toast.hollowSealed': 'A closed cavity with no way out remains. If you need to empty it, hollow with a drain hole.',
  'ctx.hollowOpen': 'Hollow out…',
  'ctx.hollowOpenTip': 'Opens the hollow panel with the default wall (2.2 mm)',
  'toast.hollowPanelOpened': 'Set the wall and press "Hollow". Without a drain hole a closed cavity remains.',
};

export const FLOWUX_DE = {
  'repeat.done': 'Wiederholt: {name}',
  'paint.parametric.title': 'Malen entfernt die Parameter',
  'paint.parametric.message': 'Beim Bemalen von „{name}“ wird das Netz verfeinert und das Teil ist nicht mehr über Parameter (Maße, Segmente) bearbeitbar. Mit Rückgängig erhältst du es unverändert zurück.',
  'paint.parametric.paint': 'Trotzdem malen',
  'paint.parametric.paintAlways': 'Trotzdem malen und nicht mehr fragen',
  'scene.clear.title': 'Druckbett leeren',
  'scene.clear.message.one': '1 Objekt wird vom Druckbett entfernt. Danach kannst du es rückgängig machen.',
  'scene.clear.message.other': '{count} Objekte werden vom Druckbett entfernt. Danach kannst du es rückgängig machen.',
  'scene.clear.confirm': 'Bett leeren',
  'toast.sceneCleared.one': 'Bett geleert (1 Objekt)',
  'toast.sceneCleared.other': 'Bett geleert ({count} Objekte)',
  'toast.undo': 'Rückgängig',
  'printWarning.SEALED_CAVITY': 'Geschlossener Hohlraum ohne Ausgang ({volume} cm³ eingeschlossen): er lässt sich nicht leeren oder reinigen. Füge ein Ablaufloch hinzu, wenn Material heraus muss.',
  'toast.hollowSealed': 'Es bleibt ein geschlossener Hohlraum ohne Ausgang. Zum Entleeren aushöhlen mit Ablaufloch.',
  'ctx.hollowOpen': 'Aushöhlen…',
  'ctx.hollowOpenTip': 'Öffnet das Aushöhl-Panel mit der Standardwand (2,2 mm)',
  'toast.hollowPanelOpened': 'Wand einstellen und „Aushöhlen“ drücken. Ohne Ablaufloch bleibt ein geschlossener Hohlraum.',
};

export const FLOWUX_FR = {
  'repeat.done': 'Répété : {name}',
  'paint.parametric.title': 'Peindre supprime les paramètres',
  'paint.parametric.message': 'Peindre « {name} » affine son maillage et la pièce ne sera plus modifiable par paramètres (dimensions, segments). Vous pouvez annuler le trait pour la retrouver intacte.',
  'paint.parametric.paint': 'Peindre quand même',
  'paint.parametric.paintAlways': 'Peindre quand même et ne plus demander',
  'scene.clear.title': 'Vider le plateau',
  'scene.clear.message.one': '1 objet sera retiré du plateau. Vous pourrez l’annuler juste après.',
  'scene.clear.message.other': '{count} objets seront retirés du plateau. Vous pourrez l’annuler juste après.',
  'scene.clear.confirm': 'Vider le plateau',
  'toast.sceneCleared.one': 'Plateau vidé (1 objet)',
  'toast.sceneCleared.other': 'Plateau vidé ({count} objets)',
  'toast.undo': 'Annuler',
  'printWarning.SEALED_CAVITY': 'Cavité fermée sans issue ({volume} cm³ enfermés) : impossible de la vider ou de la nettoyer. Ajoutez un trou de drainage si vous devez évacuer de la matière.',
  'toast.hollowSealed': 'Il reste une cavité fermée sans issue. Pour la vider, évidez avec un trou de drainage.',
  'ctx.hollowOpen': 'Évider la pièce…',
  'ctx.hollowOpenTip': 'Ouvre le panneau d’évidement avec la paroi par défaut (2,2 mm)',
  'toast.hollowPanelOpened': 'Réglez la paroi et appuyez sur « Évider ». Sans trou de drainage, une cavité fermée reste.',
};

export const FLOWUX_HI = {
  'repeat.done': 'दोहराया गया: {name}',
  'paint.parametric.title': 'रंगने से पैरामीटर हट जाते हैं',
  'paint.parametric.message': '«{name}» को रंगने पर उसकी जाली बारीक हो जाती है और पुर्ज़ा पैरामीटर (माप, खंड) से संपादित नहीं रहेगा। स्ट्रोक को पूर्ववत करके उसे वैसा ही वापस पा सकते हैं।',
  'paint.parametric.paint': 'फिर भी रंगें',
  'paint.parametric.paintAlways': 'फिर भी रंगें और दोबारा न पूछें',
  'scene.clear.title': 'बेड खाली करें',
  'scene.clear.message.one': 'बेड से 1 ऑब्जेक्ट हटाया जाएगा। इसके बाद आप इसे पूर्ववत कर सकते हैं।',
  'scene.clear.message.other': 'बेड से {count} ऑब्जेक्ट हटाए जाएँगे। इसके बाद आप इसे पूर्ववत कर सकते हैं।',
  'scene.clear.confirm': 'बेड खाली करें',
  'toast.sceneCleared.one': 'बेड खाली किया (1 ऑब्जेक्ट)',
  'toast.sceneCleared.other': 'बेड खाली किया ({count} ऑब्जेक्ट)',
  'toast.undo': 'पूर्ववत करें',
  'printWarning.SEALED_CAVITY': 'बिना निकास की बंद गुहा ({volume} cm³ बंद): इसे खाली या साफ़ नहीं किया जा सकता। सामग्री निकालनी हो तो ड्रेन होल जोड़ें।',
  'toast.hollowSealed': 'बिना निकास की एक बंद गुहा बची है। खाली करनी हो तो ड्रेन होल के साथ खोखला करें।',
  'ctx.hollowOpen': 'पुर्ज़ा खोखला करें…',
  'ctx.hollowOpenTip': 'डिफ़ॉल्ट दीवार (2,2 mm) के साथ खोखला करने का पैनल खोलता है',
  'toast.hollowPanelOpened': 'दीवार तय करें और «खोखला करें» दबाएँ। ड्रेन होल के बिना बंद गुहा बचती है।',
};

export const FLOWUX_ZH = {
  'repeat.done': '已重复：{name}',
  'paint.parametric.title': '上色会移除参数',
  'paint.parametric.message': '给“{name}”上色会细化其网格，该零件将不能再通过参数（尺寸、分段）编辑。撤销该笔画即可原样恢复。',
  'paint.parametric.paint': '仍然上色',
  'paint.parametric.paintAlways': '仍然上色且不再询问',
  'scene.clear.title': '清空热床',
  'scene.clear.message.one': '将从热床移除 1 个对象。之后可以撤销。',
  'scene.clear.message.other': '将从热床移除 {count} 个对象。之后可以撤销。',
  'scene.clear.confirm': '清空热床',
  'toast.sceneCleared.one': '热床已清空（1 个对象）',
  'toast.sceneCleared.other': '热床已清空（{count} 个对象）',
  'toast.undo': '撤销',
  'printWarning.SEALED_CAVITY': '存在无出口的封闭空腔（封闭 {volume} cm³）：无法清空或清理。如需排出材料，请添加排料孔。',
  'toast.hollowSealed': '仍留有无出口的封闭空腔。如需清空，请带排料孔抽壳。',
  'ctx.hollowOpen': '抽壳…',
  'ctx.hollowOpenTip': '打开抽壳面板，默认壁厚 2.2 mm',
  'toast.hollowPanelOpened': '设置壁厚并点击“抽壳”。没有排料孔时会留下封闭空腔。',
};
