/**
 * @file src/project/projectSchema.ts
 * @description Esquema, tipos y validadores del documento de proyecto .kura y sus errores.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { TRANSFORM_LIMITS } from '../engine/operationLimits';
import { EDGE_SCOPES, EDGE_STYLES, TEXT_ALIGN_OPTIONS } from '../engine/primitiveLimits';
import { MAX_GROUP_NAME, MAX_GROUPS } from '../core/scene/groups';
import { REFERENCE_OPACITY } from '../core/scene/objectRole';
import { sanitizeMagnetParams } from '../core/addons/magnetPocket';
import { RECIPE_PROVENANCE_LIMITS } from '../types/recipeProvenance';
import { MATERIAL_PRESETS, type PrinterProfile, type SceneGroup, type SceneObject, type UnitSystem } from '../types/kura';

export const MAX_PROJECT_BYTES = 128 * 1024 * 1024;

export interface ProjectSceneSnapshot {
  objects: SceneObject[];
  selectedIds: string[];
  /** Grupos de organización (opcional: proyectos sin grupos lo omiten). */
  groups?: SceneGroup[];
}

export interface ProjectDocument extends ProjectSceneSnapshot {
  past: ProjectSceneSnapshot[];
  future: ProjectSceneSnapshot[];
  unitSystem: UnitSystem;
  printerProfile: PrinterProfile;
  customBedDimensions: { width: number; depth: number; height: number } | null;
  sectionPlane: { enabled: boolean; heightMm: number };
  snapGridMm: number;
}

export class ProjectCodecError extends Error {
  /** Causa técnica opcional (campo u objeto que no pasó la validación). */
  constructor(public readonly code: 'invalid' | 'unsupported' | 'too-large', public readonly detail?: string) {
    super({
      invalid: 'Invalid or damaged Kura3D project.',
      unsupported: 'Unsupported Kura3D project version.',
      'too-large': 'Kura3D project exceeds the supported size.',
    }[code]);
    this.name = 'ProjectCodecError';
  }
}

export function check(condition: unknown, detail?: string): asserts condition {
  if (!condition) throw new ProjectCodecError('invalid', detail);
}

export function limit(condition: boolean) {
  if (!condition) throw new ProjectCodecError('too-large');
}

type Rule = (value: unknown) => boolean;
const optional = (rule: Rule): Rule => (value) => value === undefined || rule(value);
export const nat = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const positive = (v: unknown) => finite(v) && v > 0;
const nonnegative = (v: unknown) => finite(v) && v >= 0;
const bool = (v: unknown) => typeof v === 'boolean';
const str = (v: unknown): v is string => typeof v === 'string' && v.length <= 65536;
export const id = (v: unknown): v is string => str(v) && v.length > 0 && v.length <= 1024;
export const color = (v: unknown): v is string => typeof v === 'string' && /^#[\da-f]{6}$/i.test(v);
const vec3 = (v: unknown) => Array.isArray(v) && v.length === 3 && finite(v[0]) && finite(v[1]) && finite(v[2]);
// Mismos límites que la escena (`operationLimits`): un .kura no puede traer transformaciones que la UI rechazaría.
const withinAbs = (max: number) => (v: unknown) => vec3(v) && (v as number[]).every((n) => Math.abs(n) <= max);
const scaleVec = (v: unknown) =>
  vec3(v) && (v as number[]).every((n) => Math.abs(n) >= TRANSFORM_LIMITS.minScale && Math.abs(n) <= TRANSFORM_LIMITS.maxScale);
const oneOf = (...values: string[]): Rule => (v) => typeof v === 'string' && values.includes(v);

// Only plain records with explicitly declared own properties enter the runtime document.
export function record(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
}

export function shape(fields: Record<string, Rule>): Rule {
  return (v) => record(v)
    && Object.keys(v).every(key => Object.hasOwn(fields, key))
    && Object.entries(fields).every(([k, rule]) => rule(Object.hasOwn(v, k) ? v[k] : undefined));
}

const numberOption = optional(finite);
const params = shape({
  width: numberOption, height: numberOption, depth: numberOption, radius: numberOption,
  outerRadius: numberOption, innerRadius: numberOption, tubeRadius: numberOption,
  segments: numberOption, sides: numberOption, text: optional(str), fontSize: numberOption, bevel: numberOption,
  letterSpacing: numberOption, textAlign: optional(oneOf(...TEXT_ALIGN_OPTIONS)),
  // Bordes (Caja, Cilindro, Tubo, Prisma); sin campos = aristas rectas, como en proyectos anteriores.
  edgeStyle: optional(oneOf(...EDGE_STYLES)), edgeSize: numberOption, edgeScope: optional(oneOf(...EDGE_SCOPES)),
});

// Desde la versión 2 del formato: origen paramétrico (huella de malla y opciones de rosca).
const threadOptions = shape({
  kind: oneOf('bolt', 'nut', 'hole'), diameterMm: finite, pitchMm: finite, lengthMm: finite,
  clearanceMm: numberOption, includeHead: optional(bool),
});
const parametric = shape({
  kind: oneOf('primitive', 'thread'), meshFingerprint: (v) => str(v) && v.length <= 64, thread: optional(threadOptions),
});

