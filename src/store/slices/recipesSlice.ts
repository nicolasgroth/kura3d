/**
 * @file src/store/slices/recipesSlice.ts
 * @description Recetas en el store: ejecuta una receta completa en el Worker del motor (tarea `runRecipe`) con la
 * cama y el idioma activos, y si sale bien agrega sus salidas como UN paso de deshacer (`commitChange`). Ante un
 * error de la receta no toca la escena: devuelve los errores tipados para que el llamador los muestre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { RecipeRunResult } from '../../core/recipes/run/types';
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
        if (result.ok && result.change.added.length > 0) {
          commitChange(result.change, { select: result.change.added.map((o) => o.id), spawned: result.change.added });
        }
        return result;
      }),
  };
}
