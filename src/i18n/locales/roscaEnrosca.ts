/**
 * @file src/i18n/locales/roscaEnrosca.ts
 * @description Textos de «roscas que enroscan» en los 6 idiomas: el resultado de la comprobación de enroscado (asistente
 * del recipiente con tapa roscada y pareja de roscas del diálogo) y la opción de crear la pareja en el diálogo de roscas.
 * Cada clave lleva [es, en, de, fr, hi, zh]; `ROSCA_ENROSCA_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const TABLE = {
  'screwFit.ok': [
    'Enrosca: holgura mínima {mm} mm',
    'Screws on: minimum clearance {mm} mm',
    'Lässt sich schrauben: kleinstes Spiel {mm} mm',
    'Se visse : jeu minimal {mm} mm',
    'कसता है: न्यूनतम ढील {mm} mm',
    '可以拧入:最小间隙 {mm} mm',
  ],
  'screwFit.tight': [
    'Sin holgura suficiente: {mm} mm en el punto más justo (menos de 0,1 mm se pega al imprimir). Sube la holgura.',
    'Not enough clearance: {mm} mm at the tightest spot (under 0.1 mm fuses when printed). Raise the clearance.',
    'Zu wenig Spiel: {mm} mm an der engsten Stelle (unter 0,1 mm verschmilzt beim Drucken). Erhöhe das Spiel.',
    'Jeu insuffisant : {mm} mm au point le plus serré (sous 0,1 mm, ça se soude à l’impression). Augmente le jeu.',
    'ढील कम है: सबसे तंग जगह पर {mm} mm (0.1 mm से कम छपाई में चिपक जाती है)। ढील बढ़ाएँ।',
    '间隙不足:最紧处 {mm} mm(低于 0.1 mm 打印时会粘连)。请调大间隙。',
  ],
  'screwFit.interference': [
    'Interferencia: las roscas se cruzan ({mm3} mm³) al enroscar. Sube la holgura.',
    'Interference: the threads overlap ({mm3} mm³) while screwing. Raise the clearance.',
    'Überschneidung: Die Gewinde überlappen sich beim Schrauben ({mm3} mm³). Erhöhe das Spiel.',
    'Interférence : les filetages se chevauchent ({mm3} mm³) en vissant. Augmente le jeu.',
    'टकराव: कसते समय चूड़ियाँ एक-दूसरे में घुसती हैं ({mm3} mm³)। ढील बढ़ाएँ।',
    '干涉:拧入时螺纹相互重叠({mm3} mm³)。请调大间隙。',
  ],
  'screwFit.checking': [
    'Comprobando que enrosque…',
    'Checking that it screws on…',
    'Prüfe, ob es sich schrauben lässt …',
    'Vérification du vissage…',
    'जाँच रहे हैं कि यह कसता है…',
    '正在检查能否拧入……',
  ],
  'dialog.thread.pair': [
    'Crear la pareja que enrosca',
    'Create the matching pair',
    'Passendes Paar erstellen',
    'Créer la paire qui se visse',
    'मेल खाती जोड़ी बनाएँ',
    '创建配对螺纹',
  ],
  'dialog.thread.pairTip': [
    'Crea las dos piezas lado a lado con la holgura aplicada y comprueba que enrosquen.',
    'Creates both parts side by side with the clearance applied and checks that they screw together.',
    'Erstellt beide Teile nebeneinander mit dem Spiel und prüft, ob sie sich verschrauben lassen.',
    'Crée les deux pièces côte à côte avec le jeu appliqué et vérifie qu’elles se vissent.',
    'दोनों भाग ढील के साथ अगल-बगल बनाता है और जाँचता है कि वे कसते हैं।',
    '并排创建两个零件并应用间隙,同时检查能否拧合。',
  ],
  'dialog.thread.pairBoltNut': [
    'Perno + tuerca',
    'Bolt + nut',
    'Schraube + Mutter',
    'Vis + écrou',
    'बोल्ट + नट',
    '螺栓 + 螺母',
  ],
  'dialog.thread.pairHoleBolt': [
    'Agujero roscado + perno',
    'Threaded hole + bolt',
    'Gewindeloch + Schraube',
    'Trou taraudé + vis',
    'चूड़ीदार छेद + बोल्ट',
    '螺纹孔 + 螺栓',
  ],
  'dialog.thread.executePair': [
    'Crear pareja',
    'Create pair',
    'Paar erstellen',
    'Créer la paire',
    'जोड़ी बनाएँ',
    '创建配对',
  ],
  // Acople de tubería a presión: mismo chequeo, sin hélice (la hembra a tope en el hombro).
  'pressFit.ok': [
    'Encaja: holgura mínima {mm} mm',
    'Fits: minimum clearance {mm} mm',
    'Passt: kleinstes Spiel {mm} mm',
    'S’emboîte : jeu minimal {mm} mm',
    'फ़िट होता है: न्यूनतम ढील {mm} mm',
    '可以插入:最小间隙 {mm} mm',
  ],
  'pressFit.tight': [
    'Sin holgura suficiente: {mm} mm en el punto más justo (menos de 0,1 mm se pega al imprimir). Sube la holgura.',
    'Not enough clearance: {mm} mm at the tightest spot (under 0.1 mm fuses when printed). Raise the clearance.',
    'Zu wenig Spiel: {mm} mm an der engsten Stelle (unter 0,1 mm verschmilzt beim Drucken). Erhöhe das Spiel.',
    'Jeu insuffisant : {mm} mm au point le plus serré (sous 0,1 mm, ça se soude à l’impression). Augmente le jeu.',
    'ढील कम है: सबसे तंग जगह पर {mm} mm (0.1 mm से कम छपाई में चिपक जाती है)। ढील बढ़ाएँ।',
    '间隙不足:最紧处 {mm} mm(低于 0.1 mm 打印时会粘连)。请调大间隙。',
  ],
  'pressFit.interference': [
    'Interferencia: la espiga y la boca se cruzan ({mm3} mm³). Sube la holgura.',
    'Interference: the spigot and the socket overlap ({mm3} mm³). Raise the clearance.',
    'Überschneidung: Zapfen und Muffe überlappen sich ({mm3} mm³). Erhöhe das Spiel.',
    'Interférence : l’embout et le manchon se chevauchent ({mm3} mm³). Augmente le jeu.',
    'टकराव: नली और सॉकेट एक-दूसरे में घुसते हैं ({mm3} mm³)। ढील बढ़ाएँ।',
    '干涉:插头与承口相互重叠({mm3} mm³)。请调大间隙。',
  ],
} satisfies Record<string, Row>;

type Key = keyof typeof TABLE;

const pick = (index: number) => Object.fromEntries(Object.entries(TABLE).map(([key, row]) => [key, row[index]])) as Record<Key, string>;

export const ROSCA_ENROSCA_ES = pick(0);
export const ROSCA_ENROSCA_EN = pick(1);
export const ROSCA_ENROSCA_DE = pick(2);
export const ROSCA_ENROSCA_FR = pick(3);
export const ROSCA_ENROSCA_HI = pick(4);
export const ROSCA_ENROSCA_ZH = pick(5);
