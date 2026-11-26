/**
 * @file src/core/scene/__tests__/plateArrange.test.ts
 * @description «Repartir en placas» puro: 20 cajas sin solapes, dentro de la cama con margen, separación respetada y
 * número de placas cerca de la cota por área; determinismo; pieza gigante fuera; placas bloqueadas intactas;
 * criterios por color y por grupo; acompañantes; obstáculos en placas indicadas; placa implícita.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { SceneGroup, SceneObject, Vec3 } from '../../../types/kura';
import type { ScenePlate } from '../../../types/plates';
import { arrangeOnPlates, poseBounds, type ArrangeInput } from '../plateArrange';
import type { ArrangePlan } from '../plateArrangeTypes';

const BED = { widthMm: 200, depthMm: 200, heightMm: 200 };

function boxMesh(w: number, h: number, d: number) {
  const x = w / 2, z = d / 2;
  const positions = new Float32Array([-x, 0, -z, x, 0, -z, x, 0, z, -x, 0, z, -x, h, -z, x, h, -z, x, h, z, -x, h, z]);
  return { positions, indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]) };
}

function box(id: string, size: [number, number, number], position: Vec3 = [0, 0, 0], extra: Partial<SceneObject> = {}): SceneObject {
  return {
    id, name: id, source: 'primitive', position, rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ffffff', role: 'solid', visible: true, locked: false,
    mesh: boxMesh(...size), stats: { triangles: 12, vertices: 8, isManifold: true, volumeMm3: 1, dimensionsMm: size },
    ...extra,
  } as unknown as SceneObject;
}

const input = (objects: SceneObject[], plates: ScenePlate[] = [], options: ArrangeInput['options'] = {}, groups: SceneGroup[] = []): ArrangeInput =>
  ({ objects, plates, groups, projectBed: BED, options });

/** Huella final (mundo) de cada pieza colocada. */
function finalBounds(objects: SceneObject[], plan: ArrangePlan) {
  return plan.placements.map((p) => {
    const o = objects.find((x) => x.id === p.id)!;
    return { id: p.id, plate: p.plate, b: poseBounds(o.mesh, p.position, p.rotation, o.scale)! };
  });
}

function plateOrigin(plan: ArrangePlan, plates: ScenePlate[], key: string): [number, number] {
  return plates.find((p) => p.id === key)?.origin ?? plan.createdPlates.find((c) => c.key === key)?.origin ?? [0, 0];
}

const twenty = () => Array.from({ length: 20 }, (_, i) => box(`b${i}`, [20 + ((i * 37) % 70), 10 + (i % 5) * 8, 15 + ((i * 53) % 60)], [i * 3, 0, 0]));

