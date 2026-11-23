/**
 * @file src/store/__tests__/exportTargets.test.ts
 * @description La selección de exportación es la misma en el diálogo y en el Command Bus: excluye
 * huecos sin aplicar (también dentro de la selección), y lo avisa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { selectExportTargets } from '../exportTargets';
import { addBox, resetStore, store } from './storeTestUtils';

describe('Selección de exportación compartida', () => {
  beforeEach(() => resetStore());

  it('excluye huecos de la selección y cuenta los omitidos', async () => {
    const solid = await addBox(10);
    const hole = await addBox(4, [0, 0, 0], { role: 'negative' });
    const sel = selectExportTargets(store().objects, [solid.id, hole.id], true);
    expect(sel.targets.map((o) => o.id)).toEqual([solid.id]);
    expect(sel.skippedHoles).toBe(1);
  });

  it('el bus no exporta el hueco seleccionado', async () => {
    const solid = await addBox(10);
    const hole = await addBox(4, [0, 0, 0], { role: 'negative' });
    store().selectObject(solid.id);
    store().selectObject(hole.id, true);
    const res = await store().executeCommand({ id: '1', command: 'export_stl', params: { onlySelected: true, returnBytes: true } });
    expect(res.ok).toBe(true);
    expect((res.result as { triangleCount: number }).triangleCount).toBe(12);
    expect((res.result as { skippedHoles?: number }).skippedHoles).toBe(1);
  });
});