// Pieza de "dividir para imprimir" (`metadata.split`): validación estricta, campo opcional.
const nat3 = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every((n) => Number.isInteger(n) && n >= 0 && n < 4096);
const splitTransform = shape({ position: vec3, rotation: vec3 });
const face = oneOf('+x', '-x', '+y', '-y', '+z', '-z');
const label16 = (v: unknown) => str(v) && v.length <= 16;
// Unión guardada para revalidar el armado (`SplitJointRecord`).
// Imán de una unión del corte (`MagnetPocketParams`): mismos rangos que el alojamiento de imán.
const splitMagnet = (v: unknown) => sanitizeMagnetParams(v) !== null && shape({
  shape: str, sizeMm: finite, heightMm: finite, clearanceMm: numberOption, depthClearanceMm: numberOption, hidden: bool,
})(v);
const splitConnector = shape({
  type: oneOf('dowel', 'peg', 'dovetail', 'lap', 'loose-dowel', 'magnet'), size: positive, depth: positive, tolerance: nonnegative,
  count: (v) => nat(v) && v > 0, minWallForConnectorMm: optional(nonnegative), lapHeightMm: optional(positive),
  magnet: optional(splitMagnet),
});
const splitJointMagnets = shape({
  magnet: splitMagnet, count: (v) => nat(v) && v > 0 && v <= 64, pocketDiameterMm: positive, pocketDepthMm: positive, polarity: oneOf('opposite'),
});
const splitJointRecord = shape({
  label: label16, axis: oneOf('x', 'y', 'z'), position: finite, a: label16, b: label16,
  kind: oneOf('connector', 'glue', 'lap', 'socket'), connector: (v) => v === null || splitConnector(v),
  connectorCenters: (v) => Array.isArray(v) && v.length <= 4096 && v.every(vec3), contactAreaMm2: nonnegative,
  labelPlacement: optional((v) => v === null || oneOf('joint', 'outside', 'dots')(v)),
  magnets: optional(splitJointMagnets),
});
// Avisos de la división guardados con el grupo (`SplitStoredNotes`): todo acotado en cantidad y largo.
const short = (n: number) => (v: unknown) => typeof v === 'string' && v.length <= n;
const shortList = (max: number, n: number) => (v: unknown) => Array.isArray(v) && v.length <= max && v.every(short(n));
const splitNotes = shape({
  warnings: (v) => Array.isArray(v) && v.length <= 256 && v.every(shape({
    code: short(64),
    params: (p) => record(p) && Object.keys(p).length <= 16 && Object.entries(p).every(([k, x]) => k.length <= 32 && (finite(x) || short(200)(x))),
  })),
  suggestions: (v) => Array.isArray(v) && v.length <= 512 && v.every(shape({ joint: short(16), options: shortList(8, 40) })),
  weakJoints: shortList(512, 16), gluedByFix: shortList(512, 16), changedByFix: shortList(512, 40),
  report: optional(shape({
    ok: bool, steps: nat, blocked: shortList(512, 24), clashes: nat, interference: nat, gaps: nat,
    blockedDetail: optional((v) => Array.isArray(v) && v.length <= 512
      && v.every(shape({ code: short(24), conflictingJoints: shortList(64, 16), blockingParts: shortList(64, 24) }))),
    weak: optional((v) => Array.isArray(v) && v.length <= 512 && v.every(shape({ joint: short(16), measuredMm: nonnegative, recommendedMm: nonnegative }))),
  })),
});
const splitMetadata = shape({
  groupId: id, code: (v) => str(v) && v.length <= 16, cell: nat3, assembly: splitTransform,
  print: shape({ position: vec3, rotation: vec3, plate: (v) => Number.isInteger(v) && (v as number) >= 0, downFace: face }),
  jointLabels: (v) => Array.isArray(v) && v.length <= 4096 && v.every((l) => str(l) && l.length <= 16),
  jointPartners: optional((v) => Array.isArray(v) && v.length <= 4096
    && v.every(shape({ label: (l) => str(l) && l.length <= 16, code: (c) => str(c) && c.length <= 16 }))),
  assemblyStep: optional((v) => Number.isInteger(v) && (v as number) >= 1),
  insertDirection: optional(face),
  joints: optional((v) => Array.isArray(v) && v.length <= 4096 && v.every(splitJointRecord)),
  groupNotes: optional(splitNotes),
});
const splitDowelMetadata = shape({ groupId: id, diameterMm: positive, lengthMm: positive, count: (v) => nat(v) && v > 0 && v <= 100_000 });
// Procedencia de una receta (`metadata.recipe`, `src/types/recipeProvenance.ts`): solo datos simples y acotados.
const RP = RECIPE_PROVENANCE_LIMITS;
const recipeAnswer = (v: unknown) => finite(v) || bool(v) || short(RP.maxTextAnswer)(v);
const recipeMetadata = shape({
  id: (v) => short(RP.maxIdLength)(v) && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v as string),
  version: (v) => short(RP.maxVersionLength)(v) && (v as string).length > 0,
  hash: (v) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v),
  answers: (v) => record(v) && Object.keys(v).length <= RP.maxAnswers
    && Object.entries(v).every(([k, x]) => k.length > 0 && k.length <= RP.maxIdLength && recipeAnswer(x)),
  variant: optional(short(RP.maxIdLength)),
  output: (v) => short(RP.maxIdLength)(v) && (v as string).length > 0,
  omitted: optional(shortList(RP.maxAnswers, RP.maxIdLength)),
  run: optional(short(RP.maxIdLength)),
  name: optional(short(RP.maxTextAnswer)),
  meshFingerprint: optional(short(RP.maxIdLength)),
});
// Agregado (`metadata.addon`): alojamiento de imán con sus medidas; los rangos los valida `sanitizeMagnetParams`.
const addonMetadata = shape({
  kind: oneOf('magnet_pocket'),
  params: (v) => sanitizeMagnetParams(v) !== null && shape({
    shape: str, sizeMm: finite, heightMm: finite, clearanceMm: numberOption, depthClearanceMm: numberOption, hidden: bool,
  })(v),
  hostId: optional(id),
});
const objectExtra = shape({
  split: optional(splitMetadata), splitDowel: optional(splitDowelMetadata), recipe: optional(recipeMetadata), addon: optional(addonMetadata),
});

