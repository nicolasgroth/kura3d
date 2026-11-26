/**
 * @file src/i18n/locales/usabN26b.ts
 * @description Textos de la segunda tanda de correcciones de usabilidad (nombre del lienzo del visor sin «plano de corte»,
 * nombre de placa repetido, aviso de «Mover a placa» y de «Repartir en placas») en los 6 idiomas.
 * Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const USAB_N26B_TABLE = {
  'viewport.canvasLabelBase': [
    'Visor 3D. F encuadra la selección.',
    '3D viewport. F frames the selection.',
    '3D-Ansichtsfenster. F rahmt die Auswahl ein.',
    'Vue 3D. F cadre la sélection.',
    '3D व्यूपोर्ट। F चयन को फ़्रेम करता है।',
    '3D 视图。F 框选所选对象。',
  ],
  'plates.rename.taken': [
    'Otra placa ya se llama «{name}». Escribe un nombre distinto.',
    'Another plate is already named "{name}". Enter a different name.',
    'Eine andere Platte heißt bereits „{name}“. Gib einen anderen Namen ein.',
    'Un autre plateau s’appelle déjà « {name} ». Saisis un autre nom.',
    'एक और प्लेट का नाम पहले से «{name}» है। कोई दूसरा नाम लिखें।',
    '已有另一块打印板名为“{name}”。请输入不同的名称。',
  ],
  'plates.toast.movedNoFit': [
    '{count} {count?pieza movida|piezas movidas} a «{name}», pero no cabe en su cama: sobresale. Reduce su tamaño o cambia la cama de la placa.',
    '{count} {count?part|parts} moved to “{name}”, but it does not fit its bed and overhangs. Scale it down or change the plate’s bed.',
    '{count} {count?Teil|Teile} nach „{name}“ verschoben, passt aber nicht auf das Druckbett und ragt über. Verkleinere es oder ändere das Bett der Platte.',
    '{count} {count?pièce déplacée|pièces déplacées} vers « {name} », mais elle ne tient pas sur son plateau et dépasse. Réduis sa taille ou change le plateau de la plaque.',
    '{count} {count?हिस्सा|हिस्से} “{name}” में ले जाए गए, पर वह उसके बेड पर नहीं समाता और बाहर निकलता है। उसे छोटा करें या प्लेट का बेड बदलें।',
    '已将 {count} 个零件移到“{name}”，但它放不进该板的打印床，会超出边缘。请缩小它，或更改该板的打印床。',
  ],
  'plates.bed.projectOptionName': [
    'Cama del proyecto: {bed}',
    'Project bed: {bed}',
    'Bett des Projekts: {bed}',
    'Plateau du projet : {bed}',
    'प्रोजेक्ट का बेड: {bed}',
    '项目打印床：{bed}',
  ],
} as const satisfies Record<string, Row>;

type UsabKey = keyof typeof USAB_N26B_TABLE;

const pick = (index: number): Record<UsabKey, string> =>
  Object.fromEntries(Object.entries(USAB_N26B_TABLE).map(([key, row]) => [key, (row as Row)[index]])) as Record<UsabKey, string>;

export const USAB_N26B_ES = pick(0);
export const USAB_N26B_EN = pick(1);
export const USAB_N26B_DE = pick(2);
export const USAB_N26B_FR = pick(3);
export const USAB_N26B_HI = pick(4);
export const USAB_N26B_ZH = pick(5);
