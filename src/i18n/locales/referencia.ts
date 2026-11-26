/**
 * @file src/i18n/locales/referencia.ts
 * @description Textos de los objetos de referencia (se ven y se miden, no se imprimen ni exportan):
 * tipo en menús, árbol e inspector, opacidad, importar como referencia, avisos de exportación y de
 * operaciones que no la aceptan, en los 6 idiomas. Se define por clave con sus 6 traducciones
 * [es, en, de, fr, hi, zh] y se mezcla en cada diccionario de `translations.ts` y `locales/*.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const REFERENCE_TABLE = {
  'menu.type.reference': ['Referencia', 'Reference', 'Referenz', 'Référence', 'संदर्भ', '参考'],
  'inspector.role.reference': ['Referencia', 'Reference', 'Referenz', 'Référence', 'संदर्भ', '参考'],
  'inspector.role.referenceTip': [
    'Se ve y se mide, pero no se imprime, no se exporta ni se resta',
    'Visible and measurable, but never printed, exported or subtracted',
    'Sichtbar und messbar, wird aber nie gedruckt, exportiert oder abgezogen',
    'Visible et mesurable, mais jamais imprimée, exportée ni soustraite',
    'दिखता है और मापा जा सकता है, पर कभी प्रिंट, निर्यात या घटाया नहीं जाता',
    '可见且可测量,但不会打印、导出或被减去',
  ],
  'reference.opacity': ['Opacidad', 'Opacity', 'Deckkraft', 'Opacité', 'अपारदर्शिता', '不透明度'],
  'reference.opacity.reset': ['Usar la de Ajustes', 'Use the Settings value', 'Wert aus Einstellungen', 'Valeur des Réglages', 'सेटिंग्स का मान', '使用设置中的值'],
  'groups.tree.type.reference': ['Referencia', 'Reference', 'Referenz', 'Référence', 'संदर्भ', '参考'],
  'sidebar.scene.referenceBadge': ['REF.', 'REF.', 'REF.', 'RÉF.', 'संदर्भ', '参考'],
  'import.asReference': ['Importar como referencia…', 'Import as reference…', 'Als Referenz importieren…', 'Importer comme référence…', 'संदर्भ के रूप में आयात करें…', '作为参考导入…'],
  'import.asReference.hint': [
    'Para comprobar medidas contra una pieza real: se ve, no se imprime ni se exporta',
    'To check sizes against a real part: visible, never printed or exported',
    'Zum Abgleich mit einem echten Teil: sichtbar, wird nie gedruckt oder exportiert',
    'Pour vérifier les cotes face à une pièce réelle : visible, jamais imprimée ni exportée',
    'असली भाग से माप जाँचने के लिए: दिखता है, कभी प्रिंट या निर्यात नहीं होता',
    '用于对照实物核对尺寸:可见,不会打印或导出',
  ],
  'settings.referenceOpacity': ['Opacidad de las referencias', 'Reference opacity', 'Deckkraft von Referenzen', 'Opacité des références', 'संदर्भों की अपारदर्शिता', '参考对象不透明度'],
  'settings.referenceOpacity.hint': [
    'Se usa en cada referencia que no tiene una opacidad propia.',
    'Used by every reference without its own opacity.',
    'Gilt für jede Referenz ohne eigene Deckkraft.',
    'S’applique à chaque référence sans opacité propre.',
    'हर उस संदर्भ पर लागू जिसकी अपनी अपारदर्शिता नहीं है।',
    '用于所有未单独设置不透明度的参考对象。',
  ],
  'reference.export.skipped.one': [
    '{count} referencia no se exporta: las referencias solo viven en el proyecto.',
    '{count} reference is not exported: references only live in the project.',
    '{count} Referenz wird nicht exportiert: Referenzen bleiben im Projekt.',
    '{count} référence n’est pas exportée : les références restent dans le projet.',
    '{count} संदर्भ निर्यात नहीं हुआ: संदर्भ केवल प्रोजेक्ट में रहते हैं।',
    '{count} 个参考对象未导出:参考对象只保存在项目中。',
  ],
  'reference.export.skipped.other': [
    '{count} referencias no se exportan: las referencias solo viven en el proyecto.',
    '{count} references are not exported: references only live in the project.',
    '{count} Referenzen werden nicht exportiert: Referenzen bleiben im Projekt.',
    '{count} références ne sont pas exportées : les références restent dans le projet.',
    '{count} संदर्भ निर्यात नहीं हुए: संदर्भ केवल प्रोजेक्ट में रहते हैं।',
    '{count} 个参考对象未导出:参考对象只保存在项目中。',
  ],
  'reference.toast.notAllowed': [
    'Las referencias no participan en esta operación. Conviértela en sólido si quieres usarla.',
    'References do not take part in this operation. Convert it to a solid to use it.',
    'Referenzen nehmen an diesem Vorgang nicht teil. Wandle sie in einen Volumenkörper um, um sie zu verwenden.',
    'Les références ne participent pas à cette opération. Convertissez-la en solide pour l’utiliser.',
    'संदर्भ इस क्रिया में शामिल नहीं होते। उपयोग के लिए इसे ठोस में बदलें।',
    '参考对象不参与此操作。如需使用,请先转换为实体。',
  ],
  'engineError.REFERENCE_NOT_ALLOWED': [
    'Una referencia no participa en esta operación: conviértela en sólido primero.',
    'A reference cannot take part in this operation: convert it to a solid first.',
    'Eine Referenz kann an diesem Vorgang nicht teilnehmen: zuerst in einen Volumenkörper umwandeln.',
    'Une référence ne peut pas participer à cette opération : convertissez-la d’abord en solide.',
    'संदर्भ इस क्रिया में भाग नहीं ले सकता: पहले इसे ठोस में बदलें।',
    '参考对象不能参与此操作:请先转换为实体。',
  ],
  'reference.status.count.one': ['{count} referencia', '{count} reference', '{count} Referenz', '{count} référence', '{count} संदर्भ', '{count} 个参考'],
  'reference.status.count.other': ['{count} referencias', '{count} references', '{count} Referenzen', '{count} références', '{count} संदर्भ', '{count} 个参考'],
} as const satisfies Record<string, Row>;

type ReferenceKey = keyof typeof REFERENCE_TABLE;

const pick = (index: number): Record<ReferenceKey, string> =>
  Object.fromEntries(Object.entries(REFERENCE_TABLE).map(([key, row]) => [key, row[index]])) as Record<ReferenceKey, string>;

export const REFERENCE_ES = pick(0);
export const REFERENCE_EN = pick(1);
export const REFERENCE_DE = pick(2);
export const REFERENCE_FR = pick(3);
export const REFERENCE_HI = pick(4);
export const REFERENCE_ZH = pick(5);
