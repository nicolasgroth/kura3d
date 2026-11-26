/**
 * @file src/engine/__tests__/assemblyValidation.test.ts
 * @description Validación de armado (`validateAssembly`) con casos construidos a propósito: tramos en
 * línea, rejilla 2×2×2 con espigas en todas las uniones (bloqueo y arreglo mínimo), conectores que se
 * cruzan, conector poco firme, pieza en L cuyo recorrido topa con otra y tiempo en rejilla 4×4×3.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { MeshData, Vec3 } from '../../types/kura';
import { validateAssembly, type AssemblyJointInput, type AssemblyPartInput, type SplitAxis, type SplitConnectorOptions } from '../split';

/** Malla de una o varias cajas (mundo) que solo se tocan por caras. */
function boxes(...bs: Array<[Vec3, Vec3]>): MeshData {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const [lo, hi] of bs) {
    const o = pos.length / 3;
    for (let c = 0; c < 8; c++) pos.push(c & 1 ? hi[0] : lo[0], c & 2 ? hi[1] : lo[1], c & 4 ? hi[2] : lo[2]);
    // Caras hacia afuera (−x, +x, −y, +y, −z, +z)
    const f = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]];
    for (const [a, b, c, d] of f) idx.push(o + a, o + b, o + c, o + a, o + c, o + d);
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}
const part = (code: string, ...bs: Array<[Vec3, Vec3]>): AssemblyPartInput => ({ code, mesh: boxes(...bs), assembly: { position: [0, 0, 0], rotation: [0, 0, 0] } });
const DOWEL: SplitConnectorOptions = { type: 'dowel', size: 3, depth: 6, tolerance: 0.2, count: 1 };
function joint(label: string, axis: SplitAxis, position: number, a: number, b: number, parts: AssemblyPartInput[], center: Vec3 | null, area = 2500, connector = DOWEL): AssemblyJointInput {
  return {
    label, axis, position, a: { part: a, code: parts[a].code }, b: { part: b, code: parts[b].code },
    kind: center ? 'connector' : 'glue', connector: center ? connector : null, connectorCenters: center ? [center] : [], contactAreaMm2: area,
  };
}

/** Rejilla nx×ny×nz de un cubo de `cell` mm con espiga al centro de cada cara compartida. */
function grid(nx: number, ny: number, nz: number, cell = 50, pegs = true) {
  const parts: AssemblyPartInput[] = [];
  const at = (i: number, j: number, k: number) => (i * ny + j) * nz + k;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    parts.push(part(`${i}${j}${k}`, [[i * cell, j * cell, k * cell], [(i + 1) * cell, (j + 1) * cell, (k + 1) * cell]]));
  }
  const joints: AssemblyJointInput[] = [];
  const c = (v: number) => (v + 0.5) * cell;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    const p = at(i, j, k);
    if (i + 1 < nx) joints.push(joint(String(joints.length + 1), 'x', (i + 1) * cell, p, at(i + 1, j, k), parts, pegs ? [(i + 1) * cell, c(j), c(k)] : null, cell * cell));
    if (j + 1 < ny) joints.push(joint(String(joints.length + 1), 'y', (j + 1) * cell, p, at(i, j + 1, k), parts, pegs ? [c(i), (j + 1) * cell, c(k)] : null, cell * cell));
    if (k + 1 < nz) joints.push(joint(String(joints.length + 1), 'z', (k + 1) * cell, p, at(i, j, k + 1), parts, pegs ? [c(i), c(j), (k + 1) * cell] : null, cell * cell));
  }
  return { parts, joints };
}

