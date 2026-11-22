/**
 * @file src/i18n/locales/operationNotes.ts
 * @description Textos de la previa de uniones de "dividir para imprimir" (máximo sin medir el armado), de "Separar por colores" en sólidos (profundidad del color, color absorbido) y del
 * aviso de cambio de volumen al simplificar, en los 6 idiomas. Se mezclan en cada diccionario de
 * `translations.ts` y `locales/*.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export const OPNOTES_ES = {
  'bus.error.alignSpacing': 'spacingMm={value} no se admite: la grilla usa un paso fijo de {fixed} mm. Omite el parámetro.',
  'split.sum.jointsUpToValue': '{count}: hasta {with} con conector; el armado puede dejar algunas para pegar',
  'inspector.op.colorDepth': 'Profundidad del color',
  'inspector.op.colorDepthTip': 'Cada color pintado sale como pieza sólida que entra esta medida hacia adentro; el color base se queda con el resto.',
  'progress.op.split_colors': 'Separar por colores',
  'engineWarning.SPLIT_COLOR_ABSORBED': 'Colores sin volumen propio ({count}): {colors}. Otro color ocupó su capa; prueba con menos profundidad.',
  'engineWarning.SIMPLIFY_VOLUME_CHANGED': 'Simplificar cambió el volumen un {pct} %. Revisa la forma o usa una tolerancia menor.',
};

export const OPNOTES_EN = {
  'bus.error.alignSpacing': 'spacingMm={value} is not supported: the grid uses a fixed {fixed} mm spacing. Omit the parameter.',
  'split.sum.jointsUpToValue': '{count}: up to {with} with connector; assembly may leave some glue-only',
  'inspector.op.colorDepth': 'Color depth',
  'inspector.op.colorDepthTip': 'Each painted color becomes a solid part reaching this far inward; the base color keeps the rest.',
  'progress.op.split_colors': 'Split by colors',
  'engineWarning.SPLIT_COLOR_ABSORBED': 'Colors left without volume ({count}): {colors}. Another color took their layer; try a smaller depth.',
  'engineWarning.SIMPLIFY_VOLUME_CHANGED': 'Simplify changed the volume by {pct}%. Check the shape or use a smaller tolerance.',
};

export const OPNOTES_DE = {
  'bus.error.alignSpacing': 'spacingMm={value} wird nicht unterstützt: das Raster nutzt einen festen Abstand von {fixed} mm. Lass den Parameter weg.',
  'split.sum.jointsUpToValue': '{count}: bis zu {with} mit Verbinder; die Montage kann einige zum Kleben lassen',
  'inspector.op.colorDepth': 'Farbtiefe',
  'inspector.op.colorDepthTip': 'Jede bemalte Farbe wird ein festes Teil, das so tief nach innen reicht; die Grundfarbe behält den Rest.',
  'progress.op.split_colors': 'Nach Farben trennen',
  'engineWarning.SPLIT_COLOR_ABSORBED': 'Farben ohne eigenes Volumen ({count}): {colors}. Eine andere Farbe hat ihre Schicht belegt; versuche eine geringere Tiefe.',
  'engineWarning.SIMPLIFY_VOLUME_CHANGED': 'Vereinfachen hat das Volumen um {pct} % verändert. Prüfe die Form oder nutze eine kleinere Toleranz.',
};

export const OPNOTES_FR = {
  'bus.error.alignSpacing': 'spacingMm={value} n’est pas pris en charge : la grille utilise un pas fixe de {fixed} mm. Omets le paramètre.',
  'split.sum.jointsUpToValue': '{count} : jusqu’à {with} avec connecteur ; l’assemblage peut en laisser certaines à coller',
  'inspector.op.colorDepth': 'Profondeur de couleur',
  'inspector.op.colorDepthTip': 'Chaque couleur peinte devient une pièce pleine qui pénètre de cette mesure vers l’intérieur ; la couleur de base garde le reste.',
  'progress.op.split_colors': 'Séparer par couleurs',
  'engineWarning.SPLIT_COLOR_ABSORBED': 'Couleurs sans volume propre ({count}) : {colors}. Une autre couleur a pris leur couche ; essaie une profondeur plus faible.',
  'engineWarning.SIMPLIFY_VOLUME_CHANGED': 'La simplification a changé le volume de {pct} %. Vérifie la forme ou utilise une tolérance plus faible.',
};

export const OPNOTES_HI = {
  'bus.error.alignSpacing': 'spacingMm={value} समर्थित नहीं है: ग्रिड {fixed} mm की तय दूरी इस्तेमाल करता है। यह पैरामीटर छोड़ दें।',
  'split.sum.jointsUpToValue': '{count}: अधिकतम {with} कनेक्टर के साथ; जोड़ने का क्रम कुछ को केवल चिपकाने के लिए छोड़ सकता है',
  'inspector.op.colorDepth': 'रंग की गहराई',
  'inspector.op.colorDepthTip': 'हर रंगा हुआ रंग एक ठोस हिस्सा बनता है जो इतनी गहराई तक अंदर जाता है; आधार रंग बाकी रखता है।',
  'progress.op.split_colors': 'रंगों से अलग करें',
  'engineWarning.SPLIT_COLOR_ABSORBED': 'बिना अपने आयतन वाले रंग ({count}): {colors}। किसी दूसरे रंग ने उनकी परत ले ली; कम गहराई आज़माएँ।',
  'engineWarning.SIMPLIFY_VOLUME_CHANGED': 'सरल करने से आयतन {pct}% बदल गया। आकार जाँचें या कम सहनशीलता इस्तेमाल करें।',
};

export const OPNOTES_ZH = {
  'bus.error.alignSpacing': '不支持 spacingMm={value}：网格使用固定的 {fixed} mm 间距。请省略该参数。',
  'split.sum.jointsUpToValue': '{count}：最多 {with} 个带连接件；装配可能会留下一些仅粘合',
  'inspector.op.colorDepth': '颜色深度',
  'inspector.op.colorDepthTip': '每种绘制的颜色都会成为向内延伸此深度的实心部件；基础颜色保留其余部分。',
  'progress.op.split_colors': '按颜色拆分',
  'engineWarning.SPLIT_COLOR_ABSORBED': '没有自身体积的颜色（{count}）：{colors}。其他颜色占用了它们的层；请尝试更小的深度。',
  'engineWarning.SIMPLIFY_VOLUME_CHANGED': '简化使体积变化了 {pct}%。请检查形状或使用更小的公差。',
};
