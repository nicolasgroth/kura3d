/**
 * @file src/utils/structureLabels.ts
 * @description Nombres traducidos y neutros de las sub-estructuras detectadas ("Parte 1 · cilíndrica"): las
 * categorías orgánicas del motor (extremidad, tanque, casco) no tienen sentido en piezas mecánicas, así que la
 * etiqueta solo describe la forma y el orden.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t, type TranslationKey } from '../i18n';
import type { DetectedStructureRegion, LanguageCode, StructuralArchetype } from '../types/kura';

const SHAPE_KEY: Record<Exclude<StructuralArchetype, 'main_body'>, TranslationKey> = {
  tube_conduit: 'structure.shape.cylindrical',
  tank_cylinder: 'structure.shape.cylindrical',
  block_plate: 'structure.shape.flat',
  dome_helmet: 'structure.shape.curved',
  appendage: 'structure.shape.elongated',
  detail_part: 'structure.shape.compact',
};

/** Etiqueta de la región `regionId` dentro de `regions`: "Cuerpo principal" o "Parte N · forma". */
export function structureLabel(
  lang: LanguageCode,
  regions: readonly Pick<DetectedStructureRegion, 'id' | 'archetype'>[],
  regionId: string,
): string {
  let n = 0;
  for (const region of regions) {
    if (region.archetype === 'main_body') {
      if (region.id === regionId) return t(lang, 'structure.main');
      continue;
    }
    n += 1;
    if (region.id === regionId) {
      return t(lang, 'structure.part', { n, shape: t(lang, SHAPE_KEY[region.archetype]) });
    }
  }
  return regionId;
}