export type ObjectMetadata = Omit<SceneObject, 'mesh' | 'stats'>;
const metadataFields = {
  id, name: str,
  source: oneOf('primitive', 'imported', 'boolean', 'svg', 'image', 'cut_part', 'color_split',
    'mold', 'thread', 'hull', 'projected', 'segmented_part', 'combined'),
  primitiveType: optional(oneOf('box', 'cylinder', 'tube', 'sphere', 'cone', 'torus', 'prism', 'text')),
  primitiveParams: optional(params),
  parametric: optional(parametric),
  position: withinAbs(TRANSFORM_LIMITS.maxAbsCoordinate), rotation: withinAbs(TRANSFORM_LIMITS.maxAbsRotation),
  scale: scaleVec, color,
  materialPreset: optional(oneOf(...Object.keys(MATERIAL_PRESETS))),
  role: oneOf('solid', 'negative', 'reference'),
  referenceOpacity: optional((v) => typeof v === 'number' && v >= REFERENCE_OPACITY.min && v <= REFERENCE_OPACITY.max),
  visible: bool, locked: bool,
  hollow: optional(shape({ enabled: bool, wallThickness: finite, drainHole: optional(bool), drainHoleRadius: numberOption })),
  texture: optional(shape({ pattern: oneOf('none', 'fuzzy', 'knurling', 'waves', 'honeycomb', 'grid'), depth: finite, scale: finite })),
  metadata: optional(objectExtra),
  groupRef: optional(id),
} satisfies Record<keyof ObjectMetadata, Rule>;

const idList = (v: unknown) => Array.isArray(v) && v.length <= 1_000_000 && v.every(id);

/** Grupo de organización guardado (`SceneGroup`); el saneado de ciclos y huérfanos va aparte. */
export const validStoredGroup = shape({
  id, name: (v) => typeof v === 'string' && v.length <= MAX_GROUP_NAME, parentId: optional(id),
  visible: bool, locked: bool, collapsed: bool,
  hiddenByGroup: optional(idList), lockedByGroup: optional(idList),
} satisfies Record<keyof SceneGroup, Rule>) as (v: unknown) => v is SceneGroup;

export const validStoredGroups = (v: unknown): v is SceneGroup[] =>
  v === undefined || (Array.isArray(v) && v.length <= MAX_GROUPS && v.every(validStoredGroup));

export const validStoredObject = shape({ ...metadataFields, mesh: nat }) as
  (v: unknown) => v is ObjectMetadata & { mesh: number };

export type ProjectSettings = Omit<ProjectDocument, keyof ProjectSceneSnapshot | 'past' | 'future'>;
const settingsFields = {
  unitSystem: oneOf('mm', 'cm', 'm', 'in', 'ft'),
  printerProfile: shape({
    id, name: str, brand: oneOf('generic', 'elegoo', 'bambu', 'snapmaker', 'flashforge'),
    bedWidthMm: positive, bedDepthMm: positive, maxHeightMm: positive, showPrintVolume: bool,
    colorSlots: (v) => nat(v) && v > 0, purgeZoneMm: optional(nonnegative),
    // Camas del usuario: margen por lado (opcional; los proyectos anteriores no lo traen).
    marginMm: optional((v) => nonnegative(v) && (v as number) <= 50),
  } satisfies Record<keyof PrinterProfile, Rule>),
  customBedDimensions: (v) => v === null || shape({ width: positive, depth: positive, height: positive })(v),
  sectionPlane: shape({ enabled: bool, heightMm: finite }),
  snapGridMm: nonnegative,
} satisfies Record<keyof ProjectSettings, Rule>;

export const validSettings = shape(settingsFields) as (v: unknown) => v is ProjectSettings;
