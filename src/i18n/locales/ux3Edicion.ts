/**
 * @file src/i18n/locales/ux3Edicion.ts
 * @description Textos de la tercera revisión de usabilidad de edición (F4, árbol de Escena, Organizar, avisos de
 * operaciones, pintura, reparación) en los 6 idiomas. Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const UX3_EDICION_TABLE = {
  'ux3.repeat.dropToBed': ['Apoyar en la cama', 'Drop to bed', 'Aufs Druckbett legen', 'Poser sur le plateau', 'बेड पर रखें', '放到打印床上'],
  'ux3.repeat.resetOrientation': ['Restablecer orientación', 'Reset orientation', 'Ausrichtung zurücksetzen', 'Réinitialiser l’orientation', 'अभिविन्यास रीसेट करें', '重置方向'],
  'ux3.repeat.resetRotation': ['Restablecer rotación', 'Reset rotation', 'Drehung zurücksetzen', 'Réinitialiser la rotation', 'घुमाव रीसेट करें', '重置旋转'],
  'ux3.repeat.resetScale': ['Restablecer escala', 'Reset scale', 'Skalierung zurücksetzen', 'Réinitialiser l’échelle', 'स्केल रीसेट करें', '重置缩放'],
  'ux3.repeat.align': ['Alinear objetos', 'Align objects', 'Objekte ausrichten', 'Aligner les objets', 'ऑब्जेक्ट संरेखित करें', '对齐对象'],
  'ux3.repeat.arrange': ['Distribuir en la cama', 'Arrange on the bed', 'Auf dem Druckbett verteilen', 'Répartir sur le plateau', 'बेड पर व्यवस्थित करें', '在打印床上排列'],
  'ux3.repeat.material': ['Aplicar material', 'Apply material', 'Material anwenden', 'Appliquer le matériau', 'सामग्री लागू करें', '应用材料'],
} as const satisfies Record<string, Row>;

type Ux3EdicionKey = keyof typeof UX3_EDICION_TABLE;

const pick = (index: number): Record<Ux3EdicionKey, string> =>
  Object.fromEntries(Object.entries(UX3_EDICION_TABLE).map(([key, row]) => [key, row[index]])) as Record<Ux3EdicionKey, string>;

export const UX3_EDICION_ES = pick(0);
export const UX3_EDICION_EN = pick(1);
export const UX3_EDICION_DE = pick(2);
export const UX3_EDICION_FR = pick(3);
export const UX3_EDICION_HI = pick(4);
export const UX3_EDICION_ZH = pick(5);
