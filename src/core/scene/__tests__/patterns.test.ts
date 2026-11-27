/**
 * @file src/core/scene/__tests__/patterns.test.ts
 * @description Pruebas de la matemática pura del «Patrón»: posiciones de fila, rejilla y circular (con y sin giro de las
 * copias), distancia por paso o total, límites, solape, plano del espejo, reflejo de la malla (devanado y volumen) y
 * fantasma. Ejes del usuario (Z arriba) convertidos a los internos (Y arriba).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats, signedVolumeMm3 } from '../../../engine';
import type { MeshData, SceneObject, Vec3 } from '../../../types/kura';
import { createKeyedNaming } from '../resultNames';
import { reflectMeshInWorld, mirrorAcrossPlane, patternCopies } from '../../operations/patternOperations';
import { APP_BUILD_POLICY } from '../sceneObjects';
import { ghostOfMirror, ghostOfPoses, ghostWorldBox } from '../patternGhost';
import { circularPivot, isDegenerateCircular, planCircular, planLinear } from '../patternPlan';
import {
  checkPatternLimits, circularAngles, groupBoxOf, groupCenterOf, linearSteps, MAX_PATTERN_COPIES, MAX_PATTERN_TRIANGLES,
  mirrorPlane, overlappingCells, patternPoses, stepPose, type PatternStep,
} from '../patterns';

function cube(size = 10): MeshData {
  const h = size / 2;
  const v = [[-h, 0, -h], [h, 0, -h], [h, size, -h], [-h, size, -h], [-h, 0, h], [h, 0, h], [h, size, h], [-h, size, h]];
  const f = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
  return { positions: new Float32Array(v.flat()), indices: new Uint32Array(f) };
}

function obj(id: string, position: Vec3 = [0, 0, 0], extra: Partial<SceneObject> = {}): SceneObject {
  const mesh = cube();
  return {
    id, name: id, source: 'primitive', position, rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ff0000',
    role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh), ...extra,
  };
}

const offsets = (steps: PatternStep[]) => steps.map((s) => (s.kind === 'translate' ? s.offset : [NaN, NaN, NaN]));
const near = (a: readonly number[], b: readonly number[], digits = 6) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));

describe('patrón lineal', () => {
  it('fila en X del usuario: paso entre copias', () => {
    const steps = linearSteps({ count: 4, axis: 'x', mode: 'step', distanceMm: 25 });
    expect(offsets(steps)).toEqual([[0, 0, 0], [25, 0, 0], [50, 0, 0], [75, 0, 0]]);
  });

  it('el Y del usuario es el fondo (−Z interno) y el Z del usuario es arriba (Y interno)', () => {
    const y = offsets(linearSteps({ count: 2, axis: 'y', mode: 'step', distanceMm: 10 }));
    expect(y[1]).toEqual([0, 0, -10]);
    const z = offsets(linearSteps({ count: 2, axis: 'z', mode: 'step', distanceMm: 10 }));
    expect(z[1]).toEqual([0, 10, 0]);
  });

  it('distancia total: reparte N piezas de la primera a la última', () => {
    const steps = linearSteps({ count: 5, axis: 'x', mode: 'total', distanceMm: 100 });
    expect(offsets(steps).map((o) => o[0])).toEqual([0, 25, 50, 75, 100]);
  });

  it('distancia negativa va en sentido contrario', () => {
    expect(offsets(linearSteps({ count: 3, axis: 'x', mode: 'step', distanceMm: -10 })).map((o) => o[0])).toEqual([0, -10, -20]);
  });

  it('rejilla N × M: filas en la segunda dirección, la primera celda es la original', () => {
    const steps = linearSteps({ count: 3, axis: 'x', mode: 'step', distanceMm: 20, rows: 2, rowAxis: 'y', rowDistanceMm: 30 });
    expect(steps).toHaveLength(6);
    const o = offsets(steps);
    expect(o[0]).toEqual([0, 0, 0]);
    expect(o[2]).toEqual([40, 0, 0]);
    expect(o[3]).toEqual([0, 0, -30]);
    expect(o[5]).toEqual([40, 0, -30]);
  });

  it('una dirección libre (vector del usuario) se normaliza', () => {
    const steps = linearSteps({ count: 2, axis: 'x', direction: [3, 4, 0], mode: 'step', distanceMm: 10 });
    near(offsets(steps)[1], [6, 0, -8]);
  });

  it('una sola pieza no genera copias', () => {
    expect(linearSteps({ count: 1, axis: 'x', mode: 'total', distanceMm: 10 })).toHaveLength(1);
  });
});

describe('patrón circular', () => {
  it('vuelta completa reparte en N partes iguales (la última no repite la primera)', () => {
    const a = circularAngles({ count: 4, totalAngleDeg: 360 });
    near(a.map((r) => (r * 180) / Math.PI), [0, 90, 180, 270]);
  });

  it('un arco incluye ambos extremos', () => {
    const a = circularAngles({ count: 3, totalAngleDeg: 180 });
    near(a.map((r) => (r * 180) / Math.PI), [0, 90, 180]);
  });

  it('copias que giran: la posición orbita y la orientación gira lo mismo', () => {
    const pieza = obj('a', [30, 0, 0]);
    const plan = planCircular([pieza], { count: 4, axis: 'z', totalAngleDeg: 360, rotateCopies: true }, { mode: 'bed' }, [0, 0]);
    expect(plan.cells).toBe(4);
    // Eje Z del usuario = Y interno: la pieza en X = 30 pasa a (0, 0, −30) con un giro de +90° (mano derecha).
    near(plan.poses[1][0].position, [0, 0, -30], 5);
    near(plan.poses[2][0].position, [-30, 0, 0], 5);
    expect(plan.poses[1][0].rotation[1]).toBeCloseTo(Math.PI / 2, 5);
    expect(plan.radiusMm).toBeCloseTo(30, 5);
  });

  it('copias que conservan su orientación: orbitan sin girar', () => {
    const pieza = obj('a', [30, 0, 0], { rotation: [0, 0.3, 0] });
    const plan = planCircular([pieza], { count: 4, axis: 'z', totalAngleDeg: 360, rotateCopies: false }, { mode: 'bed' }, [0, 0]);
    for (let k = 0; k < 4; k++) expect(plan.poses[k][0].rotation).toEqual([0, 0.3, 0]);
    // El centro de la pieza (su caja) orbita: la posición cambia lo que se movió el centro (la malla se apoya en y = 0).
    near(plan.poses[2][0].position, [-30, 0, 0], 5);
  });

  it('el centro puede ser un punto del usuario', () => {
    const pivot = circularPivot([obj('a')], { mode: 'point', pointMm: [10, 20, 0] }, [0, 0]);
    near(pivot, [10, 0, -20]);
  });

  it('el centro de la cama usa el origen de la placa', () => {
    near(circularPivot([obj('a')], { mode: 'bed' }, [100, -50]), [100, 0, -50]);
  });

  it('con radio nulo y sin girar las copias el patrón es degenerado', () => {
    const spec = { count: 3, axis: 'z' as const, totalAngleDeg: 360, rotateCopies: false };
    const plan = planCircular([obj('a')], spec, { mode: 'selection' }, [0, 0]);
    expect(isDegenerateCircular(plan, spec)).toBe(true);
    expect(isDegenerateCircular(plan, { ...spec, rotateCopies: true })).toBe(false);
  });

  it('un eje horizontal (X) levanta las copias en el plano vertical', () => {
    const pieza = obj('a', [0, 0, 0]);
    const c = groupCenterOf([pieza]);
    const plan = planCircular([pieza], { count: 2, axis: 'x', totalAngleDeg: 180, rotateCopies: false }, { mode: 'point', pointMm: [0, 0, 100] }, [0, 0]);
    // Centro de la pieza a 5 mm de altura; eje X por Z = 100 → la copia queda en el lado opuesto, 190 mm más arriba.
    near(plan.poses[1][0].position, [0, 195 - c[1], 0], 4);
  });
});

describe('poses, límites y solape', () => {
  it('stepPose no muta la pose de entrada', () => {
    const pose = { position: [1, 2, 3] as Vec3, rotation: [0, 0, 0] as Vec3 };
    stepPose(pose, { kind: 'translate', offset: [5, 0, 0] });
    expect(pose.position).toEqual([1, 2, 3]);
  });

  it('límite de copias: piezas nuevas = (celdas − 1) × piezas de origen', () => {
    const a = obj('a');
    expect(checkPatternLimits([a], MAX_PATTERN_COPIES + 1).ok).toBe(true);
    const over = checkPatternLimits([a], MAX_PATTERN_COPIES + 2);
    expect(over).toMatchObject({ ok: false, reason: 'copies' });
    expect(checkPatternLimits([a, a], 252)).toMatchObject({ ok: false, reason: 'copies', copies: 502 });
  });

  it('límite de triángulos', () => {
    const heavy = obj('h', [0, 0, 0], { stats: { ...obj('x').stats, triangles: MAX_PATTERN_TRIANGLES } });
    expect(checkPatternLimits([heavy], 3)).toMatchObject({ ok: false, reason: 'triangles' });
    expect(checkPatternLimits([heavy], 2).ok).toBe(true);
  });

  it('un plan que pasa el tope no calcula poses', () => {
    const plan = planLinear([obj('a')], { count: 600, axis: 'x', mode: 'step', distanceMm: 1 });
    expect(plan.limit.ok).toBe(false);
    expect(plan.poses).toEqual([]);
  });

  it('avisa del solape cuando el paso es menor que la pieza y no cuando sobra espacio', () => {
    const tight = planLinear([obj('a')], { count: 3, axis: 'x', mode: 'step', distanceMm: 5 });
    expect(tight.overlapCells).toBe(3);
    const spaced = planLinear([obj('a')], { count: 3, axis: 'x', mode: 'step', distanceMm: 15 });
    expect(spaced.overlapCells).toBe(0);
    // Tocarse cara con cara no es solape.
    expect(planLinear([obj('a')], { count: 3, axis: 'x', mode: 'step', distanceMm: 10 }).overlapCells).toBe(0);
  });

  it('overlappingCells con piezas de varias partes mira solo celdas distintas', () => {
    const a = obj('a');
    const b = obj('b', [5, 0, 0]);
    const poses = patternPoses([a, b], [{ kind: 'translate', offset: [0, 0, 0] }, { kind: 'translate', offset: [100, 0, 0] }]);
    // a y b se cruzan dentro de la misma celda: no cuenta.
    expect(overlappingCells([a, b], poses)).toBe(0);
  });
});

describe('copias y espejo (operaciones)', () => {
  const ctx = (() => {
    let n = 0;
    return { policy: APP_BUILD_POLICY, newId: () => `n${++n}`, naming: createKeyedNaming((k) => k, { color: () => '', structure: () => '', shortMm: () => '' }) };
  })();

  it('las copias heredan color, rol y placa, comparten la malla y no repiten la original', () => {
    const src = obj('a', [0, 0, 0], { color: '#00ff00', role: 'negative', plateRef: 'p1' });
    const steps = linearSteps({ count: 3, axis: 'x', mode: 'step', distanceMm: 20 });
    const res = patternCopies(ctx, { sources: [src], steps, nameOf: (s, k) => `${s.name} ${k + 1}` });
    expect(res.copies).toHaveLength(2);
    expect(res.copies.map((c) => c.position[0])).toEqual([20, 40]);
    expect(res.copies.every((c) => c.color === '#00ff00' && c.role === 'negative' && c.plateRef === 'p1' && c.mesh === src.mesh)).toBe(true);
    expect(res.copies.map((c) => c.name)).toEqual(['a 2', 'a 3']);
    expect(new Set(res.copies.map((c) => c.id)).size).toBe(2);
  });

  it('el reflejo respeta el volumen positivo y la posición respecto del plano', () => {
    const src = obj('a', [30, 0, 0]);
    const { mesh, origin } = reflectMeshInWorld(src, { index: 0, coord: 0 });
    expect(origin[0]).toBeCloseTo(-30, 5);
    expect(signedVolumeMm3(mesh)).toBeGreaterThan(0);
    expect(signedVolumeMm3(mesh)).toBeCloseTo(signedVolumeMm3(src.mesh), 3);
  });

  it('espejo con copia: conserva la original, agrega el reflejo y deja la rotación en cero', () => {
    const src = obj('a', [30, 0, 0], { rotation: [0, 0.5, 0] });
    const res = mirrorAcrossPlane(ctx, { sources: [src], plane: { index: 0, coord: 0 }, keepOriginal: true, nameOf: (s) => `${s.name} esp` });
    expect(res.change.patches).toHaveLength(0);
    expect(res.copies).toHaveLength(1);
    expect(res.copies[0].rotation).toEqual([0, 0, 0]);
    expect(res.copies[0].name).toBe('a esp');
  });

  it('espejo sin conservar: parcha la original', () => {
    const src = obj('a', [30, 0, 0]);
    const res = mirrorAcrossPlane(ctx, { sources: [src], plane: { index: 0, coord: 0 }, keepOriginal: false, nameOf: (s) => s.name });
    expect(res.copies).toHaveLength(0);
    expect(res.change.patches[0].id).toBe('a');
    expect(res.change.patches[0].patch.position?.[0]).toBeCloseTo(-30, 5);
  });
});

describe('plano del espejo', () => {
  const box = { min: [10, 0, -20] as Vec3, max: [30, 10, 0] as Vec3 };

  it('por el centro de la pieza', () => {
    expect(mirrorPlane({ axis: 'x', base: 'object', offsetMm: 0, keepOriginal: true }, box, [0, 0])).toEqual({ index: 0, coord: 20 });
    // Y del usuario es −Z interno.
    expect(mirrorPlane({ axis: 'y', base: 'object', offsetMm: 0, keepOriginal: true }, box, [0, 0])).toEqual({ index: 2, coord: -10 });
    expect(mirrorPlane({ axis: 'z', base: 'object', offsetMm: 0, keepOriginal: true }, box, [0, 0])).toEqual({ index: 1, coord: 5 });
  });

  it('por el centro de la cama y con distancia', () => {
    expect(mirrorPlane({ axis: 'x', base: 'bed', offsetMm: 15, keepOriginal: true }, box, [100, 50])).toEqual({ index: 0, coord: 115 });
    // +15 en el Y del usuario es −15 en Z interno.
    expect(mirrorPlane({ axis: 'y', base: 'bed', offsetMm: 15, keepOriginal: true }, box, [100, 50])).toEqual({ index: 2, coord: 35 });
    expect(mirrorPlane({ axis: 'z', base: 'bed', offsetMm: 8, keepOriginal: true }, box, [100, 50])).toEqual({ index: 1, coord: 8 });
  });

  it('caja conjunta de varias piezas', () => {
    const b = groupBoxOf([obj('a'), obj('b', [20, 0, 0])]);
    expect(b?.min[0]).toBeCloseTo(-5);
    expect(b?.max[0]).toBeCloseTo(25);
  });
});

describe('fantasma', () => {
  it('una matriz por copia y ninguna para la original', () => {
    const a = obj('a');
    const plan = planLinear([a], { count: 4, axis: 'x', mode: 'step', distanceMm: 20 });
    const ghost = ghostOfPoses([a], plan.poses);
    expect(ghost?.entries[0].count).toBe(3);
    expect(ghost?.entries[0].matrices).toHaveLength(48);
    // Traslación de la primera copia en la columna 4.
    expect(ghost?.entries[0].matrices[12]).toBeCloseTo(20);
  });

  it('la caja del fantasma envuelve todas las copias (y no la original)', () => {
    const a = obj('a');
    const plan = planLinear([a], { count: 4, axis: 'x', mode: 'step', distanceMm: 20 });
    const box = ghostWorldBox(ghostOfPoses([a], plan.poses)!)!;
    // Cubo de 10 mm centrado en x: copias en x = 20, 40, 60.
    expect(box.min[0]).toBeCloseTo(15);
    expect(box.max[0]).toBeCloseTo(65);
    expect(box.max[1]).toBeCloseTo(10);
  });

  it('sin fantasma cuando son demasiados triángulos', () => {
    const heavy = obj('h', [0, 0, 0], { stats: { ...obj('x').stats, triangles: 400_000 } });
    const plan = planLinear([heavy], { count: 4, axis: 'x', mode: 'step', distanceMm: 20 });
    expect(ghostOfPoses([heavy], plan.poses)).toBeNull();
  });

  it('el reflejo lleva determinante negativo', () => {
    const a = obj('a', [30, 0, 0]);
    const ghost = ghostOfMirror([a], { index: 0, coord: 0 });
    const m = ghost!.entries[0].matrices;
    expect(m[0]).toBeCloseTo(-1);
    expect(m[12]).toBeCloseTo(-30);
  });
});
