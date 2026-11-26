/**
 * @file src/engine/__tests__/cutConnectors.test.ts
 * @description Corte por plano con conectores: valida tamaño, cantidad y profundidad contra la
 * cara de corte real (caja, tubo) con errores tipados, y verifica que un caso válido deje el
 * alojamiento hembra dentro de la pieza (sin perforar la superficie exterior).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { PlaneCutOptions } from '../../types/kura';
import { planeCutWithConnectors } from '../operations';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { makeObject, shellCount } from './geometryTestUtils';

const CUT: PlaneCutOptions = {
  axis: 'y',
  offset: 0,
  connectorType: 'peg',
  connectorSize: 3,
  connectorDepth: 5,
  tolerance: 0.25,
  connectorCount: 2,
  keepMode: 'both',
};

describe('Corte con conectores validado contra la cara (operations.ts)', () => {
  it('peg 30 mm ×4 en una caja de 40 mm lanza CUT_CONNECTOR_TOO_LARGE', async () => {
    const box = await createPrimitiveMesh('box', { width: 40, height: 40, depth: 40 });
    await expect(
      planeCutWithConnectors(makeObject('b', box), { ...CUT, connectorSize: 30, connectorCount: 4 })
    ).rejects.toMatchObject({ code: 'CUT_CONNECTOR_TOO_LARGE' });
  });

  it('en la pared delgada de un tubo, un dowel que la atraviesa se rechaza', async () => {
    const tube = await createPrimitiveMesh('tube', { outerRadius: 12, innerRadius: 9, height: 30 });
    await expect(
      planeCutWithConnectors(makeObject('t', tube), { ...CUT, connectorType: 'dowel', connectorSize: 2.5, connectorCount: 2 })
    ).rejects.toMatchObject({ code: 'CUT_CONNECTOR_TOO_LARGE' });
  });

  // Con 9.5 mm la zona segura (≈18.9 mm de lado) no admite 4 alojamientos a ≥ 20.3 mm; 8 mm sí caben en las esquinas
  it('4 dowels de 9.5 mm en una caja de 40 mm se solapan: CUT_CONNECTORS_OVERLAP', async () => {
    const box = await createPrimitiveMesh('box', { width: 40, height: 40, depth: 40 });
    await expect(
      planeCutWithConnectors(makeObject('o', box), { ...CUT, connectorType: 'dowel', connectorSize: 9.5, connectorCount: 4 })
    ).rejects.toMatchObject({ code: 'CUT_CONNECTORS_OVERLAP' });
  });

  it('un conector más profundo que la mitad receptora lanza CUT_CONNECTOR_TOO_DEEP', async () => {
    const box = await createPrimitiveMesh('box', { width: 40, height: 10, depth: 40 });
    await expect(
      planeCutWithConnectors(makeObject('d', box), { ...CUT, connectorDepth: 6 })
    ).rejects.toMatchObject({ code: 'CUT_CONNECTOR_TOO_DEEP' });
  });

  it('cantidad no entera o valores no finitos se rechazan sin corregir en silencio', async () => {
    const box = await createPrimitiveMesh('box', { width: 40, height: 40, depth: 40 });
    for (const bad of [{ connectorCount: 2.5 }, { connectorCount: 9 }, { connectorSize: Number.NaN }, { tolerance: -1 }]) {
      await expect(planeCutWithConnectors(makeObject('n', box), { ...CUT, ...bad })).rejects.toMatchObject({
        code: 'INVALID_PARAMETER',
      });
    }
  });

  it('un caso válido deja ambas mitades watertight y de un solo cuerpo', async () => {
    const box = await createPrimitiveMesh('box', { width: 40, height: 40, depth: 40 });
    const res = await planeCutWithConnectors(makeObject('ok', box), { ...CUT, connectorCount: 4 });
    for (const half of [res.positive!, res.negative!]) {
      expect(computeMeshStats(half.mesh).isManifold).toBe(true);
      expect(await shellCount(half.mesh)).toBe(1);
    }
  });
});
