/**
 * @file src/store/__tests__/assistantsPlacement.test.ts
 * @description Colocación del juego de piezas de una receta (motor real): si el bloque caja + tapa no cabe en la
 * cama pero cada pieza sí, cada una va a su propio hueco libre, dentro de la cama y sin aviso; el aviso «fuera de
 * la cama» queda solo para piezas que de verdad no caben.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { builtinRecipe } from '../../core/recipes/builtin';
import { footprintOf } from '../../core/scene/freeSpot';
import { t } from '../../i18n';
import { closeAssistants, runAssistant } from '../assistantsPanel';
import { resetStore, store } from './storeTestUtils';

const fp = (o: ReturnType<typeof store>['objects'][number]) => footprintOf(o.mesh, o.position, o.rotation, o.scale)!;
const outsideToast = () => store().toastHistory.some((x) => x.text === t('es', 'toast.placedOutsideBed'));

describe('colocación de las salidas de un asistente', () => {
  beforeEach(async () => {
    await resetStore('es');
    closeAssistants();
  });

  it('caja de 120 mm: el bloque (124 + 10 + 124) no cabe, pero cada pieza va a su hueco dentro de la cama', async () => {
    const outcome = await runAssistant({ recipe: builtinRecipe('kura.caja-tapa'), answers: { w: 120 } });
    expect(outcome.status).toBe('created');
    const bed = store().printerProfile;
    expect(124 + 10 + 124).toBeGreaterThan(bed.bedWidthMm);
    const [box, lid] = store().objects.map(fp);
    for (const f of [box, lid]) {
      expect(f.maxX - f.minX).toBeCloseTo(124, 3);
      expect(f.minX).toBeGreaterThanOrEqual(-bed.bedWidthMm / 2 - 1e-6);
      expect(f.maxX).toBeLessThanOrEqual(bed.bedWidthMm / 2 + 1e-6);
      expect(f.minZ).toBeGreaterThanOrEqual(-bed.bedDepthMm / 2 - 1e-6);
      expect(f.maxZ).toBeLessThanOrEqual(bed.bedDepthMm / 2 + 1e-6);
    }
    const overlap = box.minX < lid.maxX && box.maxX > lid.minX && box.minZ < lid.maxZ && box.maxZ > lid.minZ;
    expect(overlap).toBe(false);
    expect(outsideToast()).toBe(false);
  });

  it('caja de 300 mm: la pieza de verdad no cabe y avisa «fuera de la cama»', async () => {
    await runAssistant({ recipe: builtinRecipe('kura.caja-tapa'), answers: { w: 300 } });
    expect(store().objects).toHaveLength(2);
    expect(outsideToast()).toBe(true);
  });
});
