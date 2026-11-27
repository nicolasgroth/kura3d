/**
 * @file src/store/slices/recipesSlice.ts
 * @description Recetas en el store: ejecuta una receta completa en el Worker del motor (tarea `runRecipe`) con la
 * cama y el idioma activos, y si sale bien agrega sus salidas como UN paso de deshacer (`commitChange`). Ante un
 * error de la receta no toca la escena: devuelve los errores tipados para que el llamador los muestre. Las salidas
 * se colocan como bloque en el primer hueco libre de la cama; si el bloque no cabe, cada pieza va a su propio hueco
 * (y se avisa solo si alguna pieza de verdad no cabe).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { EngineJob } from '../../core/operations/engineClient';
import type { SceneChange } from '../../core/operations';
import type { RecipeRunResult, RecipeRunSuccess } from '../../core/recipes/run/types';
import { placeGroupInFreeSpot, placeInFreeSpot, type BedSize } from '../../core/scene/freeSpot';
import type { LanguageCode, SceneObject } from '../../types/kura';
import { t } from '../../i18n';
import { placementBedSize } from '../bedSize';
import { planReplacement, stampRecipeRun } from '../recipeRuns';
import { makeId } from '../../core/scene/sceneObjects';
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
  /**
   * `null` si otra operación ocupaba el motor o el Worker falló (el error ya se avisó). Con `precomputed` (el
   * resultado de la vista previa de las mismas respuestas) no recalcula: solo coloca e inserta.
   */
  runRecipe: (request: RecipeRunRequest, precomputed?: RecipeRunSuccess) => Promise<RecipeRunResult | null>;
  /**
   * Reabrir un juego: ejecuta la receta y reemplaza las piezas `targetIds` por las nuevas en UN paso de deshacer
   * (conserva posición, nombre cambiado, color y grupo). Mismo contrato de retorno que `runRecipe`.
   */
  updateRecipeRun: (request: RecipeRunRequest, targetIds: readonly string[], precomputed?: RecipeRunSuccess) => Promise<RecipeRunResult | null>;
  /**
   * Tarea de solo calcular (vista previa): no toma el bloqueo, no toca la escena ni el historial; cancelable.
   * `onProgress` recibe las fases del motor (`compute` cuando empieza a calcular, tras la cola y la carga del motor).
   */
  startRecipePreview: (request: RecipeRunRequest, onProgress?: (phase: string) => void) => EngineJob<RecipeRunResult>;
  /**
   * Coloca el resultado de una receta como lo haría crear (o, con `targetIds`, reemplazando ese juego): devuelve el
   * cambio listo para insertar sin tocar la escena. La vista previa y crear usan esta misma función.
   */
  placeRecipeResult: (result: RecipeRunSuccess, request: RecipeRunRequest, targetIds?: readonly string[]) => { change: SceneChange; fits: boolean };
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
  const { get, runExclusive, runEngine, commitChange, startEngineJob } = ctx;

  const taskArgs = (request: RecipeRunRequest) => {
    const s = get();
    const chosen = chosenObjectIds(request.answers);
    return {
      recipe: request.recipe,
      answers: request.answers ?? {},
      options: { ...(request.variant !== undefined ? { variant: request.variant } : {}), bed: recipeBed(s), language: request.language ?? s.language },
      ...(request.files ? { files: request.files } : {}),
      sceneObjects: s.objects.filter((o) => chosen.has(o.id)),
    };
  };

  const place = (result: RecipeRunSuccess, request: RecipeRunRequest, targetIds?: readonly string[]) => {
    const now = get();
    let change = result.change;
    let fits = true;
    const old = targetIds?.length ? now.objects.filter((o) => targetIds.includes(o.id)) : [];
    if (old.length > 0) {
      // Reabrir: las piezas nuevas ocupan el lugar de las viejas.
      const run = old.find((o) => o.metadata?.recipe?.run)?.metadata?.recipe?.run ?? makeId('run');
      const plan = planReplacement(old, change.added, run);
      return { change: { ...change, added: plan.added, removedIds: plan.removedIds }, fits };
    }
    // Las piezas salen de la receta alrededor del origen. Si la receta trabaja sobre un objeto de la escena,
    // sus salidas ya están ubicadas respecto de él y no se mueven.
    if (chosenObjectIds(request.answers).size === 0) {
      const placed = placeRecipeOutputs(now.objects, change.added, placementBedSize(now));
      fits = placed.fits;
      if (placed.parts !== change.added) change = { ...change, added: [...placed.parts] };
    }
    return { change: { ...change, added: stampRecipeRun(change.added, makeId('run')) }, fits };
  };

  const run = (name: string, request: RecipeRunRequest, precomputed: RecipeRunSuccess | undefined, targetIds?: readonly string[]) =>
    runExclusive(name, null, async () => {
      await get().initEngine();
      const result: RecipeRunResult = precomputed ?? (await runEngine('runRecipe', taskArgs(request)));
      if (!result.ok || result.change.added.length === 0) return result;
      const placed = place(result, request, targetIds);
      if (!placed.fits) get().addToast(t(get().language, 'toast.placedOutsideBed'), 'warning');
      commitChange(placed.change, { select: placed.change.added.map((o) => o.id), spawned: placed.change.added });
      return { ...result, change: placed.change };
    });

  return {
    runRecipe: (request, precomputed) => run('run_recipe', request, precomputed),
    updateRecipeRun: (request, targetIds, precomputed) => run('run_recipe', request, precomputed, targetIds),
    startRecipePreview: (request, onProgress) => startEngineJob('runRecipe', taskArgs(request), onProgress) as EngineJob<RecipeRunResult>,
    placeRecipeResult: place,
  };
}
