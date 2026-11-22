/**
 * @file src/i18n/locales/fix10.ts
 * @description Textos de la ronda de correcciones 10 en los 6 idiomas: error de SVG con solo trazos sin
 * relleno y máximo del conector del corte por plano expresado como diámetro Ø. Cada clave se escribe una
 * vez con sus 6 idiomas; `FIX10_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const FIX10 = {
  'engineError.SVG_STROKES_ONLY': {
    es: 'Este SVG solo tiene líneas sin relleno; convierte los trazos en formas rellenas (en tu editor: «Trazo a contorno» o «Contornear trazo») y vuelve a importarlo.',
    en: 'This SVG only has unfilled lines; convert the strokes into filled shapes (in your editor: "Stroke to Path" or "Outline Stroke") and import it again.',
    de: 'Dieses SVG enthält nur Linien ohne Füllung; wandle die Konturen in gefüllte Formen um (im Editor: „Kontur in Pfad“ oder „Pfad umwandeln“) und importiere es erneut.',
    fr: 'Ce SVG ne contient que des lignes sans remplissage ; convertis les contours en formes remplies (dans ton éditeur : « Contour en chemin » ou « Vectoriser le contour ») et importe-le à nouveau.',
    hi: 'इस SVG में केवल बिना भराव वाली रेखाएँ हैं; स्ट्रोक को भरी हुई आकृतियों में बदलें (अपने एडिटर में: "Stroke to Path" या "Outline Stroke") और फिर से इम्पोर्ट करें।',
    zh: '此 SVG 只有无填充的线条；请将描边转换为填充形状（在编辑器中使用“描边转路径”或“轮廓化描边”），然后重新导入。',
  },
  'dialog.cut.maxDiameterFor': {
    es: 'Máximo para esta pieza: Ø{max} mm', en: 'Maximum for this part: Ø{max} mm', de: 'Maximum für dieses Teil: Ø{max} mm',
    fr: 'Maximum pour cette pièce : Ø{max} mm', hi: 'इस भाग के लिए अधिकतम: Ø{max} mm', zh: '此部件最大值：Ø{max} mm',
  },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof FIX10]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(FIX10).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const FIX10_ES = pick('es');
export const FIX10_EN = pick('en');
export const FIX10_DE = pick('de');
export const FIX10_FR = pick('fr');
export const FIX10_HI = pick('hi');
export const FIX10_ZH = pick('zh');
