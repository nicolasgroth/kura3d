/**
 * @file src/store/__tests__/moveToPlateLlaveros.store.test.ts
 * @description Caso real: importar llaveros.3mf (3MF de laminador con dos placas), «Convertir en placas» y mover una
 * pieza de la primera placa a la segunda: la caja queda dentro de la cama destino. Se salta si el archivo no existe.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { existsSync, readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { plateBed } from '../../core/scene/plates';
import { footprintOf } from '../../core/scene/freeSpot';
import { projectBed } from '../../core/scene/activePlateBed';
import { useKuraStore } from '../useKuraStore';
import { resetStore, store } from './storeTestUtils';

const FILE = 'G:/proyectos/kura3d/.eval-tmp/modelos/llaveros.3mf';

describe.skipIf(!existsSync(FILE))('Mover a placa con llaveros.3mf real', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print', plateSolo: false });
  });

  it('la pieza movida queda dentro de la cama destino', async () => {
    const buf = readFileSync(FILE);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    await store().importModelFiles([{ name: 'llaveros.3mf', size: ab.byteLength, read: async () => ab }]);
    const res = store().convertGroupsToPlates();
    expect(res?.created.length).toBe(2);
    const [p1, p2] = store().plates;
    const piece = store().objects.find((o) => o.plateRef === p1.id)!;
    store().selectObject(piece.id);
    store().moveToPlate(p2.id);
    const moved = store().objects.find((o) => o.id === piece.id)!;
    const fp = footprintOf(moved.mesh, moved.position, moved.rotation, moved.scale)!;
    const b = plateBed(p2, projectBed(store()));
    expect(moved.plateRef).toBe(p2.id);
    // La placa 2 está llena (25 piezas): no hay hueco libre, pero la pieza queda dentro de la cama y el aviso lo dice.
    expect(store().lastMoveToPlateCrowded).toBe(true);
    expect(fp.minX).toBeGreaterThanOrEqual(p2.origin[0] - b.widthMm / 2 - 1e-6);
    expect(fp.maxX).toBeLessThanOrEqual(p2.origin[0] + b.widthMm / 2 + 1e-6);
    expect(fp.minZ).toBeGreaterThanOrEqual(p2.origin[1] - b.depthMm / 2 - 1e-6);
    expect(fp.maxZ).toBeLessThanOrEqual(p2.origin[1] + b.depthMm / 2 + 1e-6);
  });
});
