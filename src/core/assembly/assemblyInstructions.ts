/**
 * @file src/core/assembly/assemblyInstructions.ts
 * @description Instrucciones de armado de un grupo dividido, con reglas y sin IA. Función pura y determinista.
 *
 * Orden (árbol desde la base, tipo Prim): la base es la pieza que apoya en la mesa (cota baja mínima, con 0,5 mm de
 * tolerancia) y, entre esas, la de más volumen; empate, el código menor. Si todas traen el paso del orden validado al
 * dividir (`assemblyStep`, que ya evita choques), la base es la del paso 1. Luego, en cada paso entra una pieza que
 * tiene al menos una unión con lo ya armado; entre las candidatas gana el paso validado menor, después la más baja,
 * la de más volumen y el código menor. Una pieza sin uniones con lo armado abre un bloque aparte (aviso).
 *
 * Por paso: las uniones de la pieza nueva con las ya puestas (cara, método, cantidad y medida), la dirección de
 * entrada (la validada si existe; si no, hacia la pareja por la normal de la unión, que manda en un plano inclinado)
 * y los avisos: unión débil, pieza que hay que sostener (no apoya en la mesa ni sobre otra pieza ya puesta), polaridad
 * de los imanes y pieza trabada según el informe guardado. Todo sale en ejes del usuario (Z arriba).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SplitJointRecord, Vec3 } from '../../types/kura';
import { toUserVector, type AxisDirection } from '../scene/displayAxes';
import type {
  AssemblyInstructions, InstructionDirection, InstructionJoin, InstructionMagnet, InstructionMaterials, InstructionMethod,
  InstructionPartInput, InstructionStep, InstructionWarning, InstructionsInput,
} from './assemblyInstructionsTypes';

/** Tolerancia (mm) para decir que dos piezas apoyan a la misma altura. */
const REST_TOLERANCE_MM = 0.5;
/** Componente vertical mínima de la normal para decir que una unión inclinada sostiene desde abajo. */
const SUPPORT_NORMAL_MIN = 0.5;

const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const;
const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);

/** Vector unitario (motor) del eje con signo. */
function axisVector(axis: 'x' | 'y' | 'z', sign: 1 | -1): Vec3 {
  const v: Vec3 = [0, 0, 0];
  v[AXIS_INDEX[axis]] = sign;
  return v;
}

/** Eje con signo dominante de un vector. */
function dominantAxis(v: Vec3): AxisDirection {
  let best = 0;
  for (let i = 1; i < 3; i++) if (Math.abs(v[i]) > Math.abs(v[best])) best = i;
  return `${v[best] < 0 ? '-' : '+'}${'xyz'[best]}` as AxisDirection;
}

/** Normal (motor) de la unión, del lado `a` hacia el `b`. */
function jointNormal(j: SplitJointRecord): Vec3 {
  return j.normal ? [j.normal[0], j.normal[1], j.normal[2]] : axisVector(j.axis, 1);
}

/** Movimiento (motor) de `code` al entrar contra su pareja: `a` avanza por la normal, `b` en contra. */
function moveToward(j: SplitJointRecord, code: string): Vec3 {
  const n = jointNormal(j);
  const s = j.a === code ? 1 : -1;
  return [clean(n[0] * s), clean(n[1] * s), clean(n[2] * s)];
}

function userDirection(engineMove: Vec3): InstructionDirection {
  const v = toUserVector(engineMove).map(clean) as Vec3;
  return { axis: dominantAxis(v), vector: v };
}

function methodOf(j: SplitJointRecord): InstructionMethod {
  if (j.kind === 'glue' || !j.connector) return 'glue';
  return j.connector.type;
}