describe('arrangeOnPlates: compacto', () => {
  it('20 cajas: sin solapes, dentro de la cama con margen, separación y cota de placas', () => {
    const objects = twenty();
    const spacing = 4, margin = 6;
    const plan = arrangeOnPlates(input(objects, [], { spacingMm: spacing, marginMm: margin }));
    expect(plan.report.placed).toHaveLength(20);
    expect(plan.report.unplaced).toEqual([]);
    const fb = finalBounds(objects, plan);
    for (const f of fb) {
      const [ox, oz] = plateOrigin(plan, [], f.plate);
      expect(f.b.minX).toBeGreaterThanOrEqual(ox - BED.widthMm / 2 + margin - 1e-6);
      expect(f.b.maxX).toBeLessThanOrEqual(ox + BED.widthMm / 2 - margin + 1e-6);
      expect(f.b.minZ).toBeGreaterThanOrEqual(oz - BED.depthMm / 2 + margin - 1e-6);
      expect(f.b.maxZ).toBeLessThanOrEqual(oz + BED.depthMm / 2 - margin + 1e-6);
      // La altura no cambia al conservar la orientación.
      expect(f.b.minY).toBeCloseTo(0, 9);
    }
    for (let i = 0; i < fb.length; i++) for (let j = i + 1; j < fb.length; j++) {
      const a = fb[i].b, b = fb[j].b;
      const gapX = Math.max(b.minX - a.maxX, a.minX - b.maxX);
      const gapZ = Math.max(b.minZ - a.maxZ, a.minZ - b.maxZ);
      expect(Math.max(gapX, gapZ)).toBeGreaterThanOrEqual(spacing - 1e-6);
    }
    // Cota inferior por área (con separación) y un margen razonable sobre ella.
    const usable = (BED.widthMm - 2 * margin + spacing) * (BED.depthMm - 2 * margin + spacing);
    const area = objects.reduce((s, o) => s + (o.stats.dimensionsMm[0] + spacing) * (o.stats.dimensionsMm[2] + spacing), 0);
    const lower = Math.ceil(area / usable);
    expect(plan.report.platesUsed.length).toBeGreaterThanOrEqual(lower);
    expect(plan.report.platesUsed.length).toBeLessThanOrEqual(lower + 1);
    // Sin placas: la implícita va primero en el origen y las demás se crean.
    expect(plan.report.platesUsed[0]).toBe('implicit');
    if (plan.createdPlates.length) expect(plan.createdPlates[0]).toEqual({ key: 'implicit', origin: [0, 0] });
  });

  it('es determinista', () => {
    const a = arrangeOnPlates(input(twenty()));
    const b = arrangeOnPlates(input(twenty()));
    expect(a).toEqual(b);
  });

  it('una pieza más grande que la cama queda fuera con motivo; una muy alta, también', () => {
    const plan = arrangeOnPlates(input([box('giant', [300, 10, 50]), box('tall', [20, 500, 20]), box('ok', [20, 20, 20])]));
    expect(plan.report.unplaced).toEqual([{ id: 'giant', reason: 'tooLarge' }, { id: 'tall', reason: 'tooTall' }]);
    expect(plan.report.placed).toEqual(['ok']);
    expect(plan.placements.map((p) => p.id)).toEqual(['ok']);
  });

  it('todo en una placa: no crea placas y no toca la implícita', () => {
    const plan = arrangeOnPlates(input([box('a', [20, 20, 20]), box('b', [20, 20, 20])]));
    expect(plan.createdPlates).toEqual([]);
    expect(plan.report.platesUsed).toEqual(['implicit']);
  });
});

describe('arrangeOnPlates: placas existentes', () => {
  const plates: ScenePlate[] = [
    { id: 'p1', name: 'P1', origin: [0, 0] },
    { id: 'p2', name: 'P2', origin: [250, 0], locked: true },
    { id: 'p3', name: 'P3', origin: [500, 0] },
  ];

  it('no toca piezas ni placas bloqueadas y reutiliza las vacías', () => {
    const objects = [
      box('a', [150, 10, 150], [0, 0, 0], { plateRef: 'p1' }),
      box('b', [150, 10, 150], [250, 0, 0], { plateRef: 'p2' }),
      box('c', [150, 10, 150], [500, 0, 0], { plateRef: 'p3' }),
      box('d', [20, 10, 20], [0, 0, 0], { plateRef: 'p1', locked: true }),
    ];
    const plan = arrangeOnPlates(input(objects, plates));
    expect(plan.placements.map((p) => p.id).sort()).toEqual(['a', 'c']);
    expect(plan.report.skipped).toEqual([{ id: 'b', reason: 'lockedPlate' }]);
    // p1 tiene una pieza bloqueada que se queda: no está vacía, así que se usan p3 y una nueva.
    expect(plan.report.platesUsed[0]).toBe('p3');
    expect(plan.placements.every((p) => p.plate !== 'p2' && p.plate !== 'p1')).toBe(true);
  });

  it('una placa indicada con otras piezas las respeta como obstáculos', () => {
    const objects = [box('fixed', [100, 10, 200], [-50, 0, 0], { plateRef: 'p1', locked: true }), box('m', [80, 10, 80], [500, 0, 0], { plateRef: 'p3' })];
    const plan = arrangeOnPlates(input(objects, plates, { plateIds: ['p1'], spacingMm: 5, marginMm: 0 }));
    const [m] = finalBounds(objects, plan);
    expect(m.plate).toBe('p1');
    expect(m.b.minX).toBeGreaterThanOrEqual(5 - 1e-6);
  });

  it('el informe pide como motivo «locked» si la pieza bloqueada se pidió', () => {
    const plan = arrangeOnPlates(input([box('x', [10, 10, 10], [0, 0, 0], { locked: true })], [], { ids: ['x'] }));
    expect(plan.report.skipped).toEqual([{ id: 'x', reason: 'locked' }]);
    expect(plan.placements).toEqual([]);
  });
});

