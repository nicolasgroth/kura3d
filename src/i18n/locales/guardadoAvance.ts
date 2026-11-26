/**
 * @file src/i18n/locales/guardadoAvance.ts
 * @description Textos del avance al guardar un proyecto (barra de operación del visor) en los 6 idiomas.
 * Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const SAVE_PROGRESS_TABLE = {
  'progress.op.project_save': [
    'Guardando el proyecto',
    'Saving the project',
    'Projekt wird gespeichert',
    'Enregistrement du projet',
    'प्रोजेक्ट सहेजा जा रहा है',
    '正在保存项目',
  ],
  'saveProgress.encode': [
    'Preparando la escena y el historial',
    'Preparing the scene and history',
    'Szene und Verlauf werden vorbereitet',
    'Préparation de la scène et de l’historique',
    'दृश्य और इतिहास तैयार हो रहे हैं',
    '正在准备场景和历史记录',
  ],
  'saveProgress.compress': [
    'Comprimiendo',
    'Compressing',
    'Wird komprimiert',
    'Compression',
    'संपीड़ित हो रहा है',
    '正在压缩',
  ],
  'saveProgress.write': [
    'Escribiendo el archivo',
    'Writing the file',
    'Datei wird geschrieben',
    'Écriture du fichier',
    'फ़ाइल लिखी जा रही है',
    '正在写入文件',
  ],
  'saveProgress.percent': [
    '{percent} %',
    '{percent}%',
    '{percent} %',
    '{percent} %',
    '{percent}%',
    '{percent}%',
  ],
} as const satisfies Record<string, Row>;

type SaveProgressKey = keyof typeof SAVE_PROGRESS_TABLE;

const pick = (index: number): Record<SaveProgressKey, string> =>
  Object.fromEntries(Object.entries(SAVE_PROGRESS_TABLE).map(([key, row]) => [key, (row as Row)[index]])) as Record<SaveProgressKey, string>;

export const SAVE_PROGRESS_ES = pick(0);
export const SAVE_PROGRESS_EN = pick(1);
export const SAVE_PROGRESS_DE = pick(2);
export const SAVE_PROGRESS_FR = pick(3);
export const SAVE_PROGRESS_HI = pick(4);
export const SAVE_PROGRESS_ZH = pick(5);