function magnetOf(j: SplitJointRecord): InstructionMagnet | undefined {
  const m = j.magnets?.magnet ?? j.connector?.magnet;
  if (!m) return undefined;
  return { shape: m.shape, sizeMm: m.sizeMm, ...(m.shape === 'rect' && m.widthMm !== undefined ? { widthMm: m.widthMm } : {}), heightMm: m.heightMm };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Unión vista desde la pieza nueva `code`. */
function joinOf(j: SplitJointRecord, code: string, partner: InstructionPartInput): InstructionJoin {
  const method = methodOf(j);
  // La cara de la pieza nueva mira hacia su pareja: la misma dirección en que se mueve al entrar.
  const face = dominantAxis(toUserVector(moveToward(j, code)));
  const count = method === 'glue' ? 0 : method === 'magnet' ? j.magnets?.count ?? j.connectorCenters.length : j.connectorCenters.length || (j.connector?.count ?? 0);
  const sized = method === 'dowel' || method === 'loose-dowel' || method === 'peg';
  const magnet = method === 'magnet' ? magnetOf(j) : undefined;
  return {
    label: j.label,
    partnerId: partner.id,
    partnerCode: partner.code,
    face,
    tilted: Boolean(j.normal),
    method,
    count,
    ...(sized && j.connector ? { diameterMm: round1(2 * j.connector.size) } : {}),
    ...(magnet ? { magnet } : {}),
    firmness: j.strength?.level ?? null,
  };
}

/** Uniones únicas del grupo (cada unión viene repetida en sus dos piezas), por etiqueta. */
function uniqueJoints(parts: readonly InstructionPartInput[]): SplitJointRecord[] {
  const codes = new Set(parts.map((p) => p.code));
  const seen = new Map<string, SplitJointRecord>();
  for (const p of parts) {
    for (const j of p.joints) {
      if (!seen.has(j.label) && codes.has(j.a) && codes.has(j.b) && j.a !== j.b) seen.set(j.label, j);
    }
  }
  return [...seen.values()].sort((a, b) => a.label.length - b.label.length || byCode(a.label, b.label));
}

/** Orden de candidatas: paso validado, altura, volumen (mayor primero), código. */
function compareCandidates(validated: boolean) {
  return (a: InstructionPartInput, b: InstructionPartInput) => {
    if (validated && a.assemblyStep !== b.assemblyStep) return (a.assemblyStep ?? Infinity) - (b.assemblyStep ?? Infinity);
    if (Math.abs(a.bottomMm - b.bottomMm) > REST_TOLERANCE_MM) return a.bottomMm - b.bottomMm;
    if (a.volumeMm3 !== b.volumeMm3) return b.volumeMm3 - a.volumeMm3;
    return byCode(a.code, b.code);
  };
}

/** Pieza que no apoya en la mesa ni sobre una pieza ya puesta (hay que sostenerla mientras encaja o pega). */
function needsHolding(p: InstructionPartInput, tableMm: number, mine: SplitJointRecord[]): boolean {
  if (p.bottomMm <= tableMm + REST_TOLERANCE_MM) return false;
  // Apoya desde abajo si la pareja queda bajo ella: la normal (de `a` hacia `b`) sube y ella es `b`, o al revés.
  return !mine.some((j) => {
    const up = jointNormal(j)[1];
    return (j.b === p.code && up >= SUPPORT_NORMAL_MIN) || (j.a === p.code && up <= -SUPPORT_NORMAL_MIN);
  });
}

function stepWarnings(p: InstructionPartInput, mine: SplitJointRecord[], ctx: { tableMm: number; weak: Set<string>; blocked: Set<string> }): InstructionWarning[] {
  const out: InstructionWarning[] = [];
  for (const j of mine) {
    if (j.strength?.level === 'weak' || ctx.weak.has(j.label)) out.push({ code: 'weak-joint', joint: j.label });
  }
  if (needsHolding(p, ctx.tableMm, mine)) out.push({ code: 'hold-piece' });
  for (const j of mine) if (methodOf(j) === 'magnet') out.push({ code: 'magnet-polarity', joint: j.label });
  if (ctx.blocked.has(p.code)) out.push({ code: 'blocked' });
  return out;
}

/** Dirección de entrada: la validada si no hay unión inclinada que mande; si no, hacia la pareja de la primera unión. */
function entryDirection(p: InstructionPartInput, mine: SplitJointRecord[]): InstructionDirection | null {
  if (mine.length === 0) return null;
  const restricting = mine.filter((j) => methodOf(j) !== 'glue');
  const tilted = restricting.find((j) => j.normal);
  if (tilted) return userDirection(moveToward(tilted, p.code));
  const stored = p.insertDirection;
  if (stored && /^[+-][xyz]$/.test(stored)) return userDirection(axisVector(stored[1] as 'x' | 'y' | 'z', stored[0] === '-' ? -1 : 1));
  return userDirection(moveToward(restricting[0] ?? mine[0], p.code));
}

function materialsOf(input: InstructionsInput, joints: SplitJointRecord[], parts: readonly InstructionPartInput[]): InstructionMaterials {
  const magnets = new Map<string, InstructionMagnet & { count: number }>();
  for (const j of joints) {
    if (methodOf(j) !== 'magnet') continue;
    const m = magnetOf(j);
    if (!m) continue;
    const key = `${m.shape}|${m.sizeMm}|${m.widthMm ?? ''}|${m.heightMm}`;
    // Cada posición lleva dos alojamientos enfrentados: un imán por pieza.
    const pairs = j.magnets?.count ?? j.connectorCenters.length;
    const prev = magnets.get(key);
    if (prev) prev.count += 2 * pairs;
    else magnets.set(key, { ...m, count: 2 * pairs });
  }
  const glueJoints = joints.filter((j) => methodOf(j) === 'glue').length;
  return {
    printedParts: parts.length,
    codes: parts.map((p) => p.code).sort(byCode),
    looseDowels: (input.dowels ?? []).map((d) => ({ diameterMm: d.diameterMm, lengthMm: d.lengthMm, count: d.count })),
    magnets: [...magnets.values()].sort((a, b) => a.sizeMm - b.sizeMm || a.heightMm - b.heightMm || byCode(a.shape, b.shape)),
    joints: joints.length,
    glueJoints,
    connectorJoints: joints.length - glueJoints,
  };
}

/** Pasos y lista de materiales del armado (ejes del usuario). */
export function computeAssemblyInstructions(input: InstructionsInput): AssemblyInstructions {
  const parts = [...input.parts].sort((a, b) => byCode(a.code, b.code));
  const joints = uniqueJoints(parts);
  const byCodeMap = new Map(parts.map((p) => [p.code, p]));
  const validated = parts.length > 0 && parts.every((p) => typeof p.assemblyStep === 'number');
  const compare = compareCandidates(validated);
  const tableMm = parts.reduce((m, p) => Math.min(m, p.bottomMm), Infinity);
  const ctx = { tableMm, weak: new Set(input.weakJoints ?? []), blocked: new Set(input.blocked ?? []) };

  const placed = new Set<string>();
  const steps: InstructionStep[] = [];
  const jointsOf = (code: string) => joints.filter((j) => (j.a === code && placed.has(j.b)) || (j.b === code && placed.has(j.a)));

  while (placed.size < parts.length) {
    const pending = parts.filter((p) => !placed.has(p.code));
    const connected = pending.filter((p) => jointsOf(p.code).length > 0);
    // Primera base: con orden validado, la del paso 1; si no (o en un bloque suelto), la que apoya y pesa más.
    const pool = connected.length > 0 ? connected : pending;
    const next = [...pool].sort(connected.length === 0 && placed.size > 0 ? compareCandidates(false) : compare)[0];
    const mine = jointsOf(next.code);
    const base = mine.length === 0;
    const warnings = base ? (placed.size > 0 ? [{ code: 'not-connected' as const }] : []) : stepWarnings(next, mine, ctx);
    const joins = mine.map((j) => joinOf(j, next.code, byCodeMap.get(j.a === next.code ? j.b : j.a)!));
    steps.push({
      index: steps.length + 1,
      partId: next.id,
      code: next.code,
      name: next.name,
      base,
      joins,
      direction: base ? null : entryDirection(next, mine),
      warnings,
      partIds: [next.id, ...joins.map((j) => j.partnerId).filter((id, i, all) => all.indexOf(id) === i)],
    });
    placed.add(next.code);
  }
  return { steps, materials: materialsOf(input, joints, parts) };
}