describe('arrangeOnPlates: criterios', () => {
  it('byColor nunca mezcla colores en una placa', () => {
    const objects = Array.from({ length: 9 }, (_, i) => box(`o${i}`, [30, 10, 30], [0, 0, 0], { color: ['#ff0000', '#00ff00', '#0000FF'][i % 3] }));
    const plan = arrangeOnPlates(input(objects, [], { criterion: 'byColor' }));
    const colorsByPlate = new Map<string, Set<string>>();
    for (const p of plan.placements) {
      const c = objects.find((o) => o.id === p.id)!.color.toLowerCase();
      colorsByPlate.set(p.plate, (colorsByPlate.get(p.plate) ?? new Set()).add(c));
    }
    expect(colorsByPlate.size).toBe(3);
    for (const s of colorsByPlate.values()) expect(s.size).toBe(1);
    // Compacto las habría juntado en una.
    expect(arrangeOnPlates(input(objects)).report.platesUsed).toHaveLength(1);
  });

  it('byGroup junta el grupo raíz y avisa si un grupo se parte', () => {
    const groups: SceneGroup[] = [
      { id: 'g1', name: 'G1', visible: true, locked: false, collapsed: false },
      { id: 'g1a', name: 'G1a', parentId: 'g1', visible: true, locked: false, collapsed: false },
      { id: 'g2', name: 'G2', visible: true, locked: false, collapsed: false },
    ];
    const objects = [
      box('a', [40, 10, 40], [0, 0, 0], { groupRef: 'g1' }),
      box('b', [40, 10, 40], [0, 0, 0], { groupRef: 'g2' }),
      box('c', [40, 10, 40], [0, 0, 0], { groupRef: 'g1a' }),
      box('big1', [180, 10, 180], [0, 0, 0], { groupRef: 'g2' }),
      box('big2', [180, 10, 180], [0, 0, 0], { groupRef: 'g2' }),
    ];
    const plan = arrangeOnPlates(input(objects, [], { criterion: 'byGroup' }, groups));
    const plateOf = (id: string) => plan.placements.find((p) => p.id === id)!.plate;
    expect(plateOf('a')).toBe(plateOf('c'));
    expect(plateOf('a')).not.toBe(plateOf('b'));
    expect(plan.report.splitGroups).toHaveLength(1);
    expect(plan.report.splitGroups[0].groupId).toBe('g2');
    expect(plan.report.splitGroups[0].plates.length).toBeGreaterThanOrEqual(2);
  });
});

describe('arrangeOnPlates: acompañantes', () => {
  it('un agregado y un negativo del grupo viajan con su pieza; un negativo suelto no se mueve', () => {
    const host = box('host', [30, 10, 30], [100, 0, 100], { groupRef: 'g' });
    const addon = box('mag', [6, 3, 6], [100, 7, 100], { role: 'negative', metadata: { addon: { kind: 'magnet_pocket', hostId: 'host' } } as unknown as SceneObject['metadata'] });
    const hole = box('hole', [5, 20, 5], [105, 0, 105], { role: 'negative', groupRef: 'g' });
    const loose = box('loose', [5, 20, 5], [-50, 0, -50], { role: 'negative' });
    const objects = [host, addon, hole, loose];
    const plan = arrangeOnPlates(input(objects));
    const pos = (id: string) => plan.placements.find((p) => p.id === id)?.position;
    const d = [pos('host')![0] - 100, pos('host')![2] - 100];
    expect(pos('mag')).toEqual([100 + d[0], 7, 100 + d[1]]);
    expect(pos('hole')).toEqual([105 + d[0], 0, 105 + d[1]]);
    expect(pos('loose')).toBeUndefined();
    expect(plan.placements.find((p) => p.id === 'mag')!.assignPlate).toBe(false);
    expect(plan.report.placed).toEqual(['host']);
    expect(plan.report.moved).toBe(3);
  });

  it('la huella del bloque incluye al acompañante que sobresale', () => {
    const host = box('host', [20, 10, 20], [0, 0, 0]);
    const post = box('post', [10, 10, 10], [15, 0, 0], { metadata: { addon: { kind: 'screw_boss', hostId: 'host' } } as unknown as SceneObject['metadata'] });
    const plan = arrangeOnPlates(input([host, post], [], { marginMm: 0, spacingMm: 0 }));
    const hostPos = plan.placements.find((p) => p.id === 'host')!.position;
    // Bloque de X ∈ [−10, 20] en la esquina mínima de la cama (−100): la pieza queda en −90.
    expect(hostPos[0]).toBeCloseTo(-90, 9);
  });
});

