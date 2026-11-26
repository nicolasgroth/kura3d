/**
 * @file src/core/addons/__tests__/screwBoss.test.ts
 * @description Pruebas de la geometría pura de la torreta para tornillo: sólido de revolución cerrado y con
 * normales hacia afuera, volumen del poste y del agujero (chaflán incluido) contra la fórmula, tabla de medidas
 * incluida, diámetro exterior por defecto, validación y saneo, colocación en cara superior, lateral e inclinada, y
 * el análisis: hundimiento en una cara curva, pie más ancho que la zona de apoyo, agujero que entra en la pieza o
 * sale por el otro lado y choque con otra pieza pendiente.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { isClosedMesh } from '../../../engine/meshClosure';
import type { MeshData, Vec3 } from '../../../types/kura';
import { revolveProfile, signedMeshVolume } from '../revolveMesh';
import {
  BOSS_CHAMFER_MM, BOSS_SEAT_OVERLAP_MM, bossHoleMesh, bossHoleProfile, bossHoleVolumeMm3, bossPostMesh, bossPostVolumeAboveMm3,
  bossWallMm, defaultOuterDiameter, invalidScrewBossFields, placeScrewBoss, sanitizeScrewBossParams, type ScrewBossParams,
} from '../screwBoss';
import { analyzeScrewBoss } from '../screwBossAnalysis';
import { BUILTIN_SCREW_BOSS_PRESETS, SCREW_BOSS_DEFAULTS, builtinScrewBossPresetsOf } from '../screwBossPresets';

const M3 = SCREW_BOSS_DEFAULTS;
const vol = (m: MeshData) => signedMeshVolume(m.positions, m.indices);
const localUp = (rotation: Vec3): Vec3 => {
  const v = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...rotation, 'XYZ'));
  return [v.x, v.y, v.z];
};
const closeVec = (a: Vec3, b: Vec3, digits = 6) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));

/** Caja cerrada `w×h×d` apoyada en y = 0 y centrada en X/Z. */
function boxMesh(w: number, h: number, d: number): MeshData {
  const x = w / 2, z = d / 2;
  const v = [[-x, 0, -z], [x, 0, -z], [x, h, -z], [-x, h, -z], [-x, 0, z], [x, 0, z], [x, h, z], [-x, h, z]].flat();
  const f = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5, 3, 7, 6, 3, 6, 2, 0, 1, 5, 0, 5, 4];
  return { positions: new Float32Array(v), indices: new Uint32Array(f) };
}

/** Cilindro cerrado (eje Y) de radio `r` y alto `h`, base en y = 0, como pieza curva. */
const cylinderHost = (r: number, h: number, segments = 128): MeshData => revolveProfile([[0, 0], [r, 0], [r, h], [0, h]], segments);

describe('sólido de revolución', () => {
  it('cerrado, con volumen positivo e igual al del prisma poligonal', () => {
    const m = revolveProfile([[0, 0], [5, 0], [5, 10], [0, 10]], 64);
    expect(isClosedMesh(m)).toBe(true);
    const expected = 32 * 25 * Math.sin((2 * Math.PI) / 64) * 10;
    expect(vol(m)).toBeCloseTo(expected, 3);
  });

  it('un perfil al revés sale igual de cerrado y hacia afuera', () => {
    const m = revolveProfile([[0, 10], [5, 10], [5, 0], [0, 0]], 32);
    expect(isClosedMesh(m)).toBe(true);
    expect(vol(m)).toBeGreaterThan(0);
  });

  it('rechaza un perfil que no empieza en el eje', () => {
    expect(() => revolveProfile([[1, 0], [5, 0], [0, 4]], 16)).toThrow();
  });
});

