/**
 * @file src/core/assembly/__tests__/assemblyInstructions.test.ts
 * @description Instrucciones de armado (núcleo puro): orden determinista en divisiones 2×1 y 2×2×1 (base = la pieza
 * que apoya y, a igual altura, la de más volumen), respeto del orden validado al dividir, uniones con imanes y para
 * pegar, plano inclinado (`normal`), avisos (débil, sostener, suelta) y lista de materiales.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { computeAssemblyInstructions } from '../assemblyInstructions';
import type { InstructionPartInput } from '../assemblyInstructionsTypes';
import type { SplitJointRecord } from '../../../types/kura';

type JointOpts = Partial<SplitJointRecord>;

function joint(label: string, axis: 'x' | 'y' | 'z', a: string, b: string, opts: JointOpts = {}): SplitJointRecord {
  return {
    label, axis, position: 50, a, b, kind: 'connector',
    connector: { type: 'dowel', size: 3, depth: 8, tolerance: 0.2, count: 2 },
    connectorCenters: [[0, 0, 0], [1, 0, 0]],
    contactAreaMm2: 2500,
    ...opts,
  };
}

function part(code: string, bottomMm: number, volumeMm3: number, joints: SplitJointRecord[], extra: Partial<InstructionPartInput> = {}): InstructionPartInput {
  return { id: `id-${code}`, code, name: `Caja · ${code}`, volumeMm3, bottomMm, joints: joints.filter((j) => j.a === code || j.b === code), ...extra };
}

describe('computeAssemblyInstructions', () => {
  it('2×1: base la de más volumen; la otra entra por su cara izquierda con 2 espigas de 6 mm', () => {
    const joints = [joint('1', 'x', 'A1', 'B1')];
    const out = computeAssemblyInstructions({ parts: [part('B1', 0, 900, joints), part('A1', 0, 1000, joints)] });
    expect(out.steps.map((s) => s.code)).toEqual(['A1', 'B1']);
    expect(out.steps[0].base).toBe(true);
    expect(out.steps[0].direction).toBeNull();
    const s2 = out.steps[1];
    expect(s2.joins).toHaveLength(1);
    expect(s2.joins[0]).toMatchObject({ partnerCode: 'A1', face: '-x', method: 'dowel', count: 2, diameterMm: 6, tilted: false });
    expect(s2.direction?.axis).toBe('-x');
    expect(s2.partIds).toEqual(['id-B1', 'id-A1']);
    expect(out.materials).toMatchObject({ printedParts: 2, joints: 1, glueJoints: 0, connectorJoints: 1, magnets: [] });
  });

  it('2×1 con el mismo volumen: desempata por código y no depende del orden de entrada', () => {
    const joints = [joint('1', 'x', 'A1', 'B1')];
    const a = computeAssemblyInstructions({ parts: [part('A1', 0, 1000, joints), part('B1', 0, 1000, joints)] });
    const b = computeAssemblyInstructions({ parts: [part('B1', 0, 1000, joints), part('A1', 0, 1000, joints)] });
    expect(a).toEqual(b);
    expect(a.steps.map((s) => s.code)).toEqual(['A1', 'B1']);
    // B1 en el lado positivo del eje: entra moviéndose hacia −X; A1 armada después entraría hacia +X.
    expect(a.steps[1].direction?.vector).toEqual([-1, 0, 0]);
  });

  it('2×2×1: abajo primero, luego arriba; la última pieza se une con dos', () => {
    const joints = [
      joint('1', 'x', 'A1', 'B1'),
      joint('2', 'x', 'A2', 'B2'),
      joint('3', 'y', 'A1', 'A2'),
      joint('4', 'y', 'B1', 'B2'),
    ];
    const parts = [part('B2', 50, 1000, joints), part('A2', 50, 1000, joints), part('B1', 0, 1000, joints), part('A1', 0, 1000, joints)];
    const out = computeAssemblyInstructions({ parts });
    expect(out.steps.map((s) => s.code)).toEqual(['A1', 'B1', 'A2', 'B2']);
    const a2 = out.steps[2];
    expect(a2.joins.map((j) => j.partnerCode)).toEqual(['A1']);
    // A2 está sobre A1 (lado + del eje Y del motor = arriba): baja (−Z del usuario) y apoya en su cara inferior.
    expect(a2.joins[0].face).toBe('-z');
    expect(a2.direction?.axis).toBe('-z');
    expect(a2.warnings).toEqual([]);
    const b2 = out.steps[3];
    expect(b2.joins.map((j) => j.label).sort()).toEqual(['2', '4']);
    expect(b2.partIds).toEqual(['id-B2', 'id-A2', 'id-B1']);
    expect(out.materials.joints).toBe(4);
  });

  it('sigue el orden validado al dividir y su dirección de entrada cuando existe', () => {
    const joints = [joint('1', 'x', 'A1', 'B1'), joint('2', 'x', 'B1', 'C1')];
    const parts = [
      part('A1', 0, 1000, joints, { assemblyStep: 3, insertDirection: '+x' }),
      part('B1', 0, 1000, joints, { assemblyStep: 1 }),
      part('C1', 0, 1000, joints, { assemblyStep: 2, insertDirection: '-x' }),
    ];
    const out = computeAssemblyInstructions({ parts });
    expect(out.steps.map((s) => s.code)).toEqual(['B1', 'C1', 'A1']);
    expect(out.steps[2].direction?.axis).toBe('+x');
  });

  it('imanes: pares por unión, aviso de polaridad y conteo de imanes sueltos por medida', () => {
    const magnet = { shape: 'round' as const, sizeMm: 6, heightMm: 3, clearanceMm: 0.2, depthClearanceMm: 0.3, hidden: false };
    const joints = [
      joint('1', 'x', 'A1', 'B1', {
        connector: { type: 'magnet', size: 3.1, depth: 3.3, tolerance: 0.2, count: 2, magnet },
        magnets: { magnet, count: 2, pocketDiameterMm: 6.2, pocketDepthMm: 3.3, polarity: 'opposite' },
      }),
    ];
    const out = computeAssemblyInstructions({ parts: [part('A1', 0, 1000, joints), part('B1', 0, 900, joints)] });
    const j = out.steps[1].joins[0];
    expect(j).toMatchObject({ method: 'magnet', count: 2, magnet: { shape: 'round', sizeMm: 6, heightMm: 3 } });
    expect(out.steps[1].warnings).toContainEqual({ code: 'magnet-polarity', joint: '1' });
    expect(out.materials.magnets).toEqual([{ shape: 'round', sizeMm: 6, heightMm: 3, count: 4 }]);
  });

  it('para pegar: método glue, cuenta en la lista y pide sostener una pieza que no apoya en nada', () => {
    const joints = [joint('1', 'x', 'A1', 'B1', { kind: 'glue', connector: null, connectorCenters: [] })];
    // B1 cuelga al costado de A1: su base está 20 mm sobre la mesa y no tiene nada debajo.
    const out = computeAssemblyInstructions({ parts: [part('A1', 0, 1000, joints), part('B1', 20, 300, joints)] });
    const s = out.steps[1];
    expect(s.joins[0]).toMatchObject({ method: 'glue', count: 0 });
    expect(s.joins[0].diameterMm).toBeUndefined();
    expect(s.warnings).toContainEqual({ code: 'hold-piece' });
    expect(out.materials).toMatchObject({ glueJoints: 1, connectorJoints: 0 });
  });

  it('plano inclinado: la cara y la dirección siguen la normal de la unión', () => {
    const n: [number, number, number] = [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 0];
    const joints = [joint('1', 'x', 'A1', 'B1', { normal: n })];
    const out = computeAssemblyInstructions({ parts: [part('A1', 0, 1000, joints), part('B1', 0, 900, joints)] });
    const s = out.steps[1];
    expect(s.joins[0].tilted).toBe(true);
    expect(s.joins[0].face).toBe('-x');
    // B1 (lado +) entra contra la normal: (−cos30°, −sin30°, 0) del motor = (−0,866, 0, −0,5) del usuario.
    expect(s.direction?.axis).toBe('-x');
    expect(s.direction?.vector[0]).toBeCloseTo(-0.866, 3);
    expect(s.direction?.vector[1]).toBeCloseTo(0, 6);
    expect(s.direction?.vector[2]).toBeCloseTo(-0.5, 3);
  });

  it('avisa la unión débil (firmeza guardada o informe) y la pieza trabada', () => {
    const strength = {
      level: 'weak' as const, reasons: ['single-connector' as const], count: 1, sizeMm: 2, depthMm: 6, areaRatio: 0.01,
      islands: 1, islandsCovered: 1, shrunk: [], discarded: [],
    };
    const joints = [joint('1', 'x', 'A1', 'B1', { strength }), joint('2', 'x', 'B1', 'C1')];
    const out = computeAssemblyInstructions({
      parts: [part('A1', 0, 1000, joints), part('B1', 0, 900, joints), part('C1', 0, 800, joints)],
      weakJoints: ['2'],
      blocked: ['C1'],
    });
    expect(out.steps[1].warnings).toContainEqual({ code: 'weak-joint', joint: '1' });
    expect(out.steps[1].joins[0].firmness).toBe('weak');
    expect(out.steps[2].warnings).toContainEqual({ code: 'weak-joint', joint: '2' });
    expect(out.steps[2].warnings).toContainEqual({ code: 'blocked' });
  });

  it('una pieza sin uniones con el resto queda como bloque aparte, avisada', () => {
    const joints = [joint('1', 'x', 'A1', 'B1')];
    const out = computeAssemblyInstructions({ parts: [part('A1', 0, 1000, joints), part('B1', 0, 900, joints), part('C1', 0, 50, [])] });
    expect(out.steps.map((s) => s.code)).toEqual(['A1', 'B1', 'C1']);
    expect(out.steps[2]).toMatchObject({ base: true, joins: [], direction: null });
    expect(out.steps[2].warnings).toContainEqual({ code: 'not-connected' });
  });

  it('tarugos sueltos: método y lotes en la lista de materiales', () => {
    const joints = [joint('1', 'x', 'A1', 'B1', { connector: { type: 'loose-dowel', size: 2.5, depth: 8, tolerance: 0.2, count: 3 }, connectorCenters: [[0, 0, 0], [1, 0, 0], [2, 0, 0]] })];
    const out = computeAssemblyInstructions({
      parts: [part('A1', 0, 1000, joints), part('B1', 0, 900, joints)],
      dowels: [{ diameterMm: 5, lengthMm: 16, count: 3 }],
    });
    expect(out.steps[1].joins[0]).toMatchObject({ method: 'loose-dowel', count: 3, diameterMm: 5 });
    expect(out.materials.looseDowels).toEqual([{ diameterMm: 5, lengthMm: 16, count: 3 }]);
  });

  it('sin piezas: sin pasos', () => {
    expect(computeAssemblyInstructions({ parts: [] }).steps).toEqual([]);
  });
});
