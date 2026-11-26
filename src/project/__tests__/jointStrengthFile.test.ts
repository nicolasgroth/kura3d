/**
 * @file src/project/__tests__/jointStrengthFile.test.ts
 * @description Firmeza de uniones leída de un `.kura`: un archivo malicioso o dañado (más islas cubiertas que islas,
 * cantidades no enteras o desmedidas) se rechaza al leer, y el cálculo de lo que va pegado nunca da negativo aunque
 * llegue un dato incoherente por otra vía.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { firmnessFacts } from '../../core/scene/jointFirmness';
import type { SplitJointRecordStrength } from '../../types/kura';
import { validSplitJointStrength } from '../projectSchema';

const good = (): SplitJointRecordStrength => ({
  level: 'weak', reasons: ['islands-uncovered'], basis: 'connector', count: 2, sizeMm: 3, depthMm: 8, areaRatio: 0.4,
  islands: 3, islandsCovered: 1, shrunk: [{ reason: 'count', fromMm: 4, toMm: 2 }], discarded: [],
});

describe('firmeza de uniones en el archivo', () => {
  it('acepta una firmeza coherente', () => {
    expect(validSplitJointStrength(good())).toBe(true);
  });

  it.each<[string, Partial<SplitJointRecordStrength>]>([
    ['más islas cubiertas que islas', { islands: 2, islandsCovered: 5 }],
    ['islas no enteras', { islands: 2.5 }],
    ['islas cubiertas negativas', { islandsCovered: -1 }],
    ['cantidad no entera', { count: 1.5 }],
    ['cantidad desmedida', { count: 1e9 }],
    ['islas desmedidas', { islands: 1e9, islandsCovered: 0 }],
    ['cantidad achicada no entera', { shrunk: [{ reason: 'count', fromMm: 4.5, toMm: 2 }] }],
    ['isla descartada no entera', { discarded: [{ island: 0.5, reason: 'section-narrow', measuredMm: 1 }] }],
  ])('rechaza %s', (_name, patch) => {
    expect(validSplitJointStrength({ ...good(), ...patch })).toBe(false);
  });

  it('lo que va pegado nunca es negativo aunque el dato sea incoherente', () => {
    const facts = firmnessFacts({ strength: { ...good(), islands: 2, islandsCovered: 5 } });
    const fact = facts.find((f) => f.key === 'islandsUncovered')!;
    expect(fact.params.glued).toBe(0);
  });

  it('las cantidades achicadas se informan como cantidades (no mm)', () => {
    const fact = firmnessFacts({ strength: good() }).find((f) => f.key === 'shrunkCount')!;
    expect(fact.params).toEqual({ from: 4, to: 2 });
  });
});
