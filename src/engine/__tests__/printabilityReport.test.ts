/**
 * @file src/engine/__tests__/printabilityReport.test.ts
 * @description Informe de imprimibilidad con valores medidos: placa delgada, T con voladizo de
 * área conocida, cubo plano sin facetado, esfera de pocos segmentos, normales invertidas, bajo la
 * cama frente a fuera del volumen, supuestos del peso y avisos traducibles.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_PRINTER_PROFILES } from '../../types/kura';
import { createPrimitiveMesh, flipTriangleWinding, localizePrintWarning } from '../index';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { analyzePrintability } from '../printability';
import { makeObject } from './geometryTestUtils';

const bed = DEFAULT_PRINTER_PROFILES.find((p) => p.id === 'bambu-a1-mini')!; // 180×180×180
const codes = (r: { issues: { code: string }[] }) => r.issues.map((w) => w.code);

describe('analyzePrintability', () => {
  it('cubo de 20 mm: 100/100, sin avisos ni falso positivo de facetado', async () => {
    const cube = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
    const r = analyzePrintability(makeObject('cubo', cube), bed);
    expect(r.issues).toEqual([]);
    expect(r.densityQuality).toBe('optimal');
    expect(r.score).toBe(100);
    expect(r.surfaceAreaMm2).toBeCloseTo(2400, 3);
    expect(r.minWallThicknessMm).toBeCloseTo(20, 3);
  });

  it('malla abierta: dice que la pared no se midió en vez de informar 0 % de pared delgada', async () => {
    const cube = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
    const open = { ...cube, indices: cube.indices.slice(6) };
    const r = analyzePrintability(makeObject('abierta', open), bed);
    expect(r.isManifold).toBe(false);
    expect(r.wallMeasured).toBe(false);
    expect(r.minWallThicknessMm).toBeNull();
    expect(codes(r)).toEqual(expect.arrayContaining(['NOT_MANIFOLD', 'WALL_NOT_MEASURED']));
    expect(localizePrintWarning('es', r.issues.find((i) => i.code === 'WALL_NOT_MEASURED')!)).toMatch(/no se pudo medir la pared/i);
    const closed = analyzePrintability(makeObject('cubo', cube), bed);
    expect(closed.wallMeasured).toBe(true);
  });

  it('placa de 0,2 mm: avisa pared delgada con el espesor medido y baja la nota', async () => {
    const plate = await createPrimitiveMesh('box', { width: 50, height: 0.2, depth: 50 });
    const r = analyzePrintability(makeObject('placa', plate), bed);
    expect(codes(r)).toContain('THIN_WALL');
    expect(r.minWallThicknessMm).toBeCloseTo(0.2, 3);
    expect(r.thinWallAreaPercent).toBeGreaterThan(90);
    expect(r.score).toBeLessThan(80);
    const w = r.issues.find((i) => i.code === 'THIN_WALL')!;
    expect(w.params).toEqual({ thickness: 0.2, min: 0.8 });
    // Con mínimo 0,1 mm ya no avisa; con 0 se desactiva.
    expect(codes(analyzePrintability(makeObject('placa', plate), bed, 'pla_matte', 20, 45, 0.1))).not.toContain('THIN_WALL');
    expect(analyzePrintability(makeObject('placa', plate), bed, 'pla_matte', 20, 45, 0).minWallThicknessMm).toBeNull();
  });

  it('T: el voladizo se mide por área (300 mm² de 2100 mm²)', async () => {
    const wasm = await initManifoldEngine();
    const stem = wasm.Manifold.cube([10, 20, 10]).translate([-5, 0, -5]);
    const bar = wasm.Manifold.cube([40, 5, 10]).translate([-20, 20, -5]);
    const t = stem.add(bar);
    const mesh = manifoldToMeshData(t);
    stem.delete();
    bar.delete();
    t.delete();
    const r = analyzePrintability(makeObject('T', mesh), bed);
    expect(r.isManifold).toBe(true);
    expect(r.overhangAreaMm2).toBeCloseTo(300, 3);
    expect(r.surfaceAreaMm2).toBeCloseTo(2100, 3);
    expect(r.overhangPercent).toBeCloseTo((300 / 2100) * 100, 3);
    expect(codes(r)).toContain('OVERHANG');
    expect(codes(r)).not.toContain('LOW_DENSITY');
  });

  it('esfera de 12 segmentos avisa facetado; la de 64 no', async () => {
    const coarse = await createPrimitiveMesh('sphere', { radius: 15, segments: 12 });
    expect(codes(analyzePrintability(makeObject('e12', coarse), bed))).toContain('LOW_DENSITY');
    const fine = await createPrimitiveMesh('sphere', { radius: 15, segments: 64 });
    expect(codes(analyzePrintability(makeObject('e64', fine), bed))).not.toContain('LOW_DENSITY');
  });

  it('normales invertidas: aviso, volumen positivo y voladizo medido con la orientación corregida', async () => {
    const cube = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
    const r = analyzePrintability(makeObject('inv', flipTriangleWinding(cube)), bed);
    expect(r.normalsInverted).toBe(true);
    expect(codes(r)).toContain('INVERTED_NORMALS');
    expect(r.issues.find((i) => i.code === 'INVERTED_NORMALS')!.params.volume).toBeCloseTo(-1000, 3);
    expect(r.volumeCm3).toBeCloseTo(1, 6);
    // El techo invertido no cuenta como voladizo.
    expect(r.overhangAreaMm2).toBe(0);
    expect(r.score).toBeLessThan(100);
  });

  it('distingue bajo la cama de fuera del volumen', async () => {
    const cube = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
    const below = analyzePrintability(makeObject('bajo', cube, { position: [0, -3, 0] }), bed);
    expect(codes(below)).toContain('BELOW_BED');
    expect(codes(below)).not.toContain('EXCEEDS_BED');
    expect(below.isBelowBed).toBe(true);
    expect(below.issues.find((i) => i.code === 'BELOW_BED')!.params.depth).toBeCloseTo(3, 6);

    const outside = analyzePrintability(makeObject('fuera', cube, { position: [150, 0, 0] }), bed);
    expect(codes(outside)).toContain('EXCEEDS_BED');
    expect(codes(outside)).not.toContain('BELOW_BED');
    expect(outside.fitsInBed).toBe(false);
  });

  it('expone los supuestos del peso y traduce los avisos', async () => {
    const plate = await createPrimitiveMesh('box', { width: 50, height: 0.2, depth: 50 });
    const r = analyzePrintability(makeObject('placa', plate), bed, 'pla_matte', 30);
    expect(r.weightAssumptions).toMatchObject({ materialId: 'pla_matte', infillPercent: 30, shellFraction: 0.22, filamentDiameterMm: 1.75 });
    expect(r.weightAssumptions.densityGCm3).toBeGreaterThan(1);
    const w = r.issues.find((i) => i.code === 'THIN_WALL')!;
    const es = localizePrintWarning('es', w);
    const en = localizePrintWarning('en', w);
    expect(es).toContain('0,2');
    expect(en).toContain('0.2');
    expect(es).not.toBe(en);
    expect(r.warnings).toContain(es);
  });
});
