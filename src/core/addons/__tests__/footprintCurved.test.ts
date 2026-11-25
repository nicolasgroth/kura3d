/**
 * @file src/core/addons/__tests__/footprintCurved.test.ts
 * @description Paso de cable y ojo de cerradura sobre una cara curva: en el centro de un cilindro la superficie se
 * aleja del plano tangente pero no hay borde (sin aviso de «cerca del borde» ni «más ancha que la cara»); un cilindro
 * tan angosto como la boca sí tiene borde real, y los bordes de caras planas siguen avisando.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { MeshData } from '../../../types/kura';
import { analyzeCablePass } from '../cablePassAnalysis';
import { BUILTIN_CABLE_PASS_PRESETS, CABLE_PASS_DEFAULTS } from '../cablePassPresets';
import { footprintOff, FOOTPRINT_DIRECTIONS, spansOpposite } from '../footprintProbe';
import { cablePassFrame } from '../cablePass';
import { plateMesh } from './addonShapes';

/** Cilindro macizo de eje Y (base en y = 0), radio `r`, alto `h`, `n` lados. */
function cylinderMesh(r: number, h: number, n = 128): MeshData {
  const pos: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    pos.push(r * Math.cos(a), 0, r * Math.sin(a), r * Math.cos(a), h, r * Math.sin(a));
  }
  pos.push(0, 0, 0, 0, h, 0);
  const bc = 2 * n, tc = 2 * n + 1;
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const b0 = 2 * i, t0 = 2 * i + 1, b1 = 2 * j, t1 = 2 * j + 1;
    idx.push(b0, t1, t0, b0, b1, t1, bc, b1, b0, tc, t0, t1);
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

const ROUND_12 = BUILTIN_CABLE_PASS_PRESETS.find((p) => p.id === 'round-12')!.values;
// Profundidad a mano: la pared de un cilindro macizo no se mide como «pared».
const manual = { ...ROUND_12, autoDepth: false, depthMm: 3 };

describe('huella sobre cara curva', () => {
  it('cilindro R 10, paso de 12 en el centro de la cara: sin avisos de borde (antes falso positivo)', () => {
    const a = analyzeCablePass(cylinderMesh(10, 60), manual, [10, 30, 0], [1, 0, 0], [])!;
    expect(a.spansFace).toBe(false);
    expect(a.report.nearEdge).toBe(false);
  });

  it('cilindro R 7,5 con el mismo paso: la boca queda a menos de 1,2 mm del borde real y avisa', () => {
    const a = analyzeCablePass(cylinderMesh(7.5, 60), manual, [7.5, 30, 0], [1, 0, 0], [])!;
    expect(a.report.nearEdge).toBe(true);
  });

  it('cilindro más angosto que la boca (R 4 con Ø 12): sale de la pieza por lados opuestos', () => {
    const a = analyzeCablePass(cylinderMesh(4, 60), manual, [4, 30, 0], [1, 0, 0], [])!;
    expect(a.spansFace).toBe(true);
  });

  it('cara plana: el borde sigue avisando a 1 mm y no a 2 mm', () => {
    const plate = plateMesh(60, 60, 3);
    const run = (x: number) => analyzeCablePass(plate, CABLE_PASS_DEFAULTS, [x, 30, 1.5], [0, 0, 1], [])!;
    expect(run(30 - 2.5 - 1).report.nearEdge).toBe(true);
    expect(run(30 - 2.5 - 2).report.nearEdge).toBe(false);
  });

  it('footprintOff directo (ojo de cerradura): centro de un cilindro R 10 sin salidas; centro de una placa angosta, con salidas opuestas', () => {
    const frame = cablePassFrame([1, 0, 0], 0)!;
    const fp = { center: [10, 30, 0] as [number, number, number], frame, radius: 5, halfStraight: 0 };
    const off = footprintOff(cylinderMesh(10, 60), fp, 0, 2.7);
    expect(off).toHaveLength(FOOTPRINT_DIRECTIONS);
    expect(off.some(Boolean)).toBe(false);
    const narrow = footprintOff(plateMesh(4, 60, 20), { ...fp, center: [0, 30, 10], frame: cablePassFrame([0, 0, 1], 0)! }, 0, 2.7);
    expect(spansOpposite(narrow)).toBe(true);
  });
});
