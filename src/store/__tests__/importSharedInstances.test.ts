/**
 * @file src/store/__tests__/importSharedInstances.test.ts
 * @description Instancias repetidas de un 3MF (como un llavero usado decenas de veces): las piezas que
 * referencian el mismo objeto con la misma rotación/escala comparten la MISMA malla (referencia, sin
 * copia), quedan en su posición del archivo, el análisis es uno por malla, y el aviso de malla abierta es
 * uno por malla única («usada en N piezas») con un botón que repara todas en serie. Además: una
 * operación sobre una pieza no altera la malla de las demás (copia al escribir).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseModelFile } from '../../engine';
import { modelXml, pack3mf, translate } from '../../engine/__tests__/ioFixtures';
import { useKuraStore } from '../useKuraStore';
import { worldBox } from '../unitRescale';

const get = useKuraStore.getState;
let empty: ReturnType<typeof get>;

/** Tetraedro abierto (le falta una cara) de lado `s`. */
const openTetraXml = (s: number) =>
  `<mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="${s}" y="0" z="0"/><vertex x="0" y="${s}" z="0"/><vertex x="0" y="0" z="${s}"/></vertices>` +
  `<triangles><triangle v1="0" v2="2" v3="1"/><triangle v1="0" v2="1" v3="3"/><triangle v1="0" v2="3" v3="2"/></triangles></mesh>`;
const closedTetraXml = (s: number) =>
  openTetraXml(s).replace('</triangles>', '<triangle v1="1" v2="2" v3="3"/></triangles>');

const A_COUNT = 30;
const B_COUNT = 10;
const llaveros = () => pack3mf({
  '3D/3dmodel.model': modelXml(
    `<object id="1" name="Llavero">${openTetraXml(10)}</object><object id="2" name="Argolla">${closedTetraXml(4)}</object>`,
    Array.from({ length: A_COUNT }, (_, i) => `<item objectid="1" transform="${translate(i * 15, 0, 0)}"/>`).join('') +
    Array.from({ length: B_COUNT }, (_, i) => `<item objectid="2" transform="${translate(i * 15, 40, 0)}"/>`).join(''),
  ),
});

beforeAll(async () => {
  await get().initEngine();
  empty = get();
});
beforeEach(() => useKuraStore.setState({ ...empty, objects: [], groups: [], toasts: [], selectedIds: [] }, true));

describe('instancias repetidas de un 3MF', () => {
  it('comparten la malla por referencia y conservan su posición', () => {
    const model = parseModelFile('llaveros.3mf', llaveros());
    expect(model.parts).toHaveLength(A_COUNT + B_COUNT);
    expect(new Set(model.parts.map((p) => p.mesh)).size).toBe(2);
    expect(new Set(model.parts.map((p) => p.analysis)).size).toBe(2);
    // La pieza i del llavero está 15·i mm a la derecha de la primera (X derecha).
    const a = model.parts.filter((p) => p.name.startsWith('Llavero'));
    expect(a[0].translation).toBeUndefined();
    a.slice(1).forEach((p, i) => expect(p.translation?.[0]).toBeCloseTo((i + 1) * 15, 5));
  });

  it('en la escena las piezas comparten malla, un aviso por malla única y «Reparar todas» repara la malla una vez', async () => {
    const repairObjectMeshes = vi.fn(async () => null);
    useKuraStore.setState({ repairObjectMeshes });
    await get().importModelFiles([{ name: 'llaveros.3mf', read: async () => llaveros() }], { placement: 'original' });
    const objects = get().objects;
    expect(objects).toHaveLength(A_COUNT + B_COUNT);
    expect(new Set(objects.map((o) => o.mesh)).size).toBe(2);
    // Posiciones del archivo: las cajas mundiales de dos llaveros vecinos se separan 15 mm en X.
    const llavero = objects.filter((o) => o.name.startsWith('Llavero'));
    const x0 = worldBox([llavero[0]])!.min[0];
    const x1 = worldBox([llavero[1]])!.min[0];
    expect(x1 - x0).toBeCloseTo(15, 4);
    const openToasts = get().toastHistory.filter((t) => t.text.includes('abierta'));
    expect(openToasts).toHaveLength(1);
    expect(openToasts[0].text).toContain(`usada en ${A_COUNT} piezas`);
    expect(openToasts[0].actions?.[0]?.label).toBe('Reparar todas');
    openToasts[0].actions![0].run();
    // Un solo grupo: las 30 piezas que comparten la malla abierta.
    expect(repairObjectMeshes).toHaveBeenCalledExactlyOnceWith([llavero.map((o) => o.id)]);
  });

  it('«Reparar todas» con varias mallas abiertas: cada malla se repara una vez, todas quedan cerradas y un aviso resume', async () => {
    const twoOpen = pack3mf({
      '3D/3dmodel.model': modelXml(
        `<object id="1" name="Llavero">${openTetraXml(10)}</object><object id="2" name="Dije">${openTetraXml(6)}</object>`,
        [0, 1, 2].map((i) => `<item objectid="1" transform="${translate(i * 15, 0, 0)}"/>`).join('') +
          `<item objectid="2" transform="${translate(0, 40, 0)}"/>`,
      ),
    });
    await get().importModelFiles([{ name: 'dos.3mf', read: async () => twoOpen }], { placement: 'original' });
    const toast = get().toastHistory.find((t) => t.actions?.[0]?.label === 'Reparar todas');
    expect(toast).toBeTruthy();
    toast!.actions![0].run();
    await vi.waitFor(() => expect(get().toastHistory.some((t) => t.text.includes('Se repararon y cerraron'))).toBe(true));
    const summary = get().toastHistory.find((t) => t.text.includes('Se repararon y cerraron'))!;
    expect(summary.text).toContain('2 mallas (las usan 4 piezas)');
    expect(summary.kind).toBe('success');
    // Un solo aviso de reparación (no uno por pieza)
    expect(get().toastHistory.filter((t) => t.text.startsWith('Malla reparada:'))).toHaveLength(0);
    const objects = get().objects;
    const llaveros3 = objects.filter((o) => o.name.startsWith('Llavero'));
    expect(new Set(llaveros3.map((o) => o.mesh)).size).toBe(1);
    for (const o of objects) {
      const d = await get().diagnoseObjectMesh(o.id, { highlight: false });
      expect(d?.closed, o.name).toBe(true);
    }
  });

  it('modificar una pieza no toca la malla compartida de las demás', async () => {
    await get().importModelFiles([{ name: 'llaveros.3mf', read: async () => llaveros() }], { placement: 'original' });
    const [first, second] = get().objects;
    expect(first.mesh).toBe(second.mesh);
    const shared = second.mesh;
    const snapshot = { positions: Array.from(shared.positions), indices: Array.from(shared.indices), faceColors: shared.faceColors?.slice() };
    // Pintar (pincel en una cara) y reparar la primera pieza.
    get().paintObjectSurface(first.id, null, 0, 'brush');
    await get().repairObjectMesh(first.id);
    const firstAfter = get().objects.find((o) => o.id === first.id)!;
    const secondAfter = get().objects.find((o) => o.id === second.id)!;
    expect(firstAfter.mesh).not.toBe(shared);
    expect(secondAfter.mesh).toBe(shared);
    expect(Array.from(shared.positions)).toEqual(snapshot.positions);
    expect(Array.from(shared.indices)).toEqual(snapshot.indices);
    expect(shared.faceColors?.slice()).toEqual(snapshot.faceColors);
  });
});
