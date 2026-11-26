/**
 * @file src/i18n/locales/suavizarMotor.ts
 * @description Mensajes del motor de «Suavizar malla» (error de daño y avisos de fuerza reducida,
 * cambio de volumen y sin efecto) en los 6 idiomas. Se mezclan en cada diccionario de
 * `translations.ts` y `locales/*.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export const SUAVIZAR_ES = {
  'engineError.SMOOTH_DAMAGE':
    'El suavizado dañaba la malla ({inverted} triángulos invertidos, {intersections} cruces nuevos) incluso con fuerza {strength}; no se aplicó. Prueba con menos iteraciones, protege las aristas vivas o limita la zona.',
  'engineWarning.SMOOTH_STRENGTH_REDUCED':
    'Con fuerza {requested} el suavizado invertía triángulos o cruzaba paredes finas; se aplicó con fuerza {applied}.',
  'engineWarning.SMOOTH_VOLUME_CHANGED': 'El suavizado cambió el volumen en {pct} %.',
  'engineWarning.SMOOTH_NO_EFFECT':
    'No hay vértices que suavizar: la zona está vacía o todos sus vértices están en aristas vivas o bordes protegidos ({locked} fijos).',
};

type Dict = Record<keyof typeof SUAVIZAR_ES, string>;

export const SUAVIZAR_EN: Dict = {
  'engineError.SMOOTH_DAMAGE':
    'Smoothing damaged the mesh ({inverted} flipped triangles, {intersections} new crossings) even at strength {strength}; it was not applied. Try fewer iterations, protect sharp edges or limit the zone.',
  'engineWarning.SMOOTH_STRENGTH_REDUCED':
    'At strength {requested} smoothing flipped triangles or crossed thin walls; it was applied at strength {applied}.',
  'engineWarning.SMOOTH_VOLUME_CHANGED': 'Smoothing changed the volume by {pct} %.',
  'engineWarning.SMOOTH_NO_EFFECT':
    'There are no vertices to smooth: the zone is empty or all its vertices are on protected sharp edges or borders ({locked} fixed).',
};

export const SUAVIZAR_DE: Dict = {
  'engineError.SMOOTH_DAMAGE':
    'Das Glätten beschädigte das Netz ({inverted} umgedrehte Dreiecke, {intersections} neue Überschneidungen), selbst mit Stärke {strength}; es wurde nicht angewendet. Weniger Iterationen versuchen, scharfe Kanten schützen oder den Bereich begrenzen.',
  'engineWarning.SMOOTH_STRENGTH_REDUCED':
    'Mit Stärke {requested} drehte das Glätten Dreiecke um oder durchdrang dünne Wände; es wurde mit Stärke {applied} angewendet.',
  'engineWarning.SMOOTH_VOLUME_CHANGED': 'Das Glätten veränderte das Volumen um {pct} %.',
  'engineWarning.SMOOTH_NO_EFFECT':
    'Keine Eckpunkte zum Glätten: Der Bereich ist leer oder alle Eckpunkte liegen auf geschützten scharfen Kanten oder Rändern ({locked} fixiert).',
};

export const SUAVIZAR_FR: Dict = {
  'engineError.SMOOTH_DAMAGE':
    'Le lissage endommageait le maillage ({inverted} triangles retournés, {intersections} nouveaux croisements) même avec la force {strength} ; il n’a pas été appliqué. Essayez moins d’itérations, protégez les arêtes vives ou limitez la zone.',
  'engineWarning.SMOOTH_STRENGTH_REDUCED':
    'Avec la force {requested}, le lissage retournait des triangles ou traversait des parois fines ; il a été appliqué avec la force {applied}.',
  'engineWarning.SMOOTH_VOLUME_CHANGED': 'Le lissage a modifié le volume de {pct} %.',
  'engineWarning.SMOOTH_NO_EFFECT':
    'Aucun sommet à lisser : la zone est vide ou tous ses sommets sont sur des arêtes vives ou des bords protégés ({locked} fixes).',
};

export const SUAVIZAR_HI: Dict = {
  'engineError.SMOOTH_DAMAGE':
    'स्मूदिंग से मेश खराब हो रहा था ({inverted} उलटे त्रिकोण, {intersections} नए क्रॉसिंग), शक्ति {strength} पर भी; इसे लागू नहीं किया गया। कम पुनरावृत्तियाँ आज़माएँ, तीखे किनारे सुरक्षित करें या क्षेत्र सीमित करें।',
  'engineWarning.SMOOTH_STRENGTH_REDUCED':
    'शक्ति {requested} पर स्मूदिंग त्रिकोण उलट रही थी या पतली दीवारें पार कर रही थी; इसे शक्ति {applied} पर लागू किया गया।',
  'engineWarning.SMOOTH_VOLUME_CHANGED': 'स्मूदिंग से आयतन {pct} % बदला।',
  'engineWarning.SMOOTH_NO_EFFECT':
    'स्मूद करने के लिए कोई शीर्ष नहीं: क्षेत्र खाली है या उसके सभी शीर्ष सुरक्षित तीखे किनारों या सीमाओं पर हैं ({locked} स्थिर)।',
};

export const SUAVIZAR_ZH: Dict = {
  'engineError.SMOOTH_DAMAGE':
    '平滑会损坏网格（{inverted} 个三角形翻转，{intersections} 处新交叉），即使强度为 {strength} 也是如此；未应用。请减少迭代次数、保护锐边或限制区域。',
  'engineWarning.SMOOTH_STRENGTH_REDUCED': '强度 {requested} 时平滑会翻转三角形或穿过薄壁；已按强度 {applied} 应用。',
  'engineWarning.SMOOTH_VOLUME_CHANGED': '平滑使体积变化了 {pct} %。',
  'engineWarning.SMOOTH_NO_EFFECT': '没有可平滑的顶点：区域为空，或其所有顶点都位于受保护的锐边或边界上（{locked} 个固定）。',
};
