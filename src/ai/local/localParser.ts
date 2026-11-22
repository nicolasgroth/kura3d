/**
 * @file src/ai/local/localParser.ts
 * @description Intérprete determinista (sin red) de órdenes del chat en español e inglés. Divide el texto
 * en cláusulas ("crea un tubo de 40 mm de alto y ahuécalo a 2 mm"), reconoce la intención de cada una,
 * sus medidas con etiqueta (alto, diámetro, pared…) y a qué objeto se refiere (lo recién creado, un
 * pronombre, la selección nombrada, un nombre de la escena o un tipo de primitiva). Es puro: no toca la
 * escena; `localAssistant.ts` resuelve los objetivos y ejecuta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export type LocalShape = 'box' | 'cylinder' | 'tube' | 'sphere' | 'cone' | 'torus' | 'prism';
export type Axis = 0 | 1 | 2;

export type LocalIntent =
  | { kind: 'create'; shape: LocalShape; params: Record<string, number>; color?: string }
  | { kind: 'move'; axis: Axis; amount: number }
  | { kind: 'scale'; factor: number }
  | { kind: 'rotate'; axis: Axis; degrees: number }
  | { kind: 'hollow'; wall: number; drain: boolean }
  | { kind: 'center' }
  | { kind: 'drop' }
  | { kind: 'duplicate' }
  | { kind: 'delete' }
  | { kind: 'texture'; pattern: 'fuzzy' | 'knurling' | 'waves' | 'honeycomb' | 'grid' }
  | { kind: 'cut' }
  | { kind: 'boolean'; op: 'union' | 'subtract' | 'intersect' }
  | { kind: 'export'; format: 'stl' | '3mf'; onlySelected: boolean }
  | { kind: 'query'; what: 'size' | 'scene' }
  | { kind: 'printability' }
  | { kind: 'thread'; part: 'bolt' | 'nut'; diameter: number; pitch: number; length: number }
  | { kind: 'threadHole'; diameter: number; pitch: number };

/** Paso ISO grueso por diámetro nominal (M3–M64). */
export const ISO_COARSE_PITCH: Record<number, number> = {
  3: 0.5, 4: 0.7, 5: 0.8, 6: 1, 8: 1.25, 10: 1.5, 12: 1.75, 14: 2, 16: 2, 18: 2.5, 20: 2.5,
  22: 2.5, 24: 3, 27: 3, 30: 3.5, 33: 3.5, 36: 4, 39: 4, 42: 4.5, 45: 4.5, 48: 5, 52: 5, 56: 5.5, 60: 5.5, 64: 6,
};

/** A qué se refiere la cláusula, tal como lo dijo el usuario. */
export interface TargetRef {
  selection: boolean;
  pronoun: boolean;
  /** Nombres de objetos de la escena que aparecen en el texto (el más largo primero). */
  names: string[];
  shape?: LocalShape;
}

export interface LocalStep {
  intent: LocalIntent;
  ref: TargetRef;
  /** Texto original de la cláusula (para confirmar o explicar). */
  clause: string;
}

export interface LocalPlan {
  steps: LocalStep[];
  unknown: string[];
  /** Valores fuera de rango encontrados (en mm). */
  outOfRange: number[];
}

export const MIN_MM = 0.1;
export const MAX_MM = 2000;

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SHAPES: Array<[LocalShape, RegExp]> = [
  ['tube', /\b(tubos?|tube|tubes|pipe|caños?|cano)\b/],
  ['cylinder', /\b(cilindros?|cylinders?)\b/],
  ['sphere', /\b(esferas?|spheres?|bolas?|balls?)\b/],
  ['cone', /\b(conos?|cones?)\b/],
  ['torus', /\b(toros?|toroides?|torus|donas?|donuts?|anillos?|rings?)\b/],
  ['prism', /\b(prismas?|prisms?|hexagonos?|hexagons?)\b/],
  ['box', /\b(cubos?|cubes?|cajas?|box|boxes|bloques?|blocks?)\b/],
];

