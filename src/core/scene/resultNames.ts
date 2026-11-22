/**
 * @file src/core/scene/resultNames.ts
 * @description Nombres de los objetos que producen las operaciones. Las operaciones de
 * `src/core/operations` piden el nombre a un `ResultNaming`; la app lo implementa con claves i18n
 * (`createKeyedNaming`) y el MCP headless con sus nombres fijos. Así la diferencia es explícita y
 * está en un solo lugar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
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
  cutHalf(source: SceneObject, half: 'a' | 'b'): string;
  piece(source: SceneObject, index: number): string;
  colorPart(source: SceneObject, color: string, index: number): string;
  moldPart(source: SceneObject, part: { label: string; nameSuffix: string }): string;
  hull(targets: SceneObject[]): string;
  thread(options: ThreadOptions): string;
  structurePart(source: SceneObject, regions: DetectedStructureRegion[], region: DetectedStructureRegion): string;
  /** Pieza de "dividir para imprimir" por su código de rejilla ("A1", "B2a"). */
  splitPart(source: SceneObject, code: string): string;
}

export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Nombres de la app: claves i18n más etiquetas de color y estructura del idioma activo. */
export function createKeyedNaming(
  tr: Translate,
  labels: {
    color: (hex: string) => string;
    structure: (regions: DetectedStructureRegion[], regionId: string) => string;
  },
): ResultNaming {
  const primitiveLabel = (type: PrimitiveType) => tr(`sidebar.primitive.${type}` as TranslationKey);
  return {
    primitive: (type, count) => `${primitiveLabel(type)} ${count + 1}`,
    modulePrefix: (isHole) => (isHole ? '−' : '+'),
    primitiveLabel,
    booleanResult: (op, inputs) =>
      op === 'subtract'
        ? inputs.map((o) => o.name).join(' − ')
        : tr(op === 'union' ? 'object.name.union' : 'object.name.intersect', { count: inputs.length }),
    cutHalf: (src, half) => `${src.name} — ${tr(half === 'a' ? 'cut.half.a' : 'cut.half.b')}`,
    piece: (src, i) => `${src.name} — ${tr('object.name.piece', { n: i + 1 })}`,
    colorPart: (src, color) => `${src.name} — ${labels.color(color)}`,
    moldPart: (src, part) => `${tr(`mold.part.${part.label}` as TranslationKey)} — ${src.name}`,
    hull: (targets) => tr('object.name.hull', { count: targets.length }),
    thread: (o) => `${tr(`store.thread.${o.kind}` as TranslationKey)} M${o.diameterMm}×${o.pitchMm}`,
    structurePart: (src, regions, region) => `${src.name} — ${labels.structure(regions, region.id)}`,
    splitPart: (src, code) => `${src.name} · ${code}`,
  };
}
