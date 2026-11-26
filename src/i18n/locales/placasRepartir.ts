/**
 * @file src/i18n/locales/placasRepartir.ts
 * @description Textos de «Repartir en placas» (lote P5) en los 6 idiomas: nombre de la acción en la paleta, aviso al
 * terminar (piezas, placas y las que no cupieron) y errores del bus. Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const PLATES_ARRANGE_TABLE = {
  'plates.action.arrange': ['Repartir en placas', 'Arrange on plates', 'Auf Platten verteilen', 'Répartir sur les plateaux', 'प्लेटों पर बाँटें', '分配到打印板'],
  'plates.arrange.toast.done': [
    '{count} {count?pieza repartida|piezas repartidas} en {plates} {plates?placa|placas}.',
    '{count} {count?part|parts} arranged on {plates} {plates?plate|plates}.',
    '{count} {count?Teil|Teile} auf {plates} {plates?Platte|Platten} verteilt.',
    '{count} {count?pièce répartie|pièces réparties} sur {plates} {plates?plateau|plateaux}.',
    '{count} {count?हिस्सा|हिस्से} {plates} {plates?प्लेट|प्लेटों} पर बाँटे गए।',
    '已将 {count} 个零件分配到 {plates} 块打印板。',
  ],
  'plates.arrange.toast.unplaced': [
    '{count} {count?pieza no cabe|piezas no caben} en ninguna cama y {count?quedó|quedaron} donde estaba{count?|n}.',
    '{count} {count?part does|parts do} not fit on any bed and stayed where {count?it was|they were}.',
    '{count} {count?Teil passt|Teile passen} auf kein Druckbett und {count?blieb|blieben} an {count?seinem|ihrem} Platz.',
    '{count} {count?pièce ne tient|pièces ne tiennent} sur aucun plateau et {count?est restée|sont restées} en place.',
    '{count} {count?हिस्सा|हिस्से} किसी भी बेड पर नहीं {count?समाता|समाते} और अपनी जगह पर {count?रहा|रहे}।',
    '有 {count} 个零件放不进任何打印床，保持原位。',
  ],
  'plates.arrange.toast.nothing': [
    'No hay piezas que repartir.',
    'There are no parts to arrange.',
    'Es gibt keine Teile zum Verteilen.',
    'Aucune pièce à répartir.',
    'बाँटने के लिए कोई हिस्सा नहीं है।',
    '没有可分配的零件。',
  ],
} as const satisfies Record<string, Row>;

type PlatesArrangeKey = keyof typeof PLATES_ARRANGE_TABLE;

const pick = (index: number): Record<PlatesArrangeKey, string> =>
  Object.fromEntries(Object.entries(PLATES_ARRANGE_TABLE).map(([key, row]) => [key, row[index]])) as Record<PlatesArrangeKey, string>;

export const PLATES_ARRANGE_ES = pick(0);
export const PLATES_ARRANGE_EN = pick(1);
export const PLATES_ARRANGE_DE = pick(2);
export const PLATES_ARRANGE_FR = pick(3);
export const PLATES_ARRANGE_HI = pick(4);
export const PLATES_ARRANGE_ZH = pick(5);