const CREATE_VERB = /\b(crea|crear|creame|haz|hazme|hacer|genera|generar|agrega|agregar|anade|anadir|pon|ponme|inserta|insertar|dibuja|create|make|add|build|insert|draw|new|nuev[oa])\b/;
const SELECTION = /\b(seleccion\w*|selected|selection|elegid[oa]s?|marcad[oa]s?)\b/;
// Sin artículos (la/lo sueltos): "mueve la pieza" no debe apuntar a nada por sí solo.
const PRONOUN = /\b(it|them|this|that|este|esta|esto|eso|ese|esa|estos|estas)\b/;
const ENCLITIC = /\b(muev|mueve|mov|ahuec|escal|gir|rot|duplic|clon|copi|centr|apoy|borr|elimin|cort|textur|sub|baj|desplaz|traslad|agrand|achic)\w*(la|lo|las|los)\b/;
const QUESTION = /\?|\b(que|cual|cuales|cuanto|cuanta|cuantos|como|what|which|how|dime|tell me|muestra|mostrar|show|lista|listar|list)\b/;
const QUERY_TOPIC = /\b(tamano|tamanos|medida|medidas|mide|miden|dimension\w*|size|sizes|big|grande|alto|ancho|volumen|volume|escena|scene|objetos|objects|hay)\b/;
const SCENE_TOPIC = /\b(escena|scene|hay|objetos|objects|lista|listar|list)\b/;

const ACTIONS: Array<[LocalIntent['kind'] | 'union' | 'subtract' | 'intersect', RegExp]> = [
  ['export', /\b(export\w*|descarg\w*|download|guarda\w* como)\b|\b(stl|3mf)\b/],
  ['union', /\b(une|unir|unelos|unelas|union|merge|fusion\w*|combin\w*|join)\b/],
  ['subtract', /\b(resta|restar|restale|restalo|subtract\w*|diferencia|substract\w*)\b/],
  ['intersect', /\b(intersec\w*)\b/],
  ['hollow', /\b(ahuec\w*|hueco|huec[oa]s|vaci\w*|hollow\w*|shell)\b/],
  ['texture', /\b(textur\w*|fuzzy|molete\w*|knurl\w*|panal|honeycomb|rejilla|grid|cuadricula)\b/],
  ['cut', /\b(cort\w*|cut|divid\w*|split)\b/],
  ['duplicate', /\b(duplic\w*|clon\w*|copi\w*|duplicate|clone|copy)\b/],
  ['delete', /\b(borr\w*|elimin\w*|delete|remove|quita\w*)\b/],
  // Solo el verbo: "en el centro" es una ubicación, no la orden de centrar.
  ['center', /\b(centra|centrar|centrala|centralo|centralas|centralos|centre|center)\b/],
  ['drop', /\b(apoy\w*|drop|lay)\b/],
  ['scale', /\b(escal\w*|agrand\w*|achic\w*|redimension\w*|scale|resize|enlarge|shrink)\b/],
  ['rotate', /\b(rot[ae]\w*|rotar|gir[ae]\w*|girar|rotate|turn|spin)\b/],
  ['move', /\b(muev\w*|mueve|mover|movel\w*|desplaz\w*|traslad\w*|move|shift|translate|sub[ea]\w*|subir|baj[ae]\w*|bajar|raise|lift|lower)\b/],
];

const COLORS: Array<[RegExp, string]> = [
  [/\b(roj[oa]s?|red)\b/, '#ef4444'],
  [/\b(azul(es)?|blue)\b/, '#3b82f6'],
  [/\b(verdes?|green)\b/, '#22c55e'],
  [/\b(amarill[oa]s?|yellow)\b/, '#eab308'],
  [/\b(naranjas?|orange)\b/, '#f97316'],
  [/\b(negr[oa]s?|black)\b/, '#1f2937'],
  [/\b(blanc[oa]s?|white)\b/, '#f8fafc'],
  [/\b(gris(es)?|gr[ae]y)\b/, '#9ca3af'],
  [/\b(morad[oa]s?|violetas?|purple|violet)\b/, '#8b5cf6'],
  [/\b(rosad?[oa]s?|pink)\b/, '#ec4899'],
];

