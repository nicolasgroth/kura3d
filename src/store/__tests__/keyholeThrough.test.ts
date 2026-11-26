/**
 * @file src/store/__tests__/keyholeThrough.test.ts
 * @description Ojo de cerradura cuya cámara atraviesa una placa de 3 mm, con el motor real: se mide si una cabeza del
 * diámetro declarado puesta en la cámara puede salir por el cuello (barrido del disco de la cabeza desde la cámara
 * hasta afuera contra la pieza ya agujereada). La promesa es «si no queda retenida, no se coloca»; el aviso de
 * cámara pasante debe decir lo mismo que la medida.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { KEYHOLE_MIN_RETENTION_RATIO } from '../../core/operations/keyholeRetention';
import { t } from '../../i18n';
import { keyholeWarnings } from '../keyholeWarnings';
import { keyholeDepthMm } from '../../core/addons/keyhole';
import { KEYHOLE_DEFAULTS } from '../../core/addons/keyholePresets';
import { stadiumLoftMesh } from '../../core/addons/stadiumMesh';
import * as engine from '../../engine';
import type { Vec3 } from '../../types/kura';
import { resetMagnetStore, store } from './magnetTestKit';

const P = KEYHOLE_DEFAULTS;
const BACK: Vec3 = [0, 0, 1];

describe('ojo de cerradura que atraviesa la pieza', () => {
  beforeEach(resetMagnetStore);

  it('placa de 3 mm: la cámara atraviesa pero el labio retiene la cabeza (medido); se coloca y el aviso lo dice así', async () => {
    const plate = (await store().createPrimitive('box', { width: 60, height: 60, depth: 3 }, { position: [0, 0, 0] }))!;
    const placed = await store().addKeyhole({ hostId: plate.id, params: P, point: [0, 30, 1.5], normal: BACK });
    expect(placed).not.toBeNull();
    const { report } = placed!;
    expect(keyholeDepthMm(P)).toBeGreaterThan(3);
    expect(report.through).toBe(true);
    // Sonda de la operación: el labio en el extremo de la ranura queda entero.
    expect(report.retentionMm3! / report.retentionIdealMm3!).toBeGreaterThan(0.99);
    const neg = placed!.object;
    const wasm = await engine.initManifoldEngine();
    const host = engine.meshDataToManifold(wasm, engine.applyTransformToMesh(plate.mesh, plate.position, plate.rotation, plate.scale));
    const hole = engine.meshDataToManifold(wasm, engine.applyTransformToMesh(neg.mesh, neg.position, neg.rotation, neg.scale));
    const drilled = host.subtract(hole);
    // Cabeza en el extremo de la ranura, barrida desde el fondo de la cámara hasta 5 mm fuera de la cara.
    const disc = stadiumLoftMesh({ straightMm: 0, rings: [{ y: -keyholeDepthMm(P), radius: P.headDiameterMm / 2 }, { y: 5, radius: P.headDiameterMm / 2 }] });
    for (let i = 0; i < disc.positions.length; i += 3) disc.positions[i] += P.slotLengthMm;
    const sweep = engine.meshDataToManifold(wasm, engine.applyTransformToMesh(disc, neg.position, neg.rotation, [1, 1, 1]));
    const blocking = drilled.intersect(sweep).volume();
    [host, hole, drilled, sweep].forEach((m) => m.delete());
    // Medida independiente: la cabeza que sale de la cámara hacia la cara choca con el labio entero.
    expect(blocking).toBeGreaterThanOrEqual(KEYHOLE_MIN_RETENTION_RATIO * report.retentionIdealMm3!);
    expect(blocking / report.retentionIdealMm3!).toBeGreaterThan(0.99);
    // El aviso de cámara pasante no dice que la cabeza se suelte (sí retiene): dice que el agujero se verá.
    const warn = keyholeWarnings(report, 'es').find((w) => w.kind === 'through')!;
    const text = t('es', warn.key as never, warn.params);
    expect(text).toContain('sigue reteniendo');
    expect(text).not.toMatch(/no quedaría sujeta/);
  });
});