describe('medidas y tabla', () => {
  it('por defecto es tornillo directo M3: poste Ø 7,5 × 10, agujero Ø 2,5 × 8', () => {
    expect(M3).toEqual({ type: 'screw', nominalMm: 3, holeDiameterMm: 2.5, holeDepthMm: 8, heightMm: 10, outerDiameterMm: 7.5 });
  });

  it('tornillo directo: piloto ≈ 0,85 × nominal (± 0,1 mm)', () => {
    const screws = builtinScrewBossPresetsOf('screw');
    expect(screws.map((p) => p.values.nominalMm)).toEqual([2, 2.5, 3, 4, 5]);
    for (const p of screws) expect(Math.abs(p.values.holeDiameterMm - 0.85 * p.values.nominalMm)).toBeLessThanOrEqual(0.1);
  });

  it('tornillo directo M5: piloto Ø 4,2 × 12, poste Ø 12,5 × 14 (por verificar como el resto)', () => {
    expect(builtinScrewBossPresetsOf('screw').find((p) => p.values.nominalMm === 5)!.values)
      .toEqual({ type: 'screw', nominalMm: 5, holeDiameterMm: 4.2, holeDepthMm: 12, heightMm: 14, outerDiameterMm: 12.5 });
  });

  it('insertos M2–M5 con su diámetro y profundidad = largo + 1 mm', () => {
    const inserts = builtinScrewBossPresetsOf('insert');
    expect(inserts.map((p) => [p.values.nominalMm, p.values.holeDiameterMm])).toEqual([[2, 3.2], [2.5, 3.6], [3, 4], [4, 5.6], [5, 6.4]]);
    for (const p of inserts) expect(p.values.holeDepthMm).toBeCloseTo(p.insertLengthMm! + 1, 9);
  });

  it('diámetro exterior: 2,5 × nominal, sin bajar de agujero + 2 × 1,2 mm', () => {
    expect(defaultOuterDiameter(3, 2.5)).toBe(7.5);
    expect(defaultOuterDiameter(2, 3.2)).toBeCloseTo(5.6, 9);
    for (const p of BUILTIN_SCREW_BOSS_PRESETS) expect(bossWallMm(p.values)).toBeGreaterThanOrEqual(1.2 - 1e-9);
  });

  it('valida rangos y que quede pared; sanea datos no confiables', () => {
    expect(invalidScrewBossFields(M3)).toEqual([]);
    expect(invalidScrewBossFields({ ...M3, heightMm: 0 })).toEqual(['heightMm']);
    expect(invalidScrewBossFields({ ...M3, outerDiameterMm: 3 })).toEqual(['outerDiameterMm']);
    expect(sanitizeScrewBossParams(JSON.parse(JSON.stringify(M3)))).toEqual(M3);
    expect(sanitizeScrewBossParams({ ...M3, type: 'nail' })).toBeNull();
    expect(sanitizeScrewBossParams({ ...M3, holeDepthMm: '8' })).toBeNull();
    expect(sanitizeScrewBossParams(null)).toBeNull();
  });
});

describe('poste y agujero', () => {
  it('agujero cerrado; volumen dentro del material = fórmula (± 0,5 %)', () => {
    const hole = bossHoleMesh(M3);
    expect(isClosedMesh(hole)).toBe(true);
    // El agujero entero = parte en el material + sobresalida (tronco a 45° sobre la boca).
    const total = vol(hole);
    const inside = bossHoleVolumeMm3(M3);
    expect(inside).toBeLessThan(total);
    // Recorte por debajo de la boca: el mismo perfil hasta y = profundidad.
    const profile = bossHoleProfile(M3).slice(0, 4);
    const insideMesh = revolveProfile([...profile, [0, M3.holeDepthMm]], 64);
    expect(Math.abs(vol(insideMesh) - inside) / inside).toBeLessThan(0.005);
  });

  it('el tramo recto mide el diámetro pedido entre caras planas y el chaflán abre 0,5 mm', () => {
    const [, bottom, , mouth] = bossHoleProfile(M3);
    expect(bottom[0] * Math.cos(Math.PI / 64)).toBeCloseTo(M3.holeDiameterMm / 2, 9);
    expect(mouth[0] * Math.cos(Math.PI / 64)).toBeCloseTo(M3.holeDiameterMm / 2 + BOSS_CHAMFER_MM, 9);
    expect(mouth[1]).toBe(M3.holeDepthMm);
  });

  it('poste cerrado de alto + hundimiento', () => {
    const post = bossPostMesh(M3, 0.3);
    expect(isClosedMesh(post)).toBe(true);
    expect(vol(post)).toBeCloseTo(bossPostVolumeAboveMm3(M3) * (10.3 / 10), 3);
  });
});

