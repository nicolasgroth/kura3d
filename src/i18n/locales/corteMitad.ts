/**
 * @file src/i18n/locales/corteMitad.ts
 * @description Textos de "¿Dónde dejar la mitad que conservas?" en el corte por plano (dejarla donde está,
 * apoyarla en la cama o apoyarla en un lugar libre), la ayuda cuando se conservan ambas mitades y los
 * avisos de resultado, en los 6 idiomas. Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const CORTE_MITAD_TABLE = {
  'corteMitad.group': [
    '¿Dónde dejar la mitad que conservas?',
    'Where should the half you keep end up?',
    'Wo soll die behaltene Hälfte liegen?',
    'Où placer la moitié que vous gardez ?',
    'आप जो आधा रखते हैं उसे कहाँ रखें?',
    '保留的那一半放在哪里?',
  ],
  'corteMitad.inPlace': ['Dejarla donde está', 'Leave it where it is', 'Dort lassen, wo sie ist', 'La laisser où elle est', 'जहाँ है वहीं रहने दें', '保持原位'],
  'corteMitad.inPlaceDesc': [
    'Queda flotando sobre la cama. Útil si después la vas a unir con otra pieza.',
    'It stays floating above the bed. Useful if you will join it to another part later.',
    'Sie schwebt über dem Druckbett. Praktisch, wenn du sie später mit einem anderen Teil verbindest.',
    'Elle reste en suspension au-dessus du plateau. Utile si vous l’assemblez ensuite à une autre pièce.',
    'यह बेड के ऊपर हवा में रहता है। बाद में किसी दूसरे पीस से जोड़ना हो तो उपयोगी।',
    '悬浮在打印床上方。之后要与其他零件拼接时很有用。',
  ],
  'corteMitad.drop': ['Apoyarla en la cama', 'Rest it on the bed', 'Auf dem Druckbett ablegen', 'La poser sur le plateau', 'बेड पर टिकाएँ', '放到打印床上'],
  'corteMitad.dropDesc': [
    'Baja en Z hasta tocar la cama, en el mismo lugar (X e Y no cambian).',
    'It moves down in Z until it touches the bed, in the same place (X and Y do not change).',
    'Sie sinkt in Z, bis sie das Druckbett berührt, am selben Ort (X und Y bleiben gleich).',
    'Elle descend en Z jusqu’à toucher le plateau, au même endroit (X et Y ne changent pas).',
    'यह Z में नीचे आकर बेड को छूता है, उसी जगह (X और Y नहीं बदलते)।',
    '沿 Z 下移直到接触打印床,位置不变(X、Y 不变)。',
  ],
  'corteMitad.free': ['Apoyarla en un lugar libre', 'Rest it in a free spot', 'In einem freien Bereich ablegen', 'La poser dans un emplacement libre', 'खाली जगह पर टिकाएँ', '放到空闲位置'],
  'corteMitad.freeDesc': [
    'La apoya en un hueco libre de la cama, sin tocar otros objetos; deja despejado el lugar original.',
    'It rests in a free area of the bed without touching other objects; the original spot is left clear.',
    'Sie wird in einem freien Bereich des Druckbetts abgelegt, ohne andere Objekte zu berühren; der ursprüngliche Platz bleibt frei.',
    'Elle est posée dans une zone libre du plateau sans toucher d’autres objets ; l’emplacement d’origine reste dégagé.',
    'यह बेड के खाली हिस्से में टिकता है, दूसरे ऑब्जेक्ट को छुए बिना; मूल जगह खाली रहती है।',
    '放到打印床的空闲区域,不碰其他对象;原位置保持空出。',
  ],
  'corteMitad.overlap': [
    'Se superpondría con «{names}». Prueba «Apoyarla en un lugar libre».',
    'It would overlap «{names}». Try “Rest it in a free spot”.',
    'Sie würde «{names}» überlappen. Wähle «In einem freien Bereich ablegen».',
    'Elle chevaucherait « {names} ». Essayez « La poser dans un emplacement libre ».',
    '«{names}» से टकराएगा। «खाली जगह पर टिकाएँ» आज़माएँ।',
    '会与「{names}」重叠。请改选“放到空闲位置”。',
  ],
  'corteMitad.bothHelp': [
    'Conservas las dos mitades: quedan en su lugar.',
    'You keep both halves: they stay in place.',
    'Du behältst beide Hälften: Sie bleiben an ihrem Platz.',
    'Vous gardez les deux moitiés : elles restent en place.',
    'आप दोनों हिस्से रखते हैं: वे अपनी जगह पर रहते हैं।',
    '保留两半:它们保持在原位。',
  ],
  'toast.cutKeptDropped': [
    'Corte por plano completado: {half} apoyada en la cama',
    'Plane cut complete: {half} rests on the bed',
    'Ebenenschnitt abgeschlossen: {half} liegt auf dem Druckbett',
    'Coupe par plan terminée : {half} posée sur le plateau',
    'प्लेन कट पूरा: {half} बेड पर टिका है',
    '平面切割完成:{half} 已放到打印床上',
  ],
  'toast.cutKeptFreeSpot': [
    'Corte por plano completado: {half} apoyada en un lugar libre de la cama',
    'Plane cut complete: {half} rests in a free spot of the bed',
    'Ebenenschnitt abgeschlossen: {half} liegt in einem freien Bereich des Druckbetts',
    'Coupe par plan terminée : {half} posée dans un emplacement libre du plateau',
    'प्लेन कट पूरा: {half} बेड की खाली जगह पर टिका है',
    '平面切割完成:{half} 已放到打印床的空闲位置',
  ],
  'toast.cutKeptOverlaps': [
    '{half} se superpone en planta con «{names}». Muévela o deshaz y elige un lugar libre.',
    '{half} overlaps «{names}» in plan view. Move it, or undo and pick a free spot.',
    '{half} überlappt «{names}» in der Draufsicht. Verschiebe sie oder mache rückgängig und wähle einen freien Bereich.',
    '{half} chevauche « {names} » en plan. Déplacez-la ou annulez et choisissez un emplacement libre.',
    '{half} ऊपर से देखने पर «{names}» से टकराता है। इसे हटाएँ या पूर्ववत करके खाली जगह चुनें।',
    '{half} 在俯视图中与「{names}」重叠。请移动它,或撤销后选择空闲位置。',
  ],
} as const satisfies Record<string, Row>;

type CorteMitadKey = keyof typeof CORTE_MITAD_TABLE;

const pick = (index: number): Record<CorteMitadKey, string> =>
  Object.fromEntries(Object.entries(CORTE_MITAD_TABLE).map(([key, row]) => [key, row[index]])) as Record<CorteMitadKey, string>;

export const CORTEMITAD_ES = pick(0);
export const CORTEMITAD_EN = pick(1);
export const CORTEMITAD_DE = pick(2);
export const CORTEMITAD_FR = pick(3);
export const CORTEMITAD_HI = pick(4);
export const CORTEMITAD_ZH = pick(5);
