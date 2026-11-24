/**
 * @file src/store/slices/recipesSlice.ts
 * @description Recetas en el store: ejecuta una receta completa en el Worker del motor (tarea `runRecipe`) con la
 * cama y el idioma activos, y si sale bien agrega sus salidas como UN paso de deshacer (`commitChange`). Ante un
 * error de la receta no toca la escena: devuelve los errores tipados para que el llamador los muestre. Las salidas
 * se colocan como bloque en el primer hueco libre de la cama; si el bloque no cabe, cada pieza va a su propio hueco
 * (y se avisa solo si alguna pieza de verdad no cabe).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { RecipeRunResult } from '../../core/recipes/run/types';
import { placeGroupInFreeSpot, placeInFreeSpot, type BedSize } from '../../core/scene/freeSpot';
import type { SceneObject } from '../../types/kura';
import { t } from '../../i18n';
import { activeBedSize } from '../bedSize';
import type { LanguageCode } from '../../types/kura';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export interface RecipeRunRequest {
  readonly recipe: unknown;
  readonly answers?: unknown;
  readonly variant?: string;
  readonly language?: LanguageCode;
  /** Contenido de los parámetros `file` (texto SVG o bytes), por id de parámetro. */
  readonly files?: Readonly<Record<string, string | Uint8Array>>;
}

export interface RecipesSliceState {
  /** `null` si otra operación ocupaba el motor o el Worker falló (el error ya se avisó). */
  runRecipe: (request: RecipeRunRequest) => Promise<RecipeRunResult | null>;
}

/** Cama activa (perfil o medidas propias) en mm, ejes del usuario: ancho, fondo y alto. */
export function recipeBed(s: Pick<KuraStoreState, 'printerProfile' | 'customBedDimensions'>) {
  const custom = s.customBedDimensions;
  return custom
    ? { w: custom.width, d: custom.depth, h: custom.height }
    : { w: s.printerProfile.bedWidthMm, d: s.printerProfile.bedDepthMm, h: s.printerProfile.maxHeightMm };
}

/** Ids de objetos de la escena que las respuestas eligen en parámetros `object`. */
function chosenObjectIds(answers: unknown): Set<string> {
  const ids = new Set<string>();
  if (answers && typeof answers === 'object') {
    for (const value of Object.values(answers)) {
      const id = value && typeof value === 'object' ? (value as { objectId?: unknown }).objectId : undefined;
      if (typeof id === 'string') ids.add(id);
    }
  }
  return ids;
}

/**
 * Coloca las salidas de una receta. Primero como bloque (conservan su distancia, p. ej. la tapa junto a su caja) en
 * el primer hueco libre; si el bloque no cabe en la cama, cada pieza va sola a su propio hueco libre (las ya puestas
 * cuentan como ocupadas). `fits` es false solo si alguna pieza, por sí sola, no cabe.
 */
export function placeRecipeOutputs(
  objects: readonly SceneObject[],
  parts: readonly SceneObject[],
  bed: BedSize | null,
): { parts: readonly SceneObject[]; fits: boolean } {
  const group = placeGroupInFreeSpot(objects, parts, bed);
  if (group.fits || parts.length < 2) {
    const [dx, , dz] = group.offset;
    if (dx === 0 && dz === 0) return { parts, fits: group.fits };
    return { parts: parts.map((o) => ({ ...o, position: [o.position[0] + dx, o.position[1], o.position[2] + dz] })), fits: group.fits };
  }
  const out: SceneObject[] = [];
  let fits = true;
  for (const part of parts) {
    const spot = placeInFreeSpot([...objects, ...out], part.mesh, part.rotation, part.scale, bed);
    fits &&= spot.fits;
    // La altura la decide la receta (ya apoyada en la cama); solo se mueve en planta.
    out.push({ ...part, position: [spot.position[0], part.position[1], spot.position[2]] });
  }
  return { parts: out, fits };
}

export function createRecipesSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { get, runExclusive, runEngine, commitChange } = ctx;
  return {
    runRecipe: (request) =>
      runExclusive('run_recipe', null, async () => {
        await get().initEngine();
        const s = get();
        const chosen = chosenObjectIds(request.answers);
        const result = await runEngine('runRecipe', {
          recipe: request.recipe,
          answers: request.answers ?? {},
          options: { ...(request.variant !== undefined ? { variant: request.variant } : {}), bed: recipeBed(s), language: request.language ?? s.language },
          ...(request.files ? { files: request.files } : {}),
          sceneObjects: s.objects.filter((o) => chosen.has(o.id)),
        });
        if (!result.ok || result.change.added.length === 0) return result;
        // Las piezas salen de la receta alrededor del origen. Si la receta trabaja sobre un objeto de la escena,
        // sus salidas ya están ubicadas respecto de él y no se mueven.
        let change = result.change;
        if (chosen.size === 0) {
          const now = get();
          const placed = placeRecipeOutputs(now.objects, change.added, activeBedSize(now));
          if (placed.parts !== change.added) change = { ...change, added: [...placed.parts] };
          if (!placed.fits) now.addToast(t(now.language, 'toast.placedOutsideBed'), 'info');
        }
        commitChange(change, { select: change.added.map((o) => o.id), spawned: change.added });
        return change === result.change ? result : { ...result, change };
      }),
  };
}