describe('colocación', () => {
  it('cara superior: poste hundido 0,3 mm, agujero con el fondo a 8 mm de la boca', () => {
    const plan = placeScrewBoss(M3, [1, 20, 2], [0, 1, 0])!;
    closeVec(localUp(plan.rotation), [0, 1, 0]);
    closeVec(plan.post.position, [1, 20 - BOSS_SEAT_OVERLAP_MM, 2]);
    closeVec(plan.hole.position, [1, 22, 2]);
    expect(plan.post.anchorMm).toBeCloseTo(0.3, 9);
    expect(plan.hole.anchorMm).toBeCloseTo(-2, 9);
  });

  it('cara lateral e inclinada: el eje del poste es la normal', () => {
    for (const n of [[1, 0, 0], [0, 0, -1], [Math.SQRT1_2, Math.SQRT1_2, 0]] as Vec3[]) {
      const plan = placeScrewBoss(M3, [0, 5, 0], n)!;
      closeVec(localUp(plan.rotation), n);
    }
    expect(placeScrewBoss(M3, [0, 0, 0], [0, 0, 0])).toBeNull();
  });
});

describe('análisis', () => {
  const box = boxMesh(40, 20, 40);

  it('cara plana: sin avisos, hundimiento mínimo', () => {
    const a = analyzeScrewBoss(box, M3, [0, 20, 0], [0, 1, 0], [])!;
    expect(a.spansFace).toBe(false);
    expect(a.report).toMatchObject({ intoHostMm: 0, exits: false, collides: false });
    expect(a.report.seatMm).toBeCloseTo(BOSS_SEAT_OVERLAP_MM, 6);
    expect(a.report.wallMm).toBeCloseTo(2.5, 9);
  });

  it('cara curva (costado de un cilindro): el poste se hunde lo que baja la superficie en su borde', () => {
    const host = cylinderHost(10, 30);
    const a = analyzeScrewBoss(host, M3, [10, 15, 0], [1, 0, 0], [])!;
    // Bajada del cilindro de radio 10 a 3,75 mm del punto de contacto: 10 − √(100 − 3,75²) ≈ 0,73 mm.
    const drop = 10 - Math.sqrt(100 - 3.75 * 3.75);
    expect(a.report.seatMm).toBeGreaterThan(drop + BOSS_SEAT_OVERLAP_MM - 0.05);
    expect(a.report.seatMm).toBeLessThan(drop + BOSS_SEAT_OVERLAP_MM + 0.1);
    expect(a.spansFace).toBe(false);
  });

  it('poste más ancho que la zona de apoyo: spansFace', () => {
    const thin = boxMesh(40, 20, 5);
    expect(analyzeScrewBoss(thin, M3, [0, 20, 0], [0, 1, 0], [])!.spansFace).toBe(true);
  });

  it('agujero más hondo que el poste: entra en la pieza; si la pieza es delgada, sale por el otro lado', () => {
    const deep: ScrewBossParams = { ...M3, heightMm: 4 };
    const a = analyzeScrewBoss(box, deep, [0, 20, 0], [0, 1, 0], [])!;
    expect(a.report.intoHostMm).toBeCloseTo(4, 9);
    expect(a.report.exits).toBe(false);
    const plate = boxMesh(40, 3, 40);
    expect(analyzeScrewBoss(plate, deep, [0, 3, 0], [0, 1, 0], [])!.report.exits).toBe(true);
  });

  it('choca con otra torreta pendiente cerca, no con una lejana', () => {
    const plan = placeScrewBoss(M3, [5, 20, 0], [0, 1, 0])!;
    const other = bossPostMesh(M3, 0.3);
    const p = other.positions.slice();
    for (let i = 0; i < p.length; i += 3) {
      p[i] += plan.post.position[0];
      p[i + 1] += plan.post.position[1];
      p[i + 2] += plan.post.position[2];
    }
    const near = { positions: p, indices: other.indices };
    expect(analyzeScrewBoss(box, M3, [0, 20, 0], [0, 1, 0], [near])!.report.collides).toBe(true);
    expect(analyzeScrewBoss(box, M3, [-12, 20, 0], [0, 1, 0], [near])!.report.collides).toBe(false);
  });
});
