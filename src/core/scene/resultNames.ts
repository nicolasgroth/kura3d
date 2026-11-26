/**
 * @file src/core/scene/resultNames.ts
 * @description Nombres de los objetos que producen las operaciones. Las operaciones de
 * `src/core/operations` piden el nombre a un `ResultNaming`; la app lo implementa con claves i18n
 * (`createKeyedNaming`) y el MCP headless con sus nombres fijos. Así la diferencia es explícita y
 * está en un solo lugar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { TranslationKey } from '../../i18n';
import type {
  BooleanOpType,
  DetectedStructureRegion,
  PrimitiveType,
  SceneObject,
  ThreadOptions,
} from '../../types/kura';

/** Nombres de resultado por operación. `index` empieza en 0. */
export interface ResultNaming {
  primitive(type: PrimitiveType, sceneCount: number): string;
  modulePrefix(isHole: boolean): string;
  primitiveLabel(type: PrimitiveType): string;
  booleanResult(op: BooleanOpType, inputs: SceneObject[]): string;
  /** `axis` es el eje de corte como lo ve el usuario (X, Y o Z): la mitad A es su lado − y la B su lado +. */
  cutHalf(source: SceneObject, half: 'a' | 'b', axis: 'X' | 'Y' | 'Z'): string;
  piece(source: SceneObject, index: number): string;
  colorPart(source: SceneObject, color: string, index: number): string;
  moldPart(source: SceneObject, part: { label: string; nameSuffix: string }): string;
  hull(targets: SceneObject[]): string;
  thread(options: ThreadOptions): string;
  structurePart(source: SceneObject, regions: DetectedStructureRegion[], region: DetectedStructureRegion): string;
  /** Pieza de "dividir para imprimir" por su código de rejilla ("A1", "B2a"). */
  splitPart(source: SceneObject, code: string): string;
  /** Lote de tarugos sueltos de una división ("Tarugo Ø8×11,6 ×6"). */
  looseDowel(diameterMm: number, lengthMm: number, count: number): string;
}

/** Medida corta para nombres (hasta 1 decimal, sin ceros de más) con punto decimal: modo sin interfaz. */
export const shortMm = (v: number) => String(Math.round(v * 10) / 10);

/**
 * Medida corta con el separador decimal del idioma (coma en es, de y fr), sin separador de miles:
 * la usa la app para los nombres; el modo sin interfaz usa `shortMm`.
 */
export function localeShortMm(lang: string, v: number): string {
  try {
    return new Intl.NumberFormat(lang, { maximumFractionDigits: 1, useGrouping: false }).format(Math.round(v * 10) / 10);
  } catch {
    return shortMm(v);
  }
}

export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Nombres de la app: claves i18n más etiquetas de color y estructura del idioma activo. */
export function createKeyedNaming(
  tr: Translate,
  labels: {
    color: (hex: string) => string;
    structure: (regions: DetectedStructureRegion[], regionId: string) => string;
    /** Medida corta para nombres; por defecto `shortMm` (punto decimal). */
    shortMm?: (v: number) => string;
  },
): ResultNaming {
  const primitiveLabel = (type: PrimitiveType) => tr(`sidebar.primitive.${type}` as TranslationKey);
  const mm = labels.shortMm ?? shortMm;
  return {
    primitive: (type, count) => `${primitiveLabel(type)} ${count + 1}`,
    modulePrefix: (isHole) => (isHole ? '−' : '+'),
    primitiveLabel,
    booleanResult: (op, inputs) =>
      op === 'subtract'
        ? inputs.map((o, i) => (i === 0 ? o.name : withoutModulePrefix(o.name))).join(' − ')
        : tr(op === 'union' ? 'object.name.union' : 'object.name.intersect', { count: inputs.length }),
    cutHalf: (src, half, axis) => `${src.name} · ${tr(half === 'a' ? 'cut.half.a' : 'cut.half.b', { axis })}`,
    piece: (src, i) => `${src.name} — ${tr('object.name.piece', { n: i + 1 })}`,
    colorPart: (src, color) => `${src.name} — ${labels.color(color)}`,
    moldPart: (src, part) => `${tr(`mold.part.${part.label}` as TranslationKey)} — ${src.name}`,
    hull: (targets) => tr('object.name.hull', { count: targets.length }),
    thread: (o) => `${tr(`store.thread.${o.kind}` as TranslationKey)} M${o.diameterMm}×${o.pitchMm}`,
    structurePart: (src, regions, region) => `${src.name} — ${labels.structure(regions, region.id)}`,
    splitPart: (src, code) => `${src.name} · ${code}`,
    looseDowel: (d, l, count) => tr('object.name.looseDowel', { d: mm(d), l: mm(l), count }),
  };
}

const escapeRegExp = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * «Etiqueta N» con el menor N ≥ 1 que no usa ya otro objeto de la escena con esa misma etiqueta
 * (así una sola caja se llama «Caja 1» aunque antes se hayan creado y borrado otras).
 */
export function nextNumberedName(label: string, existingNames: Iterable<string>): string {
  const pattern = new RegExp(`^${escapeRegExp(label)} (\\d+)$`);
  const used = new Set<number>();
  for (const name of existingNames) {
    const match = pattern.exec(name);
    if (match) used.add(Number(match[1]));
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `${label} ${n}`;
}

/** Nombre sin el prefijo de módulo («− Rosca» → «Rosca»): en una resta el signo ya lo pone el « − ». */
export function withoutModulePrefix(name: string): string {
  return name.replace(/^[+−-]\s*/, '');
}
