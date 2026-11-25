/**
 * @file src/core/scene/__tests__/layoutPoses.test.ts
 * @description Pruebas de las dos poses (imprimir / armado): ida y vuelta bit a bit, materializar la pose de
 * impresión al entrar en armado, piezas sin `restPose` (misma pose), piezas divididas derivadas de
 * `metadata.split`, seguidores (agregado con anfitrión y negativo de grupo) y `posedObjects` sin tocar la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../../../engine';
import type { MeshData, SceneObject, SplitPartMetadata, Vec3 } from '../../../types/kura';
import {
  applyLayoutPatches, layoutPoseOf, posedObjects, switchLayoutPatches, type LayoutContext,
} from '../layoutPoses';
import { plateOffset } from '../splitGroups';

function cube(size = 10): MeshData {
  const h = size / 2;
  const v = [[-h, 0, -h], [h, 0, -h], [h, size, -h], [-h, size, -h], [-h, 0, h], [h, 0, h], [h, size, h], [-h, size, h]];
  const f = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
  return { positions: new Float32Array(v.flat()), indices: new Uint32Array(f) };
}

function obj(id: string, extra: Partial<SceneObject> = {}, position: Vec3 = [0, 0, 0]): SceneObject {
  const mesh = cube();
  return {
    id, name: id, source: 'primitive', position, rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ff0000',
    role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh), ...extra,
  };
}

const CTX: LayoutContext = { bed: { widthMm: 220, depthMm: 200 } };

function splitMeta(code: string, assembly: Vec3, print: Vec3, plate = 0): SplitPartMetadata {
  return {
    groupId: 'g', code, cell: [0, 0, 0], jointLabels: [],
    assembly: { position: assembly, rotation: [0, 0, 0] },
    print: { position: print, rotation: [Math.PI / 2, 0, 0], plate, downFace: '-y' },
  };
}

const sw = (objects: SceneObject[], from: 'print' | 'assembly', to: 'print' | 'assembly') =>
  applyLayoutPatches(objects, switchLayoutPatches(objects, from, to, CTX));

describe('switchLayoutPatches', () => {
  it('mismo modo: sin parches', () => {
    const objects = [obj('a', { restPose: { position: [1, 2, 3], rotation: [0, 0, 0] } })];
    expect(switchLayoutPatches(objects, 'print', 'print', CTX)).toEqual([]);
    expect(sw(objects, 'assembly', 'assembly')).toBe(objects);
  });

  it('intercambia pose viva y restPose', () => {
    const a = obj('a', { restPose: { position: [50, 0, 0], rotation: [0, 1, 0] } }, [1, 2, 3]);
    const [out] = sw([a], 'print', 'assembly');
    expect(out.position).toEqual([50, 0, 0]);
    expect(out.rotation).toEqual([0, 1, 0]);
    expect(out.restPose).toEqual({ position: [1, 2, 3], rotation: [0, 0, 0] });
    // El original no se toca.
    expect(a.position).toEqual([1, 2, 3]);
  });

  it('ida y vuelta print → assembly → print deja la escena bit a bit igual', () => {
    const scene = [
      obj('plano', {}, [10, 0, 5]),
      obj('conPose', { restPose: { position: [0, 30, 0], rotation: [0.5, 0, 0] } }, [-20, 0, 0]),
      obj('ref', { role: 'reference' }, [3, 3, 3]),
      obj('neg', { role: 'negative' }, [1, 1, 1]),
      obj('parte', { metadata: { split: splitMeta('A1', [0, 10, 0], [5, 0, 5], 1) } }, [7, 0, 7]),
    ];
    const snapshot = structuredClone(scene.map(({ mesh: _m, ...rest }) => rest));
    const back = sw(sw(scene, 'print', 'assembly'), 'assembly', 'print');
    expect(back.map(({ mesh: _m, ...rest }) => rest)).toStrictEqual(snapshot);
    // Las piezas que no cambian conservan la misma referencia.
    expect(back[2]).toBe(scene[2]);
  });

  it('ida y vuelta assembly → print → assembly con poses explícitas también es exacta', () => {
    const scene = [
      obj('a', { restPose: { position: [9, 0, 9], rotation: [0, 0, 0] } }, [1, 50, 1]),
      obj('b', { restPose: { position: [-9, 0, 9], rotation: [0, 0, 1] } }, [2, 60, 2]),
    ];
    const back = sw(sw(scene, 'assembly', 'print'), 'print', 'assembly');
    expect(back).toStrictEqual(scene);
  });

  it('al entrar en armado cada sólido guarda su pose de impresión aunque no cambie', () => {
    const [a, ref] = sw([obj('a', {}, [4, 0, 4]), obj('ref', { role: 'reference' })], 'print', 'assembly');
    expect(a.position).toEqual([4, 0, 4]);
    expect(a.restPose).toEqual({ position: [4, 0, 4], rotation: [0, 0, 0] });
    // Una referencia queda igual en ambos modos (sin restPose).
    expect(ref.restPose).toBeUndefined();
  });

  it('editar en armado no toca la pose de impresión', () => {
    const assembled = sw([obj('a', {}, [4, 0, 4])], 'print', 'assembly');
    const moved = assembled.map((o) => ({ ...o, position: [100, 20, 0] as Vec3, rotation: [0, 0.3, 0] as Vec3 }));
    const [printed] = sw(moved, 'assembly', 'print');
    expect(printed.position).toEqual([4, 0, 4]);
    expect(printed.rotation).toEqual([0, 0, 0]);
    expect(printed.restPose).toEqual({ position: [100, 20, 0], rotation: [0, 0.3, 0] });
    const [again] = sw([printed], 'print', 'assembly');
    expect(again.position).toEqual([100, 20, 0]);
  });

  it('lo creado en armado (sin restPose) queda en la misma pose en imprimir', () => {
    const [nuevo] = sw([obj('nuevo', {}, [30, 0, 30])], 'assembly', 'print');
    expect(nuevo.position).toEqual([30, 0, 30]);
    expect(nuevo.restPose).toBeUndefined();
  });

  it('pieza dividida sin restPose: se deriva de metadata.split en ambos sentidos', () => {
    const meta = splitMeta('A1', [0, 10, 0], [5, 0, 5], 2);
    const [ox, oz] = plateOffset(2, CTX.bed.widthMm, CTX.bed.depthMm);
    // Creada en imprimir (en su placa): al armar va a su pose de armado.
    const [armada] = sw([obj('p', { metadata: { split: meta } }, [5 + ox, 0, 5 + oz])], 'print', 'assembly');
    expect(armada.position).toEqual([0, 10, 0]);
    expect(armada.restPose?.position).toEqual([5 + ox, 0, 5 + oz]);
    // Creada en armado: al imprimir va a su placa virtual.
    const [impresa] = sw([obj('q', { metadata: { split: meta } }, [0, 10, 0])], 'assembly', 'print');
    expect(impresa.position).toEqual([5 + ox, 0, 5 + oz]);
    expect(impresa.rotation).toEqual([Math.PI / 2, 0, 0]);
    // Su pose de armado es la derivada: no se guarda.
    expect(impresa.restPose).toBeUndefined();
  });

  it('un agregado ligado acompaña a su pieza y vuelve exacto', () => {
    const host = obj('host', { restPose: { position: [0, 40, 0], rotation: [0, 0, 0] } }, [0, 0, 0]);
    const post = obj('post', {
      metadata: { addon: { kind: 'screw_boss', part: 'post', params: {} as never, anchorMm: 2, hostId: 'host' } },
    }, [3, 10, 0]);
    const assembled = sw([host, post], 'print', 'assembly');
    expect(assembled[1].position[1]).toBeCloseTo(50, 9);
    expect(assembled[1].restPose?.position).toEqual([3, 10, 0]);
    const back = sw(assembled, 'assembly', 'print');
    expect(back[1]).toStrictEqual(post);
  });

  it('un negativo de grupo sigue a su única pieza; con piezas que se mueven distinto se queda', () => {
    const host = obj('host', { groupRef: 'G', restPose: { position: [10, 0, 0], rotation: [0, 0, 0] } }, [0, 0, 0]);
    const hole = obj('hole', { groupRef: 'G', role: 'negative' }, [1, 2, 3]);
    const [, followed] = sw([host, hole], 'print', 'assembly');
    expect(followed.position[0]).toBeCloseTo(11, 9);
    const back = sw(sw([host, hole], 'print', 'assembly'), 'assembly', 'print');
    expect(back[1]).toStrictEqual(hole);
    // Segunda pieza del grupo con otro movimiento: ambiguo, el negativo no se mueve (riesgo 3).
    const other = obj('other', { groupRef: 'G', restPose: { position: [0, 0, 99], rotation: [0, 0, 0] } });
    const [, , stay] = sw([host, other, hole], 'print', 'assembly');
    expect(stay.position).toEqual([1, 2, 3]);
    expect(stay.restPose).toBeUndefined();
  });
});

describe('posedObjects y layoutPoseOf', () => {
  const scene = [
    obj('a', { restPose: { position: [0, 50, 0], rotation: [0, 0, 0] } }, [5, 0, 5]),
    obj('b', {}, [1, 0, 1]),
  ];

  it('mismo modo devuelve la escena tal cual', () => {
    expect(posedObjects(scene, 'print', 'print', CTX)).toBe(scene);
  });

  it('da copias en la pose pedida sin tocar la escena', () => {
    const posed = posedObjects(scene, 'print', 'assembly', CTX);
    expect(posed[0].position).toEqual([0, 50, 0]);
    expect(scene[0].position).toEqual([5, 0, 5]);
    expect(posed[1].position).toEqual([1, 0, 1]);
    expect(posed[0].mesh).toBe(scene[0].mesh);
  });

  it('exportar desde armado da lo mismo que desde imprimir', () => {
    const assembled = sw(scene, 'print', 'assembly');
    const fromAssembly = posedObjects(assembled, 'assembly', 'print', CTX);
    const fromPrint = posedObjects(scene, 'print', 'print', CTX);
    expect(fromAssembly.map((o) => [o.position, o.rotation])).toEqual(fromPrint.map((o) => [o.position, o.rotation]));
  });

  it('layoutPoseOf: pose de una pieza en el modo pedido', () => {
    expect(layoutPoseOf(scene, scene[0], 'print', 'assembly', CTX).position).toEqual([0, 50, 0]);
    expect(layoutPoseOf(scene, scene[1], 'print', 'assembly', CTX).position).toEqual([1, 0, 1]);
  });
});
