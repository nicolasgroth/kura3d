/**
 * @file src/store/__tests__/splitExport.test.ts
 * @description Exportación de piezas divididas: ZIP con un archivo por pieza nombrado
 * `<proyecto>_<código>.<ext>` (y su `.mtl` al lado) y disposición de impresión para el 3MF.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { ExportTaskArgs } from '../../core/operations/engineTasks';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject } from '../../types/kura';
import { exportSceneFiles } from '../../core/operations/engineTasks';
import { createPrimitiveMesh } from '../../engine';
import { hasSplitParts, printLayoutTargets, printReadyAtOrigin, zipPerPiece } from '../splitExport';

const piece = (id: string, code: string, plate: number): SceneObject => ({
  ...fakeBox(id, code, 10),
  metadata: {
    split: {
      groupId: 'g',
      code,
      cell: [0, 0, 0],
      assembly: { position: [0, 0, 0], rotation: [0, 0, 0] },
      print: { position: [5, 1, -5], rotation: [Math.PI, 0, 0], plate, downFace: '+y' },
      jointLabels: [],
    },
  },
});

const fakeExport = async (a: ExportTaskArgs) =>
  a.format === 'obj'
    ? { files: [{ suffix: '.obj', data: new Uint8Array([1]) }, { suffix: '.mtl', data: new Uint8Array([2]) }] }
    : { files: [{ suffix: `.${a.format}`, data: new Uint8Array([a.targets.length]) }] };

describe('exportación por pieza', () => {
  it('empaqueta un archivo por pieza con <proyecto>_<código>.<ext>', async () => {
    const parts = [piece('a', 'A1', 0), piece('b', 'A2', 1)];
    expect(hasSplitParts(parts)).toBe(true);
    const { data, count } = await zipPerPiece(parts, 'Estatua', { format: 'stl', unitSystem: 'mm' }, fakeExport);
    expect(count).toBe(2);
    expect(Object.keys(unzipSync(data)).sort()).toEqual(['Estatua_A1.stl', 'Estatua_A2.stl']);
    const obj = await zipPerPiece(parts, 'Estatua', { format: 'obj', unitSystem: 'mm' }, fakeExport);
    expect(Object.keys(unzipSync(obj.data)).sort()).toEqual(['Estatua_A1.mtl', 'Estatua_A1.obj', 'Estatua_A2.mtl', 'Estatua_A2.obj']);
  });

  it('la disposición de impresión pone cada placa al lado de la anterior sin tocar los originales', () => {
    const parts = [piece('a', 'A1', 0), piece('b', 'A2', 1), fakeBox('c', 'Suelta', 10)];
    const laid = printLayoutTargets(parts, 200);
    expect(laid[0].position).toEqual([5, 1, -5]);
    expect(laid[1].position[0]).toBeCloseTo(5 + 240, 6);
    expect(laid[1].rotation).toEqual([Math.PI, 0, 0]);
    expect(laid[2]).toBe(parts[2]);
    expect(parts[1].position).toEqual([0, 0, 0]);
  });

  it('cada STL del ZIP sale en orientación de impresión, en Z = 0 y centrado en el origen XY', async () => {
    // Pieza de 40 × 10 × 20 (ancho × alto × fondo del motor) armada lejos del origen, en la placa 3.
    const mesh = await createPrimitiveMesh('box', { width: 40, height: 10, depth: 20 });
    const far: SceneObject = { ...piece('a', 'A1', 3), mesh, position: [1900, 300, -700] };
    far.metadata!.split!.print.rotation = [0, 0, Math.PI / 2];
    const ready = printReadyAtOrigin(far);
    expect(far.position).toEqual([1900, 300, -700]);
    const { data } = await zipPerPiece([far], 'P', { format: 'stl', unitSystem: 'mm' }, exportSceneFiles);
    const stl = unzipSync(data)['P_A1.stl'];
    const view = new DataView(stl.buffer, stl.byteOffset, stl.byteLength);
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let t = 0; t < view.getUint32(80, true); t++) {
      for (let k = 0; k < 3; k++) {
        for (let a = 0; a < 3; a++) {
          const v = view.getFloat32(84 + t * 50 + 12 + k * 12 + a * 4, true);
          lo[a] = Math.min(lo[a], v);
          hi[a] = Math.max(hi[a], v);
        }
      }
    }
    // Ejes del STL: X, Y (fondo), Z (altura). Girada 90° sobre el eje de profundidad del motor: 10 × 20 × 40.
    expect(hi.map((v, a) => +(v - lo[a]).toFixed(3))).toEqual([10, 20, 40]);
    expect(lo[2]).toBeCloseTo(0, 4);
    expect((lo[0] + hi[0]) / 2).toBeCloseTo(0, 4);
    expect((lo[1] + hi[1]) / 2).toBeCloseTo(0, 4);
    expect(ready.rotation).toEqual([0, 0, Math.PI / 2]);
  });
});
