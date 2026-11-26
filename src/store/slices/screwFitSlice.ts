/**
 * @file src/store/slices/screwFitSlice.ts
 * @description Roscas emparejadas y comprobación de enroscado en el store: la pareja ISO (perno + tuerca, o agujero
 * roscado + perno) se genera en el Worker con su verificación y entra como UN paso de deshacer, las dos piezas lado a
 * lado en el primer hueco libre; la comprobación entre dos objetos de la escena corre en el Worker sin tocar la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { ScrewFitInput } from '../../core/bus/screwContainerSchema';
import { change } from '../../core/operations/operationTypes';
import type { ThreadPairArgs } from '../../core/operations/screwContainerOperations';
import type { ScrewFitReport } from '../../engine/screwFit';
import type { SceneObject } from '../../types/kura';
import { placementBedSize } from '../bedSize';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';
import { placeRecipeOutputs } from './recipesSlice';

export interface ScrewFitSliceState {
  /** Crea la pareja de roscas con su verificación; null si el motor estaba ocupado o falló (ya se avisó). */
  createThreadPair: (args: ThreadPairArgs) => Promise<{ objects: SceneObject[]; fit: ScrewFitReport } | null>;
  /** Mide el enroscado de `femaleId` (en su posición final) sobre `maleId`. Solo lectura. */
  checkScrewFit: (maleId: string, femaleId: string, input: ScrewFitInput) => Promise<ScrewFitReport>;
}

export function createScrewFitSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { get, tr, runExclusive, runEngine, commitChange } = ctx;
  return {
    createThreadPair: (args) =>
      runExclusive('create_thread', null, async () => {
        await get().initEngine();
        const created = await runEngine('threadPair', args);
        const placed = placeRecipeOutputs(get().objects, created.objects, placementBedSize(get()));
        const objects = [...placed.parts];
        commitChange(change({ added: objects }), { select: objects.map((o) => o.id), spawned: objects });
        get().addToast(tr('toast.created', { name: objects.map((o) => o.name).join(', ') }), 'success');
        return { objects, fit: created.fit };
      }),

    checkScrewFit: async (maleId, femaleId, input) => {
      await get().initEngine();
      const find = (id: string) => get().objects.find((o) => o.id === id);
      const male = find(maleId);
      const female = find(femaleId);
      if (!male || !female) throw new Error('checkScrewFit: objeto desconocido');
      return ctx.runEngineDetached('screwFit', { male, female, input });
    },
  };
}
