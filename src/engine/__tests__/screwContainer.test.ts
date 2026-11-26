/**
 * @file src/engine/__tests__/screwContainer.test.ts
 * @description Recipiente con tapa roscada: perfil de rosca de recipiente (flancos ≤ 45° respecto del eje, una o
 * varias entradas), pareja macho/hembra con holgura, sólidos cerrados, volumen contra el cálculo analítico,
 * medidas, y la verificación de interferencia (holgura por defecto enrosca; holgura 0 o negativa no).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../meshStats';
import { EngineError } from '../engineErrors';
import {
  containerProfile,
  containerTapProfile,
  meanSquaredRadius,
  profileMaxFlankAngleDeg,
} from '../containerThread';
import {
  createScrewContainer,
  layoutScrewContainer,
  resolveScrewContainer,
  screwContainerFit,
  SCREW_CONTAINER_DEFAULTS,
} from '../screwContainer';

function bbox(positions: Float32Array) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k]);
      max[k] = Math.max(max[k], positions[i + k]);
    }
  }
  return { min, max, size: [0, 1, 2].map((k) => max[k] - min[k]) };
}

describe('perfil de rosca de recipiente', () => {
  it.each([[3, 45], [4, 45], [6, 40], [5, 30]])('paso %f, flanco %f°: no supera el ángulo de voladizo indicado', (pitch, flank) => {
    const prof = containerProfile(pitch, flank, 1);
    const male = profileMaxFlankAngleDeg(prof.breaks, prof.depthMm, pitch);
    expect(male).toBeLessThanOrEqual(flank + 1e-6);
    expect(male).toBeGreaterThan(flank - 0.5);
    const tap = containerTapProfile(prof, 0.3, 0.6);
    expect(profileMaxFlankAngleDeg(tap.tapBreaks, prof.depthMm, pitch)).toBeLessThanOrEqual(flank + 1e-6);
    expect(profileMaxFlankAngleDeg(tap.maleBreaks, prof.depthMm, pitch)).toBeLessThanOrEqual(flank + 1e-6);
  });

  it('rechaza flancos más tendidos que 45°, paso fuera de rango y entradas inválidas', () => {
    expect(() => containerProfile(4, 50, 1)).toThrow(EngineError);
    expect(() => containerProfile(1, 45, 1)).toThrow(EngineError);
    expect(() => containerProfile(12, 45, 1)).toThrow(EngineError);
    expect(() => containerProfile(4, 45, 0)).toThrow(EngineError);
    expect(() => containerProfile(4, 45, 1.5)).toThrow(EngineError);
    expect(() => containerProfile(Number.NaN, 45, 1)).toThrow(EngineError);
  });

  it('el avance por vuelta es entradas × paso', () => {
    expect(containerProfile(4, 45, 2).leadMm).toBeCloseTo(8, 9);
  });

  it('la holgura axial que no cabe en la meseta es un error tipado', () => {
    const prof = containerProfile(2, 45, 1);
    expect(() => containerTapProfile(prof, 0.1, 1)).toThrow(EngineError);
  });
});

describe('recipiente con tapa roscada: geometría', () => {
  it('cuerpo y tapa son sólidos cerrados con el volumen y las medidas esperadas', async () => {
    const { body, lid, spec } = await createScrewContainer({});
    const sb = computeMeshStats(body);
    const sl = computeMeshStats(lid);
    expect(sb.isManifold).toBe(true);
    expect(sl.isManifold).toBe(true);
    const L = layoutScrewContainer(spec);
    const bb = bbox(body.positions);
    expect(bb.size[1]).toBeCloseTo(spec.bottomMm + spec.innerHeightMm, 2);
    expect(bb.size[0]).toBeCloseTo(2 * L.lidRadius, 0);
    // Volumen analítico: base + cuello roscado − cavidad (el bisel de entrada quita < 1 %).
    const prof = containerProfile(spec.pitchMm, spec.flankAngleDeg, spec.starts);
    const tap = containerTapProfile(prof, L.effRadialClearanceMm, spec.axialClearanceMm);
    const neck = Math.PI * meanSquaredRadius(tap.maleBreaks, L.rootRadius, L.majorRadius) * L.threadLengthMm;
    const expected = Math.PI * L.lidRadius ** 2 * L.seatZ + neck - Math.PI * L.innerRadius ** 2 * spec.innerHeightMm;
    expect(sb.volumeMm3).toBeGreaterThan(expected * 0.98);
    expect(sb.volumeMm3).toBeLessThan(expected * 1.005);
    // La tapa: alto = rosca + luz superior + techo
    const lb = bbox(lid.positions);
    expect(lb.size[1]).toBeCloseTo(L.lidHeight, 2);
    expect(lb.min[1]).toBeCloseTo(0, 4);
  });

  it.each([
    ['base cuadrada, moleteado', { base: 'square', grip: 'knurl' }],
    ['caras planas, dos entradas', { grip: 'flats', starts: 2, turns: 1.5 }],
    ['sin agarre, paso 6', { grip: 'none', pitchMm: 6, turns: 1.5, innerHeightMm: 40 }],
  ] as const)('%s: cierra', async (_label, opts) => {
    const { body, lid } = await createScrewContainer(opts);
    expect(computeMeshStats(body).isManifold).toBe(true);
    expect(computeMeshStats(lid).isManifold).toBe(true);
  });

  it('valida las medidas: alto interior menor que la rosca + 2 mm es error tipado', () => {
    expect(() => resolveScrewContainer({ innerHeightMm: 10, turns: 3, pitchMm: 5 })).toThrow(EngineError);
    expect(() => resolveScrewContainer({ innerDiameterMm: 5 })).toThrow(EngineError);
    expect(() => resolveScrewContainer({ radialClearanceMm: -0.1 })).toThrow(EngineError);
    expect(() => resolveScrewContainer({ grip: 'spikes' as never })).toThrow(EngineError);
  });
});

describe('recipiente con tapa roscada: verificación de enroscado', () => {
  it('con la holgura por defecto enrosca sin interferir en ninguna posición de la hélice', async () => {
    const report = await screwContainerFit({});
    expect(report.status).toBe('ok');
    expect(report.fits).toBe(true);
    expect(report.maxInterferenceMm3).toBeLessThan(1e-3);
    expect(report.positions.length).toBeGreaterThanOrEqual(5);
    // Holgura mínima medida ≈ la de diseño (0,3 mm radial; flanco a 45°: (0,3 + s)·cos45 ≥ 0,21)
    expect(report.minClearanceMm).toBeGreaterThan(0.2);
    expect(report.minClearanceMm).toBeLessThan(SCREW_CONTAINER_DEFAULTS.radialClearanceMm + 0.05);
  });

  it('con holgura 0 no da por buena la pareja', async () => {
    const report = await screwContainerFit({ radialClearanceMm: 0, axialClearanceMm: 0 });
    expect(report.fits).toBe(false);
    expect(report.minClearanceMm).toBeLessThan(0.05);
  });

  it('con holgura negativa mide la interferencia en volumen', async () => {
    const spec = { ...resolveScrewContainer({}), radialClearanceMm: -0.3, axialClearanceMm: 0 };
    const report = await screwContainerFit(spec, { trusted: true });
    expect(report.status).toBe('interference');
    expect(report.maxInterferenceMm3).toBeGreaterThan(1);
  });

  it('dos entradas: también enrosca', async () => {
    const report = await screwContainerFit({ starts: 2, turns: 1.5 });
    expect(report.status).toBe('ok');
  });
});
