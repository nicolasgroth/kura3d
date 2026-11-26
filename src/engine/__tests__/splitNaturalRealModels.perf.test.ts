/**
 * @file src/engine/__tests__/splitNaturalRealModels.perf.test.ts
 * @description «Por las partes de la figura» sobre modelos reales de la carpeta local de evaluación
 * (no se copian al repositorio; si un archivo no está, su caso se omite). Con una cama útil del 75 % de
 * la altura de la figura, registra cuántos cortes propone, dónde caen (en % de la altura) y cuánto
 * tarda; exige que todas las piezas quepan y que el análisis no pase de los umbrales.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { readSTL } from '../io/stl';
import { read3MF } from '../io/threeMfImport';
import { EngineError } from '../engineErrors';
import { planBedSplit, type BedSplitPlan, type SplitBed } from '../split';
import { fittingRotation } from '../split/splitSections';
import { makeObject } from './geometryTestUtils';

interface NodeFs {
  existsSync(path: string): boolean;
  readFileSync(path: string): Uint8Array;
}
const fs = (globalThis as unknown as { process: { getBuiltinModule: (id: string) => NodeFs } }).process.getBuiltinModule('node:fs');
const DIR = 'G:/proyectos/kura3d/.eval-tmp/modelos/';
const MODELS = ['frierenmw.stl', 'busto_anubis_gotico.stl', 'obj_1_OcarinaDeluxe.stl', 'Saitama_75mm_base.3mf', 'NeroBlackClover_SeparatePlate.3mf', 'Sagradocorazon.3mf'];

function load(name: string): MeshData {
  const b = fs.readFileSync(DIR + name);
  const buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  const model = name.endsWith('.stl') ? readSTL(buf, name) : read3MF(buf, name);
  // La pieza más grande (un 3MF puede traer la base aparte)
  return model.parts.map((p) => p.mesh).sort((x, y) => y.indices.length - x.indices.length)[0];
}

/** Alto al que se escala cada figura (mm): una impresión grande, que es cuando se divide. */
const TARGET_HEIGHT_MM = 400;
/** Camas útiles como fracción de ese alto: 2 tramos con holgura y 3 tramos. */
const BED_FRACTIONS = [0.85, 0.45];

describe('Por las partes de la figura: modelos reales', () => {
  for (const name of MODELS) {
    it.skipIf(!fs.existsSync(DIR + name))(name, { timeout: 300_000 }, async () => {
      const mesh = load(name);
      let lo = Infinity, hi = -Infinity, wide = 0;
      for (let a = 0; a < 3; a++) {
        let l = Infinity, h = -Infinity;
        for (let i = a; i < mesh.positions.length; i += 3) { l = Math.min(l, mesh.positions[i]); h = Math.max(h, mesh.positions[i]); }
        if (a === 1) { lo = l; hi = h; } else wide = Math.max(wide, h - l);
      }
      const k = TARGET_HEIGHT_MM / (hi - lo);
      const obj = makeObject(name, mesh, { scale: [k, k, k] });
      for (const frac of BED_FRACTIONS) {
        // Cama baja: obliga a cortar en altura; ancha para no cortar en X/Z.
        const bed: SplitBed = { widthMm: wide * k + 40, depthMm: wide * k + 40, heightMm: frac * TARGET_HEIGHT_MM + 10 };
        const t0 = performance.now();
        let plan: BedSplitPlan;
        try {
          plan = await planBedSplit(obj, bed, { allowRotation: false, axes: ['y'], strategy: 'natural', countOccupancy: false });
        } catch (err) {
          // Malla abierta: «Dividir» pide reparar antes, con cualquier estrategia
          if (err instanceof EngineError && err.code === 'MESH_INVALID') {
            console.info(`${name}: malla no cerrada, se omite (hay que repararla antes de dividir)`);
            return;
          }
          throw err;
        }
        const ms = performance.now() - t0;
        const pct = (y: number) => `${(((y - lo * k) / TARGET_HEIGHT_MM) * 100).toFixed(0)}%`;
        const where = plan.planes.map((p) => `${p.origin}@${pct(p.position)} (${p.sectionAreaMm2.toFixed(0)} mm², ${p.islands} isla)`);
        const cands = (plan.natural?.candidates ?? []).map((c) => `${c.kind}@${pct(c.position)}${c.used ? '*' : ''} (${c.sectionAreaMm2.toFixed(0)} mm², ${c.islands} isla, peso ${c.weight.toFixed(2)})`);
        console.info(`${name} [cama ${frac * 100}%]: ${mesh.indices.length / 3} tri, ${ms.toFixed(0)} ms (análisis ${plan.natural?.analysisMs.toFixed(0)} ms); cortes ${where.join(', ')}; candidatos ${cands.join(' ')}`);
        expect(plan.strategy).toBe('natural');
        expect(plan.pieces.every((p) => fittingRotation(p.sizeMm, plan.usableMm, false) !== null)).toBe(true);
        expect(plan.natural!.naturalCuts + plan.natural!.straightCuts).toBe(plan.planes.length);
        expect(plan.natural!.candidates.length).toBeLessThanOrEqual(8);
        expect(plan.natural!.analysisMs).toBeLessThan(15_000);
      }
    });
  }
});
