/**
 * @file src/core/addons/__tests__/screwBossBase.test.ts
 * @description Torreta en la cara de apoyo: puesta en la cara inferior de una caja (la que apoya en la cama) el poste
 * sobresale bajo la base; el informe lo mide (alto del poste) y la lista de avisos trae uno tipado y claro, sin
 * bloquear. En la cara superior y en una lateral no hay aviso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { t } from '../../../i18n';
import { screwBossWarnings } from '../../../store/screwBossWarnings';
import { warningsOf } from '../../../store/addonCommandSchemas';
import { analyzeScrewBoss } from '../screwBossAnalysis';
import { SCREW_BOSS_DEFAULTS } from '../screwBossPresets';
import { boxMesh } from './magnetPocket.test';

const M3 = SCREW_BOSS_DEFAULTS;
const box = boxMesh(40, 20, 40);

describe('torreta en la cara de apoyo', () => {
  it('cara inferior: sobresale el alto del poste bajo la base y avisa (SCREW_BOSS_BELOW_BASE)', () => {
    const a = analyzeScrewBoss(box, M3, [0, 0, 0], [0, -1, 0], [])!;
    expect(a.report.belowBaseMm).toBeCloseTo(M3.heightMm, 3);
    const warns = screwBossWarnings(a.report, 'es');
    const base = warns.find((w) => w.kind === 'base')!;
    expect(base).toBeDefined();
    expect(t('es', base.key, base.params)).toContain(`${M3.heightMm.toLocaleString('es')} mm bajo la base`);
    expect(warningsOf(screwBossWarnings(a.report, 'en'), 'SCREW_BOSS').map((w) => w.code)).toContain('SCREW_BOSS_BELOW_BASE');
  });

  it('cara superior y lateral (lejos de la base): sin aviso', () => {
    const top = analyzeScrewBoss(box, M3, [0, 20, 0], [0, 1, 0], [])!;
    expect(top.report.belowBaseMm).toBe(0);
    const side = analyzeScrewBoss(box, M3, [20, 10, 0], [1, 0, 0], [])!;
    expect(side.report.belowBaseMm).toBe(0);
    expect(screwBossWarnings(side.report, 'es').some((w) => w.kind === 'base')).toBe(false);
  });

  it('cara lateral pegada a la base: el poste (radio 3,75) baja de la base y avisa lo que sobresale', () => {
    const side = analyzeScrewBoss(box, M3, [20, 2, 0], [1, 0, 0], [])!;
    expect(side.report.belowBaseMm).toBeCloseTo(M3.outerDiameterMm / 2 - 2, 3);
  });
});