describe('arrangeOnPlates: orientación', () => {
  it('flatDown usa la pose que entrega el motor y mide la huella con ella', () => {
    const tall = box('t', [10, 150, 10], [0, 0, 0]);
    const plan = arrangeOnPlates({ ...input([tall], [], { orient: 'flatDown', marginMm: 0 }), orientPose: () => ({ position: [0, 5, -75], rotation: [Math.PI / 2, 0, 0] }) });
    const [f] = finalBounds([tall], plan);
    expect(f.b.maxZ - f.b.minZ).toBeCloseTo(150, 6);
    expect(f.b.minY).toBeCloseTo(0, 6);
    expect(plan.placements[0].rotation).toEqual([Math.PI / 2, 0, 0]);
  });

  it('flatDown sin cara plana conserva la orientación y lo informa', () => {
    const plan = arrangeOnPlates({ ...input([box('s', [10, 10, 10])], [], { orient: 'flatDown' }), orientPose: () => null });
    expect(plan.report.keptOrientation).toEqual(['s']);
    expect(plan.placements[0].rotation).toEqual([0, 0, 0]);
  });
});

describe('arrangeOnPlates: cada placa con su cama (P7, dos impresoras)', () => {
  // Proyecto de 200; la placa 1 es una impresora de 256 y la 2 una de 120.
  const PLATES: ScenePlate[] = [
    { id: 'p1', name: 'Grande', origin: [0, 0], bed: { name: 'X1', widthMm: 256, depthMm: 256, heightMm: 256 } },
    { id: 'p2', name: 'Chica', origin: [400, 0], bed: { name: 'Mini', widthMm: 120, depthMm: 120, heightMm: 120 } },
  ];

  it('dos piezas que solo caben en la cama grande van juntas a ella (no salen como «más grande que la cama»)', () => {
    const objects = [box('a', [230, 20, 110]), box('b', [230, 20, 110])];
    const plan = arrangeOnPlates(input(objects, PLATES, { spacingMm: 4, marginMm: 5 }));
    expect(plan.report.unplaced).toEqual([]);
    expect(plan.placements.map((p) => p.plate)).toEqual(['p1', 'p1']);
    for (const f of finalBounds(objects, plan)) {
      expect(f.b.minX).toBeGreaterThanOrEqual(-128 + 5 - 1e-6);
      expect(f.b.maxX).toBeLessThanOrEqual(128 - 5 + 1e-6);
    }
  });

  it('una pieza que no cabe en la chica sí cabe en la grande; la que no cabe en ninguna sale como tooLarge', () => {
    const objects = [box('big', [240, 10, 240]), box('small', [50, 10, 50]), box('huge', [300, 10, 300])];
    const plan = arrangeOnPlates(input(objects, PLATES, { spacingMm: 2, marginMm: 2 }));
    expect(plan.placements.find((p) => p.id === 'big')!.plate).toBe('p1');
    expect(plan.report.unplaced).toEqual([{ id: 'huge', reason: 'tooLarge' }]);
    // La pequeña va a la chica: la grande quedó llena.
    expect(plan.placements.find((p) => p.id === 'small')!.plate).toBe('p2');
    const small = finalBounds(objects, plan).find((f) => f.id === 'small')!.b;
    expect(small.minX).toBeGreaterThanOrEqual(400 - 60 + 2 - 1e-6);
    expect(small.maxX).toBeLessThanOrEqual(400 + 60 - 2 + 1e-6);
  });

  it('la altura se mide contra la cama de cada placa', () => {
    const objects = [box('tall', [50, 200, 50])];
    const plan = arrangeOnPlates(input(objects, [PLATES[1], { ...PLATES[0], origin: [0, -400] }]));
    expect(plan.placements[0].plate).toBe('p1');
  });
});