type Label = 'height' | 'width' | 'depth' | 'diameter' | 'radius' | 'wall';
const LABEL_WORDS: Array<[Label, string]> = [
  ['height', 'alto|alta|altura|tall|high|height'],
  ['width', 'ancho|ancha|anchura|wide|width'],
  ['depth', 'profundidad|profundo|fondo|deep|depth|largo|larga|long|length'],
  ['diameter', 'diametro|diameter|dia|ø'],
  ['radius', 'radio|radius'],
  ['wall', 'pared|paredes|wall|walls|grosor|espesor|thick|thickness'],
];
const LABEL_AFTER = new RegExp(`^\\s*(?:de\\s+|of\\s+)?(${LABEL_WORDS.map(([, w]) => w).join('|')})\\b`);
const LABEL_BEFORE = new RegExp(`(${LABEL_WORDS.map(([, w]) => w).join('|')})\\s*(?:de|of|=|:)?\\s*$`);
const labelOf = (word: string): Label => LABEL_WORDS.find(([, w]) => new RegExp(`^(${w})$`).test(word))![0];

interface Measure {
  value: number;
  label?: Label;
  percent: boolean;
  multiplier: boolean;
}

/** Extrae números con unidad (mm por defecto, cm y pulgadas convertidos) y su etiqueta si la hay. */
export function extractMeasures(clause: string): Measure[] {
  const out: Measure[] = [];
  // La unidad es opcional junto con su espacio: así el espacio sigue separando el número siguiente.
  const re = /(?:^|[^\w.])(x\s*)?(-?\d+(?:\.\d+)?)(?:\s*(mm|cm|in\b|pulgadas?|"|%|x\b|veces|times))?/g;
  for (const m of clause.matchAll(re)) {
    let value = parseFloat(m[2]);
    const unit = m[3] ?? '';
    if (unit === 'cm') value *= 10;
    else if (unit === 'in' || unit.startsWith('pulgada') || unit === '"') value *= 25.4;
    const end = (m.index ?? 0) + m[0].length;
    const after = clause.slice(end, end + 30).match(LABEL_AFTER);
    const before = clause.slice(Math.max(0, (m.index ?? 0) - 24), (m.index ?? 0) + 1).match(LABEL_BEFORE);
    const word = after?.[1] ?? before?.[1];
    out.push({
      value,
      label: word ? labelOf(word) : undefined,
      percent: unit === '%',
      multiplier: Boolean(m[1]) || unit === 'x' || unit === 'veces' || unit === 'times',
    });
  }
  return out;
}

/**
 * Eje en el sistema del usuario (como los slicers): 0 = X derecha, 1 = Y fondo, 2 = Z arriba. El chat
 * trabaja con el Command Bus, que recibe y devuelve coordenadas en ese mismo sistema.
 */
function detectAxis(clause: string): { axis: Axis; sign: 1 | -1 } | null {
  if (/\beje_x\b/.test(clause)) return { axis: 0, sign: 1 };
  if (/\beje_y\b/.test(clause)) return { axis: 1, sign: 1 };
  if (/\beje_z\b/.test(clause)) return { axis: 2, sign: 1 };
  if (/\b(arriba|up|upward|sube\w*|subir|raise|lift)\b/.test(clause)) return { axis: 2, sign: 1 };
  if (/\b(abajo|down|downward|baj[ae]\w*|bajar|lower)\b/.test(clause)) return { axis: 2, sign: -1 };
  if (/\b(derecha|right)\b/.test(clause)) return { axis: 0, sign: 1 };
  if (/\b(izquierda|left)\b/.test(clause)) return { axis: 0, sign: -1 };
  if (/\b(adelante|delante|frente|forward|front)\b/.test(clause)) return { axis: 1, sign: -1 };
  if (/\b(atras|detras|fondo|back|backward)\b/.test(clause)) return { axis: 1, sign: 1 };
  return null;
}

function shapeOf(clause: string): LocalShape | undefined {
  return SHAPES.find(([, re]) => re.test(clause))?.[0];
}

function actionOf(clause: string): (typeof ACTIONS)[number][0] | undefined {
  return ACTIONS.find(([, re]) => re.test(clause))?.[0];
}

function isActionable(clause: string): boolean {
  return Boolean(shapeOf(clause) || actionOf(clause) || CREATE_VERB.test(clause) || QUESTION.test(clause)
    || THREAD_WORD.test(clause) || PRINTABILITY.test(clause));
}

/** Divide en cláusulas; los fragmentos sin verbo ni figura ("20 mm de diámetro") se unen al anterior. */
export function splitClauses(text: string): string[] {
  const pieces = text
    .split(/\s*(?:[,;]|\.\s+|\by luego\b|\by despues\b|\by entonces\b|\bluego\b|\bdespues\b|\bentonces\b|\band then\b|\bthen\b|\by\b|\band\b)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const clauses: string[] = [];
  for (const piece of pieces) {
    // Solo se unen fragmentos que parecen medidas o colores; el resto queda como cláusula propia
    // (y, si no se entiende, se informa en vez de pegarse a la orden anterior).
    const looksLikeDetail = /\d/.test(piece) || LABEL_AFTER.test(piece) || COLORS.some(([re]) => re.test(piece));
    if (clauses.length > 0 && !isActionable(piece) && looksLikeDetail) clauses[clauses.length - 1] += ` ${piece}`;
    else clauses.push(piece);
  }
  return clauses;
}

const pick = (ms: Measure[], label: Label) => ms.find((m) => m.label === label)?.value;

function createParams(shape: LocalShape, ms: Measure[]): Record<string, number> {
  const free = ms.filter((m) => !m.label && !m.percent && !m.multiplier).map((m) => m.value);
  const radius = pick(ms, 'radius');
  const diameter = pick(ms, 'diameter') ?? (radius !== undefined ? radius * 2 : undefined);
  const height = pick(ms, 'height');
  switch (shape) {
    case 'box': {
      const w = pick(ms, 'width') ?? free[0] ?? height ?? 30;
      return { width: w, height: height ?? free[1] ?? w, depth: pick(ms, 'depth') ?? free[2] ?? w };
    }
    case 'cylinder': {
      const d = diameter ?? free.shift() ?? 24;
      return { radius: d / 2, height: height ?? free[0] ?? 40 };
    }
    case 'cone': {
      const d = diameter ?? free.shift() ?? 36;
      return { radius: d / 2, height: height ?? free[0] ?? 36 };
    }
    case 'tube': {
      const d = diameter ?? free.shift() ?? 30;
      const wall = pick(ms, 'wall') ?? 3;
      return { outerRadius: d / 2, innerRadius: Math.max(0.5, d / 2 - wall), height: height ?? free[0] ?? 40 };
    }
    case 'sphere':
      return { radius: (diameter ?? free[0] ?? 36) / 2 };
    case 'torus': {
      const d = diameter ?? free.shift() ?? 40;
      return { outerRadius: d / 2, tubeRadius: (pick(ms, 'wall') ?? free[0] ?? 12) / 2 };
    }
    case 'prism': {
      const w = pick(ms, 'width') ?? diameter ?? free.shift() ?? 30;
      return { width: w, height: height ?? free[0] ?? 30, sides: 6 };
    }
  }
}

const THREAD_WORD = /\b(rosca\w*|roscad\w*|threads?|threaded|tornillos?|pernos?|bolts?|screws?|tuercas?|nuts?)\b|\bm\d{1,2}\b/;
const HOLE_WORD = /\b(agujeros?|orificios?|hoyos?|holes?|perforacion\w*|taladr\w*)\b/;
const PRINTABILITY = /\b(imprimib\w*|printab\w*|se puede imprimir|can (it|this) be printed|valid\w*|analiz\w*|analy[sz]\w*|voladizos?|overhangs?)\b/;
const NOMINAL = /\bm(\d{1,2})(?: paso (\d+(?:\.\d+)?))?\b/;

function threadIntent(clause: string): LocalIntent | null {
  if (!THREAD_WORD.test(clause)) return null;
  const nominalMatch = clause.match(NOMINAL);
  const ms = extractMeasures(clause.replace(NOMINAL, ' '));
  const nominal = Number(nominalMatch?.[1] ?? pick(ms, 'diameter') ?? 8);
  const diameter = Math.min(64, Math.max(3, nominal));
  const pitch = nominalMatch?.[2] ? Number(nominalMatch[2]) : ISO_COARSE_PITCH[diameter] ?? Math.max(0.5, Math.round(diameter * 0.6) / 4);
  if (HOLE_WORD.test(clause)) return { kind: 'threadHole', diameter, pitch };
  const part = /\b(tuercas?|nuts?)\b/.test(clause) ? 'nut' : 'bolt';
  const length = pick(ms, 'height') ?? pick(ms, 'depth') ?? ms.find((m) => !m.label && !m.percent && !m.multiplier)?.value ?? 20;
  return { kind: 'thread', part, diameter, pitch, length };
}

function intentOf(clause: string): LocalIntent | null {
  const thread = threadIntent(clause);
  if (thread) return thread;
  if (PRINTABILITY.test(clause)) return { kind: 'printability' };
  const shape = shapeOf(clause);
  const action = actionOf(clause);
  const creating = CREATE_VERB.test(clause);
  const ms = extractMeasures(clause);
  const firstLength = ms.find((m) => !m.percent && !m.multiplier)?.value;

  if (QUESTION.test(clause) && QUERY_TOPIC.test(clause) && !creating) {
    return { kind: 'query', what: SCENE_TOPIC.test(clause) && !shape ? 'scene' : 'size' };
  }
  if (shape && (creating || !action)) {
    const color = COLORS.find(([re]) => re.test(clause))?.[1] ?? clause.match(/#[0-9a-f]{6}\b/)?.[0];
    return { kind: 'create', shape, params: createParams(shape, ms), ...(color ? { color } : {}) };
  }
  switch (action) {
    case 'export':
      return { kind: 'export', format: /3mf/.test(clause) ? '3mf' : 'stl', onlySelected: SELECTION.test(clause) };
    case 'union':
    case 'subtract':
    case 'intersect':
      return { kind: 'boolean', op: action };
    case 'hollow':
      return { kind: 'hollow', wall: pick(ms, 'wall') ?? firstLength ?? 2, drain: /\b(drenaje|drain|agujero|hole|orificio)\b/.test(clause) };
    case 'texture': {
      const pattern = /knurl|molete/.test(clause) ? 'knurling'
        : /panal|honey/.test(clause) ? 'honeycomb'
          : /\bondas?\b|\bwaves?\b/.test(clause) ? 'waves'
            : /rejilla|grid|cuadricula/.test(clause) ? 'grid' : 'fuzzy';
      return { kind: 'texture', pattern };
    }
    case 'cut':
      return { kind: 'cut' };
    case 'duplicate':
      return { kind: 'duplicate' };
    case 'delete':
      return { kind: 'delete' };
    case 'center':
      return { kind: 'center' };
    case 'drop':
      return { kind: 'drop' };
    case 'scale': {
      const pct = ms.find((m) => m.percent)?.value;
      const mult = ms.find((m) => m.multiplier)?.value;
      const factor = pct !== undefined ? pct / 100
        : mult ?? (/\b(doble|double|twice)\b/.test(clause) ? 2 : /\b(mitad|half)\b/.test(clause) ? 0.5 : undefined);
      return factor !== undefined && factor > 0 ? { kind: 'scale', factor } : null;
    }
    case 'rotate': {
      // Sin eje explícito se gira sobre la cama (alrededor de Z, la vertical).
      const axis = detectAxis(clause)?.axis ?? 2;
      return { kind: 'rotate', axis, degrees: ms[0]?.value ?? 90 };
    }
    case 'move': {
      const dir = detectAxis(clause);
      if (firstLength === undefined) {
        return /\b(cama|bed|base|plate)\b/.test(clause) ? { kind: 'drop' } : null;
      }
      const amount = Math.abs(firstLength) * (dir?.sign ?? 1) * (firstLength < 0 ? -1 : 1);
      return { kind: 'move', axis: dir?.axis ?? 0, amount };
    }
    default:
      if (/\b(cama|bed)\b/.test(clause) && /\b(sobre|en|on|onto|to)\b/.test(clause)) return { kind: 'drop' };
      return null;
  }
}

function refOf(clause: string, objectNames: readonly string[]): TargetRef {
  const names = objectNames
    .filter((name) => {
      const n = strip(name).trim();
      return n.length >= 2 && new RegExp(`(^|[^\\w])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\w])`).test(clause);
    })
    .sort((a, b) => b.length - a.length);
  return {
    selection: SELECTION.test(clause),
    pronoun: PRONOUN.test(clause) || ENCLITIC.test(clause),
    names,
    shape: shapeOf(clause),
  };
}

/** Convierte el texto del usuario en pasos. `objectNames` permite reconocer objetos por su nombre. */
export function parseLocalPrompt(prompt: string, objectNames: readonly string[] = []): LocalPlan {
  const text = strip(prompt)
    .replace(/(\d),(\d)/g, '$1.$2')
    // "M6x1" es métrica y paso, no dos medidas; "en el centro" es una ubicación, no "centrar".
    .replace(/\bm(\d{1,2})\s*[x×]\s*(\d+(?:\.\d+)?)/g, 'm$1 paso $2')
    .replace(/\b(en el|en la|al|in the|at the|on the)\s+(centro|center|centre|medio|middle)\b/g, ' ')
    // "20x50x30" → "20 50 30" para leer cada medida por separado.
    .replace(/(\d)\s*[x×*]\s*(?=\d)/g, '$1 ')
    .replace(/[¿¡]/g, ' ')
    .replace(/\b(en|eje|axis|along|on|the|el)\s+([xyz])\b/g, ' eje_$2');
  const plan: LocalPlan = { steps: [], unknown: [], outOfRange: [] };
  for (const clause of splitClauses(text)) {
    const ref = refOf(clause, objectNames);
    // Los nombres ("Caja 2") no deben leerse como medidas.
    let measured = clause;
    for (const name of ref.names) measured = measured.split(strip(name)).join(' ');
    const intent = intentOf(measured);
    if (!intent) {
      plan.unknown.push(clause);
      continue;
    }
    if (intent.kind === 'create') {
      for (const [key, value] of Object.entries(intent.params)) {
        if (key !== 'sides' && (value < MIN_MM || value > MAX_MM)) plan.outOfRange.push(value);
      }
    }
    if (intent.kind === 'move' && Math.abs(intent.amount) > MAX_MM) plan.outOfRange.push(intent.amount);
    if (intent.kind === 'hollow' && (intent.wall < 0.3 || intent.wall > 30)) plan.outOfRange.push(intent.wall);
    plan.steps.push({ intent, ref, clause });
  }
  return plan;
}

const AFFIRM = /^\s*(si|sí|s|yes|y|ok|okay|vale|dale|confirmo|confirmar|confirm|hazlo|adelante|go|do it)\s*[.!]*\s*$/i;
const DENY = /^\s*(no|n|cancela|cancelar|cancel|nada|olvidalo|stop)\s*[.!]*\s*$/i;

export const isAffirmative = (text: string) => AFFIRM.test(strip(text));
export const isNegative = (text: string) => DENY.test(strip(text));