describe('validateAssembly', () => {
  it('(1) cinco tramos apilados con espigas: orden lineal de abajo hacia arriba, sin bloqueos', () => {
    const { parts, joints } = grid(1, 5, 1, 40);
    const r = validateAssembly(parts, joints, { sourceVolumeMm3: 5 * 40 ** 3, checkExterior: false });
    expect(r.blocked).toEqual([]);
    expect(r.order.map((s) => s.code)).toEqual(['000', '010', '020', '030', '040']);
    expect(r.order.slice(1).every((s) => s.direction === '-y')).toBe(true);
    expect(r.closure.ok).toBe(true);
    expect(Math.abs(r.closure.volumeErrorPct!)).toBeLessThan(0.01);
    expect(r.ok).toBe(true);
  });

  it('(2) rejilla 2×2×2 con espigas en todas las uniones: detecta piezas trabadas y autoFix pega el mínimo', () => {
    const { parts, joints } = grid(2, 2, 2);
    const r = validateAssembly(parts, joints, { checkExterior: false, allowTypeChange: false });
    expect(r.blocked.length).toBeGreaterThan(0);
    expect(r.blocked.some((b) => b.reason === 'directions' && b.conflictingJoints.length >= 2)).toBe(true);
    expect(r.fix.applied).toBe(false);
    const fixed = validateAssembly(parts, joints, { checkExterior: false, autoFix: true, allowTypeChange: false });
    expect(fixed.blocked).toEqual([]);
    expect(fixed.order).toHaveLength(8);
    // Mínimo: cada pieza conserva a lo más una espiga hacia lo ya puesto → 12 − 7 = 5
    expect(fixed.fix.glueJoints).toHaveLength(joints.length - (parts.length - 1));
    expect(fixed.warnings.filter((w) => w.code === 'ASSEMBLY_JOINT_GLUED_FOR_ORDER')).toHaveLength(5);
  });

  it('(3) dos conectores de cortes perpendiculares cercanos que se cruzan: choque detectado', () => {
    const parts = [part('A', [[0, 0, 0], [50, 50, 100]]), part('B', [[50, 0, 0], [100, 50, 100]]), part('C', [[50, 0, 100], [100, 50, 150]])];
    // Espiga en x=50 apuntando a +x y espiga en z=100 apuntando a +z: casi en el mismo punto
    const joints = [joint('1', 'x', 50, 0, 1, parts, [50, 25, 97]), joint('2', 'z', 100, 1, 2, parts, [53, 25, 100])];
    const r = validateAssembly(parts, joints, { checkExterior: false });
    expect(r.clashes.length).toBeGreaterThan(0);
    expect(r.clashes[0].distanceMm).toBeLessThan(r.clashes[0].requiredMm);
    expect(r.warnings.some((w) => w.code === 'ASSEMBLY_CONNECTOR_CLASH')).toBe(true);
    // Separados, sin choque
    const far = [joint('1', 'x', 50, 0, 1, parts, [50, 25, 30]), joint('2', 'z', 100, 1, 2, parts, [80, 25, 100])];
    expect(validateAssembly(parts, far, { checkExterior: false }).clashes).toEqual([]);
  });

  it('(3b) conector pegado a la superficie exterior: pared medida menor que el mínimo', () => {
    const parts = [part('A', [[0, 0, 0], [50, 50, 50]]), part('B', [[0, 50, 0], [50, 100, 50]])];
    const r = validateAssembly(parts, [joint('1', 'y', 50, 0, 1, parts, [3.5, 50, 25])]);
    const ext = r.clashes.find((c) => c.other === null);
    expect(ext).toBeDefined();
    expect(ext!.distanceMm).toBeLessThan(0.8);
    expect(validateAssembly(parts, [joint('1', 'y', 50, 0, 1, parts, [25, 50, 25])]).clashes).toEqual([]);
  });

  it('(4) conector demasiado fino para una pieza grande: aviso de firmeza con valor medido y recomendado', () => {
    const parts = [part('A', [[0, 0, 0], [600, 300, 600]]), part('B', [[0, 300, 0], [600, 600, 600]])];
    const thin = { ...DOWEL, size: 1.5 };
    const r = validateAssembly(parts, [joint('1', 'y', 300, 0, 1, parts, [300, 300, 300], 360_000, thin)], { checkExterior: false });
    expect(r.weak).toHaveLength(1);
    expect(r.weak[0].measuredMm).toBe(1.5);
    expect(r.weak[0].recommendedMm).toBeGreaterThan(5);
    expect(r.warnings.some((w) => w.code === 'ASSEMBLY_WEAK_JOINT')).toBe(true);
    const ok = validateAssembly(parts, [joint('1', 'y', 300, 0, 1, parts, [300, 300, 300], 360_000, { ...DOWEL, size: 8 })], { checkExterior: false });
    expect(ok.weak).toEqual([]);
  });

  it('(5) pieza en L cuyo recorrido de inserción topa con otra ya puesta: bloqueo por barrido y arreglo', () => {
    // Q base; S y T sobre Q con espiga en Y; P en L: su espiga hacia T exige entrar moviéndose a +x (topa con S)
    // y su brazo cubre a S, así que S tampoco puede bajar después de P.
    const parts = [
      part('Q', [[0, 0, 0], [100, 10, 100]]),
      part('S', [[20, 10, 0], [40, 30, 100]]),
      part('T', [[80, 10, 0], [100, 60, 100]]),
      part('P', [[60, 10, 0], [80, 60, 100]], [[25, 50, 0], [60, 60, 100]]),
    ];
    const joints = [
      joint('1', 'y', 10, 0, 1, parts, [30, 10, 50], 2000),
      joint('2', 'y', 10, 0, 2, parts, [90, 10, 50], 2000),
      joint('3', 'y', 10, 0, 3, parts, null, 2000),
      joint('4', 'x', 80, 3, 2, parts, [80, 35, 50], 5000),
    ];
    const r = validateAssembly(parts, joints, { checkExterior: false, allowTypeChange: false });
    expect(r.closure.interference).toEqual([]);
    expect(r.blocked.length).toBeGreaterThan(0);
    const sweep = r.blocked.find((b) => b.reason === 'sweep');
    expect(sweep).toBeDefined();
    expect(sweep!.blockingParts.length).toBeGreaterThan(0);
    const fixed = validateAssembly(parts, joints, { checkExterior: false, autoFix: true, allowTypeChange: false });
    expect(fixed.blocked).toEqual([]);
    expect(fixed.order).toHaveLength(4);
    expect(fixed.fix.glueJoints).toHaveLength(1);
  });

  it('(6) rejilla 4×4×3 con espigas: valida y arregla sin crecer más rápido que ~cuadrático', () => {
    const { parts, joints } = grid(4, 4, 3, 40);
    const run = (g: ReturnType<typeof grid>) => {
      const t0 = performance.now();
      const out = validateAssembly(g.parts, g.joints, { autoFix: true, allowTypeChange: false });
      return { out, ms: performance.now() - t0 };
    };
    const { out: r, ms } = run({ parts, joints });
    const baseline = Math.min(...[0, 1, 2].map(() => run(grid(2, 2, 3, 40)).ms));
    expect(r.blocked).toEqual([]);
    expect(r.order).toHaveLength(48);
    // Cota inferior: uniones − (piezas − 1); el arreglo voraz queda a lo más 3 uniones encima
    expect(r.fix.glueJoints.length).toBeGreaterThanOrEqual(joints.length - 47);
    expect(r.fix.glueJoints.length).toBeLessThanOrEqual(joints.length - 47 + 3);
    // Complejidad, no milisegundos: 48 piezas son 4× las 12 de la referencia (medida en esta corrida);
    // el orden esperado es O(n²·u) ≈ 16×, así que 150× solo cae ante un crecimiento explosivo.
    expect(ms).toBeLessThan(Math.max(baseline, 2) * 150);
    // Sin espigas (solo pegar): ningún bloqueo y ningún cambio
    const glue = grid(4, 4, 3, 40, false);
    const g = validateAssembly(glue.parts, glue.joints);
    expect(g.blocked).toEqual([]);
    expect(g.fix.glueJoints).toEqual([]);
  });
});
