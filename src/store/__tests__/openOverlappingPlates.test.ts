/**
 * @file src/store/__tests__/openOverlappingPlates.test.ts
 * @description Abrir un proyecto con placas que se pisan: las placas y sus piezas quedan tal cual (nada se mueve
 * ni se pierde) y se avisa con los nombres de las placas. Sin solapes no hay aviso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { encodeProject } from '../../project/projectCodec';
import { captureProject, useKuraStore } from '../useKuraStore';
import { addBox, resetStore, store } from './storeTestUtils';

async function projectWithPlates(origins: Array<[number, number]>) {
  const a = await addBox(20, [0, 0, 0], { name: 'A' });
  const plates = origins.map((origin, i) => ({ id: `p${i}`, name: `Placa ${i + 1}`, origin }));
  useKuraStore.setState({ plates, objects: store().objects.map((o) => (o.id === a.id ? { ...o, plateRef: 'p1', position: [origins[1][0], 0, origins[1][1]] } : o)) });
  return encodeProject(captureProject(store()));
}

describe('abrir un proyecto con placas solapadas', () => {
  beforeEach(async () => {
    await resetStore();
  });

  it('no mueve placas ni piezas y avisa con los nombres', async () => {
    const bytes = await projectWithPlates([[0, 0], [50, 0]]);
    await resetStore();
    expect(await store().openProject(async () => ({ name: 'solapadas.kura', bytes }))).toBe(true);
    expect(store().plates.map((p) => p.origin)).toEqual([[0, 0], [50, 0]]);
    expect(store().objects[0]).toMatchObject({ plateRef: 'p1', position: [50, 0, 0] });
    const info = store().toasts.filter((t) => t.kind === 'info').map((t) => t.text).join(' ');
    expect(info).toContain('Placa 1 / Placa 2');
  });

  it('sin solapes no avisa', async () => {
    const bytes = await projectWithPlates([[0, 0], [1000, 0]]);
    await resetStore();
    expect(await store().openProject(async () => ({ name: 'separadas.kura', bytes }))).toBe(true);
    expect(store().toasts.some((t) => t.text.includes('Placa 1 /'))).toBe(false);
  });
});
