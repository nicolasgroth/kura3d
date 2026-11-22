/**
 * @file src/core/scene/__tests__/splitJointStatus.test.ts
 * @description Estado de cada unión de un grupo dividido: firme, débil, para pegar, tipo cambiado y que
 * traba el montaje, con la validación por encima de lo dicho al dividir.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { SplitJointRecord } from '../../../types/kura';
import { buildJointRows, optionType, type SplitValidationReport } from '../splitJointStatus';

const rec = (label: string, over: Partial<SplitJointRecord> = {}): SplitJointRecord => ({
  label, axis: 'y', position: 10, a: 'A1', b: 'A2', kind: 'connector',
  connector: { type: 'dowel', size: 4, depth: 6, tolerance: 0.25, count: 2 }, connectorCenters: [], contactAreaMm2: 500, ...over,
});
const group = (joints: SplitJointRecord[]) =>
  ({ parts: [{ metadata: { split: { joints } } }, { metadata: { split: { joints } } }] }) as never;
const report = (over: Partial<SplitValidationReport> = {}): SplitValidationReport => ({
  ok: true, parts: 2, joints: 1, steps: 2, blocked: [], clashes: 0, weak: [], suggestions: [], order: [], blockedDetail: [],
  closure: { ok: true, interference: [], gaps: [] }, warnings: [], ...over,
});

describe('buildJointRows', () => {
  it('junta las uniones de las piezas sin repetirlas y las ordena por etiqueta', () => {
    const rows = buildJointRows(group([rec('2'), rec('1')]), null, null);
    expect(rows.map((r) => r.label)).toEqual(['1', '2']);
    expect(rows.every((r) => r.status === 'ok')).toBe(true);
  });

  it('deduce el estado desde lo dicho al dividir', () => {
    const rows = buildJointRows(group([rec('1'), rec('2'), rec('3', { kind: 'glue', connector: null }), rec('4')]), {
      warnings: [
        { code: 'ASSEMBLY_WEAK_JOINT', params: { label: '2', measured: 3, recommended: 5 } },
        { code: 'ASSEMBLY_JOINT_TYPE_CHANGED', params: { label: '4', from: 'dowel', to: 'dovetail' } },
        { code: 'SPLIT_LAP_NOT_PRINTABLE', params: { label: '3', tongue: 1, groove: 1, min: 2 } },
      ],
      suggestions: [], weakJoints: ['2'], gluedByFix: [], changedByFix: ['4:dovetail'],
    }, null);
    expect(rows.map((r) => r.status)).toEqual(['ok', 'weak', 'glue', 'changed']);
    expect(rows[1].weak).toEqual({ measuredMm: 3, recommendedMm: 5 });
    expect(rows[2].warnings.map((w) => w.code)).toEqual(['SPLIT_LAP_NOT_PRINTABLE']);
  });

  it('una unión con conector que la validación sugiere arreglar traba el montaje y trae las opciones del motor', () => {
    const rows = buildJointRows(group([rec('1')]), null, report({
      ok: false,
      suggestions: [{ joint: '1', options: ['glue', 'change-type:dovetail'] }],
      blockedDetail: [{ code: 'A2', conflictingJoints: ['1'], blockingParts: [] }],
    }));
    expect(rows[0].status).toBe('blocked');
    expect(rows[0].options).toEqual(['glue', 'change-type:dovetail']);
    expect(rows[0].blocks).toEqual(['A2']);
  });

  it('una unión ya pegada por el arreglo no figura como trabada aunque haya una sugerencia', () => {
    const rows = buildJointRows(group([rec('1', { kind: 'glue', connector: null })]), null, report({ suggestions: [{ joint: '1', options: ['glue'] }] }));
    expect(rows[0].status).toBe('glue');
  });

  it('la validación manda sobre la firmeza dicha al dividir', () => {
    const notes = { warnings: [], suggestions: [], weakJoints: ['1'], gluedByFix: [], changedByFix: [] };
    expect(buildJointRows(group([rec('1')]), notes, report({ weak: [] }))[0].status).toBe('ok');
    expect(buildJointRows(group([rec('1')]), null, report({ weak: [{ joint: '1', measuredMm: 2, recommendedMm: 4, areaFraction: 0.1 }] }))[0].status).toBe('weak');
  });

  it('el aviso de refuerzo solo aparece en uniones que conservan conector', () => {
    const reinf = (label: string) => ({ code: 'SPLIT_CONNECTOR_REINFORCED' as const, params: { label, a: 'A1', b: 'A2', requested: 1.5, size: 3, requestedCount: 1, count: 2 } });
    const notes = { warnings: [reinf('1'), reinf('2'), reinf('3')], suggestions: [], weakJoints: ['1', '2'], gluedByFix: ['2'], changedByFix: [] };
    const rows = buildJointRows(group([rec('1'), rec('2'), rec('3', { kind: 'glue', connector: null })]), notes, null);
    expect(rows[0].reinforced).toBe(true);
    expect(rows[0].status).toBe('weak');
    expect(rows[1].reinforced).toBe(false);
    expect(rows[1].warnings).toEqual([]);
    expect(rows[1].weak).toBeNull();
    expect(rows[2].reinforced).toBe(false);
    expect(rows[2].weak).toBeNull();
  });

  it('cada unión dice dónde quedó su marca de pareja', () => {
    const notes = { warnings: [{ code: 'SPLIT_LABEL_SKIPPED' as const, params: { label: '4', a: 'A1', b: 'A2', min: 3 } }], suggestions: [], weakJoints: [], gluedByFix: [], changedByFix: [] };
    const rows = buildJointRows(group([
      rec('1', { labelPlacement: 'joint' }), rec('2', { labelPlacement: 'outside' }), rec('3', { labelPlacement: 'dots' }),
      rec('4', { labelPlacement: null }), rec('5', { labelPlacement: null }), rec('6'),
    ]), notes, null);
    expect(rows.map((r) => r.mark)).toEqual(['joint', 'outside', 'dots', 'skipped', 'none', 'unknown']);
  });

  it('optionType separa pegar de cambiar de tipo', () => {
    expect(optionType('glue')).toBeNull();
    expect(optionType('change-type:dovetail')).toBe('dovetail');
  });
});
