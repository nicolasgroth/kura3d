/**
 * @file src/i18n/locales/genMotor.ts
 * @description Avisos y errores tipados del motor para separar por colores, proyección sobre superficie,
 * texturas, envolvente convexa y generadores, en los 6 idiomas. Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
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
