/**
 * @file src/store/slices/layoutSlice.ts
 * @description Modo de vista de la escena (imprimir / armado): `setLayout` intercambia pose viva y `restPose` de
 * cada pieza con `switchLayoutPatches` (único dueño del invariante). No agrega paso de deshacer: la instantánea
 * del historial guarda `layout` y `restPose`, así que deshacer o rehacer devuelve la escena en el modo en que se
 * hizo cada paso. Los agregados ligados y los negativos de grupo se mueven en los mismos parches; el seguimiento
 * automático de imanes del store ve que ya se movieron y los respeta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { applyLayoutPatches, DEFAULT_LAYOUT, switchLayoutPatches } from '../../core/scene/layoutPoses';
import { layoutContextOf } from '../sceneLayout';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export function createLayoutSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, runtime, rejectWhileLocked } = ctx;
  return {
    layout: DEFAULT_LAYOUT,

    setLayout: (to) => {
      const state = get();
      if (to !== 'print' && to !== 'assembly') return false;
      if (state.layout === to) return false;
      // Un arrastre o un trazo sin soltar guardó la escena de antes: cambiar de pose ahora la desfasaría.
      if (rejectWhileLocked() || runtime.paintStroke.open) return false;
      const patches = switchLayoutPatches(state.objects, state.layout, to, layoutContextOf(state));
      set({ layout: to, ...(patches.length ? { objects: applyLayoutPatches(state.objects, patches) } : {}) });
      return true;
    },
  };
}
