/**
 * @file src/i18n/locales/genMotor.ts
 * @description Avisos y errores tipados del motor para separar por colores, proyección sobre superficie,
 * texturas, envolvente convexa y generadores, en los 6 idiomas. Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const GEN_MOTOR_TABLE = {
  'engineWarning.SPLIT_COLOR_PART_REPAIRED': [
    'Piezas de color que se repararon antes de entregarlas ({count}): {colors}. Ya son sólidos cerrados.',
    'Color pieces repaired before delivery ({count}): {colors}. They are now closed solids.',
    'Farbteile, die vor der Ausgabe repariert wurden ({count}): {colors}. Sie sind jetzt geschlossene Körper.',
    'Pièces de couleur réparées avant livraison ({count}) : {colors}. Ce sont maintenant des solides fermés.',
    'देने से पहले ठीक किए गए रंग भाग ({count}): {colors}। अब ये बंद ठोस हैं।',
    '交付前已修复的颜色件({count}):{colors}。现在它们是封闭实体。',
  ],
  'engineError.PROJECTION_COINCIDENT': [
    'La proyección coincide exactamente con una proyección anterior y no se pudo cerrar la malla. Muévela (U/V) o cambia un poco su tamaño.',
    'The projection exactly overlaps an earlier projection and the mesh could not be closed. Move it (U/V) or change its size slightly.',
    'Die Projektion deckt sich genau mit einer früheren Projektion, das Netz ließ sich nicht schließen. Verschiebe sie (U/V) oder ändere die Größe leicht.',
    'La projection coïncide exactement avec une projection précédente et le maillage n’a pas pu être fermé. Déplace-la (U/V) ou change un peu sa taille.',
    'प्रोजेक्शन पिछले प्रोजेक्शन से बिल्कुल मेल खाता है और मेश बंद नहीं हो सका। इसे (U/V) खिसकाएँ या आकार थोड़ा बदलें।',
    '投影与之前的投影完全重合,无法封闭网格。请移动它(U/V)或稍微改变尺寸。',
  ],
} as const satisfies Record<string, Row>;

type GenMotorKey = keyof typeof GEN_MOTOR_TABLE;

const pick = (index: number): Record<GenMotorKey, string> =>
  Object.fromEntries(Object.entries(GEN_MOTOR_TABLE).map(([key, row]) => [key, row[index]])) as Record<GenMotorKey, string>;

export const GEN_MOTOR_ES = pick(0);
export const GEN_MOTOR_EN = pick(1);
export const GEN_MOTOR_DE = pick(2);
export const GEN_MOTOR_FR = pick(3);
export const GEN_MOTOR_HI = pick(4);
export const GEN_MOTOR_ZH = pick(5);
