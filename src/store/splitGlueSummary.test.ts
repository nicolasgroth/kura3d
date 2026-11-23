/**
 * @file src/store/splitGlueSummary.test.ts
 * @description Un solo resumen para las uniones de Dividir que pasan a "para pegar", y el aviso del
 * corte por plano que habla en diámetro (como el campo del diálogo) y dice qué se hizo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import type { EngineWarning } from '../engine';
import { collapseGlueWarnings, glueCountOf } from './splitGlueSummary';
import { occupiedPieces } from '../core/scene/splitOccupiedPieces';

const w = (code: string, params: Record<string, unknown> = {}) => ({ code, params }) as unknown as EngineWarning;

describe('resumen de uniones para pegar', () => {
  it('2 uniones para pegar + resumen del motor = un solo aviso; el resto pasa igual', () => {
    const other = w('SPLIT_PLANE_ALONG_WALL');
    const out = collapseGlueWarnings([
      w('SPLIT_JOINT_GLUE_ONLY', { label: 'J1' }), w('SPLIT_JOINT_NO_CONNECTOR', { label: 'J4' }),
      w('SPLIT_GLUE_SUMMARY', { count: 2, total: 7 }), other,
    ], 7);
    expect(out).toEqual({ rest: [other], count: 2, total: 7 });
  });

  it('sin uniones para pegar no hay resumen', () => {
    expect(collapseGlueWarnings(undefined, 3)).toEqual({ rest: [], count: 0, total: 3 });
  });

  it('el aviso del corte habla en diámetro y dice qué se hizo', () => {
    const es = t('es', 'engineWarning.CUT_CONNECTOR_ISLAND_SKIPPED', { skipped: 1, islands: 2, size: 4, diameter: 8 });
    expect(es).toContain('Ø8 mm');
    expect(es).not.toContain(' 4 mm');
    expect(es).toMatch(/quedaron lisas, para pegar/);
  });

  it('la vista previa solo lista las celdas con material', () => {
    const piece = (cell: [number, number, number]) => ({ code: cell.join(''), cell }) as never;
    const plan = { pieces: [piece([0, 0, 0]), piece([1, 0, 0])], occupancy: { cells: [[1, 0, 0]] } } as never;
    expect(occupiedPieces(plan).map((p) => p.code)).toEqual(['100']);
    expect(occupiedPieces({ pieces: [piece([0, 0, 0])] } as never)).toHaveLength(1);
  });
});

describe('cifra única de uniones para pegar', () => {
  it('cuenta las filas "glue" sobre el total, sea cual sea la causa', () => {
    const rows = [{ status: 'glue' }, { status: 'ok' }, { status: 'glue' }, { status: 'changed' }] as const;
    expect(glueCountOf(rows)).toEqual({ count: 2, total: 4 });
  });
});
