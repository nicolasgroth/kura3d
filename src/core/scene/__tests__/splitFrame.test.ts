/**
 * @file src/core/scene/__tests__/splitFrame.test.ts
 * @description Marco de las placas virtuales de Dividir por placa real: sin placas (o una en el origen) es la
 * cuadrícula de siempre bit a bit; en otra placa se ancla a su origen y salta las celdas que pisan placas reales;
 * la disposición de un grupo usa la placa de cada pieza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { SceneObject, SplitPartMetadata, Vec3 } from '../../../types/kura';
import type { ScenePlate } from '../../../types/plates';
import { bedsSeparated, PLATE_GAP_MM } from '../plates';
import { MAX_SPLIT_FRAME_SCAN, splitFrameFor, splitFramesOf, splitGroupFrame } from '../splitFrame';
import {
  arrangeSplitGroupPatches, MAX_SPLIT_PLATES, plateOffset, splitArrangementOf, splitGroupOf, splitTransformFor, type SplitGroup,
} from '../splitGroups';

const BED = { widthMm: 220, depthMm: 200, heightMm: 250 };
const P1: ScenePlate = { id: 'p1', name: 'Placa 1', origin: [0, 0] };
const P2: ScenePlate = { id: 'p2', name: 'Placa 2', origin: [260, 0] };
const P3: ScenePlate = { id: 'p3', name: 'Placa 3', origin: [520, 0] };

function part(id: string, plate: number, plateRef?: string, at?: Vec3): SceneObject {
  const split: SplitPartMetadata = {
    groupId: 'g', code: id, index: [0, 0, 0],
    assembly: { position: [1, 2, 3], rotation: [0, 0, 0] },
    print: { position: [10, 0, -20], rotation: [0, Math.PI / 2, 0], plate },
  } as unknown as SplitPartMetadata;
  return {
    id, name: id, role: 'solid', visible: true, locked: false,
    position: at ?? [1, 2, 3], rotation: [0, 0, 0], scale: [1, 1, 1],
    stats: { dimensionsMm: [10, 10, 10] }, metadata: { split }, ...(plateRef ? { plateRef } : {}),
  } as unknown as SceneObject;
}

const group = (parts: SceneObject[]): SplitGroup => splitGroupOf(parts, parts[0].id)!;

describe('splitFrame', () => {
  it('sin placas, el marco es la cuadrícula de siempre (bit a bit)', () => {
    const frame = splitFrameFor(null, { plates: [], projectBed: BED });
    for (let k = 0; k < 9; k++) expect(frame.center(k)).toEqual(plateOffset(k, BED.widthMm, BED.depthMm));
    const parts = [part('a', 0), part('b', 1), part('c', 5)];
    const g = group(parts);
    const frames = splitFramesOf({ plates: [], projectBed: BED });
    expect(arrangeSplitGroupPatches(g, 'print', frames)).toEqual(arrangeSplitGroupPatches(g, 'print', BED.widthMm, BED.depthMm));
  });

  it('con una sola placa en el origen, idéntico a sin placas', () => {
    const parts = [part('a', 0, 'p1'), part('b', 1, 'p1'), part('c', 4, 'p1')];
    const g = group(parts);
    const frames = splitFramesOf({ plates: [P1], projectBed: BED });
    expect(arrangeSplitGroupPatches(g, 'print', frames)).toEqual(arrangeSplitGroupPatches(g, 'print', BED.widthMm, BED.depthMm));
  });

  it('en la placa 2, la placa virtual 0 es la placa 2 y las demás no pisan placas reales', () => {
    const source = { plates: [P1, P2, P3], projectBed: BED };
    const frame = splitFrameFor(P2, source);
    expect(frame.center(0)).toEqual([260, 0]);
    for (let k = 1; k < 12; k++) {
      const [x, z] = frame.center(k);
      for (const p of [P1, P3]) expect(bedsSeparated(x, z, BED, p.origin[0], p.origin[1], BED, PLATE_GAP_MM)).toBe(true);
    }
    // Celda 1 de la cuadrícula desde la placa 2 (x = 520) es la placa 3: se salta a la siguiente.
    expect(frame.center(1)).toEqual([260 + 2 * (BED.widthMm + PLATE_GAP_MM), 0]);
    // Las placas virtuales no se repiten.
    const keys = new Set(Array.from({ length: 12 }, (_, k) => frame.center(k).join(',')));
    expect(keys.size).toBe(12);
  });

  it('preparar para imprimir en la placa 2 deja la parte 0 sobre la placa 2 y es estable ida y vuelta', () => {
    const source = { plates: [P1, P2], projectBed: BED };
    const frames = splitFramesOf(source);
    const parts = [part('a', 0, 'p2'), part('b', 1, 'p2')];
    const g = group(parts);
    expect(splitArrangementOf(g, frames)).toBe('assembly');
    const toPrint = arrangeSplitGroupPatches(g, 'print', frames);
    const a = toPrint.find((p) => p.id === 'a')!.patch.position;
    expect(a).toEqual([10 + 260, 0, -20]);
    const printed = parts.map((o) => ({ ...o, ...toPrint.find((p) => p.id === o.id)!.patch }));
    const pg = group(printed);
    expect(splitArrangementOf(pg, frames)).toBe('print');
    // Con el marco viejo (desde el origen) ya no se reconoce: era el fallo.
    expect(splitArrangementOf(pg, BED.widthMm, BED.depthMm)).toBeNull();
    expect(arrangeSplitGroupPatches(pg, 'print', frames)).toEqual([]);
    const back = arrangeSplitGroupPatches(pg, 'assembly', frames);
    const reassembled = printed.map((o) => ({ ...o, ...back.find((p) => p.id === o.id)!.patch }));
    const again = arrangeSplitGroupPatches(group(reassembled), 'print', frames);
    expect(again).toEqual(toPrint);
  });

  it('la cama de la placa propia define el paso de la cuadrícula', () => {
    const own: ScenePlate = { ...P2, bed: { name: 'Otra', widthMm: 150, depthMm: 150, heightMm: 150 } };
    const frame = splitFrameFor(own, { plates: [P1, own], projectBed: BED });
    expect(frame.widthMm).toBe(150);
    expect(frame.center(1)).toEqual([260 + 150 + PLATE_GAP_MM, 0]);
    expect(splitTransformFor(part('a', 1).metadata!.split!, 'print', frame).position).toEqual([10 + 260 + 190, 0, -20]);
  });

  it('un índice de placa gigante (dato externo) termina al instante y sin llenar la lista', () => {
    const frame = splitFrameFor(P2, { plates: [P1, P2, P3], projectBed: BED });
    const t0 = performance.now();
    for (const plate of [MAX_SPLIT_PLATES, 1e9, Number.MAX_SAFE_INTEGER, -1, 2.5]) {
      const c = frame.center(plate);
      expect(c).toHaveLength(2);
    }
    // Un índice válido alto sigue saltando placas reales y el trabajo queda bajo el tope fijo.
    expect(frame.center(MAX_SPLIT_PLATES - 1)).toHaveLength(2);
    expect(performance.now() - t0).toBeLessThan(200);
    expect(MAX_SPLIT_FRAME_SCAN).toBeGreaterThanOrEqual(MAX_SPLIT_PLATES);
  });

  it('el marco del grupo es el de la placa de la mayoría de sus piezas', () => {
    const source = { plates: [P1, P2], projectBed: BED };
    const g = group([part('a', 0, 'p2'), part('b', 1, 'p2'), part('c', 1, 'p1')]);
    expect(splitGroupFrame(g, source).center(0)).toEqual([260, 0]);
  });
});
