/**
 * @file src/engine/orient/__tests__/orientBasePredicate.test.ts
 * @description «Hay base real» se decide en un solo lugar: el motivo `noBase` de `reasonsFor` coincide con
 * `hasRealBase` justo debajo, en y sobre el umbral, que se llama igual (`minSupportAreaMm2`) en todo el motor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { hasRealBase } from '../orientMeasure';
import { reasonsFor, type ScoreContext } from '../orientScore';
import type { OrientMeasures } from '../orientTypes';

const MIN = 25;
const ctx: ScoreContext = { partVolumeMm3: 1000, totalAreaMm2: 600, maxDimensionMm: 20, maxContactMm2: 100, minSupportAreaMm2: MIN };
const measures = (contactAreaMm2: number): OrientMeasures => ({
  overhangAreaMm2: 0, supportVolumeMm3: 0, contactAreaMm2, supportPolygonMm2: contactAreaMm2, tipAngleDeg: 30,
  stable: true, heightMm: 10, footprintMm: [10, 10], fitsBed: null,
});

describe('orientar: un solo predicado de base real', () => {
  it.each([0, MIN - 1e-9, MIN, MIN + 1e-9, 1000])('contacto %s mm²: noBase ⇔ !hasRealBase', (contact) => {
    const m = measures(contact);
    const noBase = reasonsFor(m, m, ctx, { isCurrent: true, equivalentToBest: false }).some((r) => r.key === 'noBase');
    expect(noBase).toBe(!hasRealBase(contact, MIN));
  });
});
