/**
 * @file src/engine/__tests__/splitSuggestions.test.ts
 * @description Sugerencias del armado al dividir: solo las llevan las uniones que quedaron para pegar o
 * que aún traban (nunca una unión con conector que ya monta, que la interfaz mostraría como "Traba el
 * montaje"), y cada `change-type:<tipo>` propuesto destraba de verdad: aplicado solo a esa unión, el
 * validador no deja piezas bloqueadas por ella ni choques suyos. Si la única alternativa es pegar, solo
 * se ofrece pegar. Caso de QA: cubo 440 con tarugo suelto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ManifoldToplevel } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { normalizeMeshToBed } from '../primitives';
import { executeBedSplitGeometry, planBedSplit, validateAssembly, type AssemblyJointInput, type SplitConnectorOptions } from '../split';
import { makeObject } from './geometryTestUtils';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

const cube440 = () => {
  const m = w.Manifold.cube([440, 440, 440], true);
  const obj = makeObject('cubo', normalizeMeshToBed(manifoldToMeshData(m)), { position: [0, -220, 0] });
  m.delete();
  return obj;
};

describe('sugerencias del armado al dividir', () => {
  it('cubo 440 / tarugo suelto: ninguna unión con conector queda como "traba" y cada cambio de tipo destraba', async () => {
    const obj = cube440();
    const conn: SplitConnectorOptions = { type: 'loose-dowel', size: 4, depth: 10, tolerance: 0.2, count: 2 };
    const plan = await planBedSplit(obj, { widthMm: 250, depthMm: 250, heightMm: 250 }, { maxPieces: 'auto', connector: conn });
    const res = await executeBedSplitGeometry(obj, plan, {});
    const a = res.assembly!;
    expect(a.blocked).toEqual([]);
    const blockedLabels = new Set(a.blocked.flatMap((b) => b.conflictingJoints));
    for (const s of a.suggestions) {
      const j = res.joints.find((x) => x.label === s.joint)!;
      // (a) La sugerencia es de una unión pegada (o que aún traba), nunca de una con conector que monta
      expect(j.kind === 'glue' || blockedLabels.has(s.joint)).toBe(true);
      expect(s.options[0]).toBe('glue');
      // (b) Cada cambio de tipo, aplicado solo a esa unión, monta sin bloqueo ni choque suyo
      for (const o of s.options.filter((x) => x.startsWith('change-type:'))) {
        const type = o.slice('change-type:'.length) as SplitConnectorOptions['type'];
        const joints: AssemblyJointInput[] = res.joints.map((x) =>
          x.label === s.joint ? { ...x, kind: 'connector', connector: { ...conn, type } } : x,
        );
        const r = validateAssembly(res.parts, joints, { autoFix: false });
        expect(r.blocked.some((b) => b.conflictingJoints.includes(s.joint))).toBe(false);
        expect(r.clashes.some((c) => c.joint === s.joint)).toBe(false);
      }
    }
  }, 300_000);
});
