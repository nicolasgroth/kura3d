/**
 * @file src/core/scene/__tests__/splitJointCoupling.test.ts
 * @description Datos del motor que llegan a cada unión desde el inicio: la unión pegada por choque de
 * conectores trae su aviso propio (`ASSEMBLY_JOINT_GLUED_FOR_CLASH`) y queda "para pegar"; la marca de
 * puntos sale del registro (`labelPlacement: 'dots'`) y no del aviso; y el informe completo de la
 * división (bloqueos con detalle, débiles medidas, interferencias y huecos) alimenta filas y estado sin
 * pulsar "Validar armado".
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { AssemblyReport } from '../../../engine/split/assemblyTypes';
import { summarizeAssembly } from '../../../engine/split/validateAssembly';
import { t } from '../../../i18n';
import type { SplitJointRecord } from '../../../types/kura';
import { buildGroupNotes, fromStoredNotes, toStoredNotes } from '../splitGroupNotes';
import { buildJointRows } from '../splitJointStatus';

const rec = (label: string, over: Partial<SplitJointRecord> = {}): SplitJointRecord => ({
  label, axis: 'y', position: 10, a: 'A1', b: 'A2', kind: 'connector',
  connector: { type: 'dowel', size: 4, depth: 6, tolerance: 0.25, count: 2 }, connectorCenters: [], contactAreaMm2: 500, ...over,
});
const group = (joints: SplitJointRecord[]) =>
  ({ parts: [{ metadata: { split: { joints } } }, { metadata: { split: { joints } } }] }) as never;

const fullReport = (over: Partial<AssemblyReport> = {}): AssemblyReport => ({
  ok: false,
  closure: { ok: false, volumeErrorMm3: 0, volumeErrorPct: 0, interference: [{ a: 'A1', b: 'A2', volumeMm3: 12 }], gaps: [{ joint: '2', gapMm: 0.6 }] },
  clashes: [],
  order: [{ part: 0, code: 'A1', direction: '-y', step: 1 }],
  blocked: [{ part: 1, code: 'A2', reason: 'directions', conflictingJoints: ['1'], blockingParts: [] }],
  fix: { glueJoints: [], changeType: [], applied: false },
  suggestions: [{ joint: '1', options: ['glue'] }],
  weak: [{ joint: '2', measuredMm: 2.5, recommendedMm: 4, areaFraction: 0.01 }],
  warnings: [],
  voxelMm: 2,
  elapsedMs: 1,
  ...over,
});

describe('uniones con los datos del motor desde el inicio', () => {
  it('unión pegada por choque: aviso propio con texto veraz en los 6 idiomas y estado "para pegar"', () => {
    const notes = buildGroupNotes([{ code: 'ASSEMBLY_JOINT_GLUED_FOR_CLASH', params: { label: '1', a: 'A1', b: 'A2' } }], undefined);
    const rows = buildJointRows(group([rec('1', { kind: 'glue', connector: null })]), notes, null);
    expect(rows[0].status).toBe('glue');
    expect(rows[0].warnings.map((w) => w.code)).toEqual(['ASSEMBLY_JOINT_GLUED_FOR_CLASH']);
    for (const lang of ['es', 'en', 'de', 'fr', 'hi', 'zh'] as const) {
      const text = t(lang, 'engineWarning.ASSEMBLY_JOINT_GLUED_FOR_CLASH', { label: '1', a: 'A1', b: 'A2' });
      expect(text).toContain('A1');
      expect(text).not.toBe(t(lang, 'engineWarning.SPLIT_JOINT_NO_CONNECTOR', { label: '1', a: 'A1', b: 'A2' }));
    }
  });

  it('la marca de puntos sale del registro de la unión, sin aviso', () => {
    const rows = buildJointRows(group([rec('1', { labelPlacement: 'dots' }), rec('2', { labelPlacement: 'joint' }), rec('3')]), null, null);
    expect(rows.map((r) => r.labelDots)).toEqual([true, false, false]);
  });

  it('el informe de la división muestra bloqueos con detalle, débiles medidas, interferencias y huecos', () => {
    const notes = buildGroupNotes([], summarizeAssembly(fullReport()));
    expect(notes.report).toMatchObject({ ok: false, blocked: ['A2'], interference: 1, gaps: 1 });
    const rows = buildJointRows(group([rec('1'), rec('2')]), notes, null);
    expect(rows[0].status).toBe('blocked');
    expect(rows[0].blocks).toEqual(['A2']);
    expect(rows[1].status).toBe('weak');
    expect(rows[1].weak).toEqual({ measuredMm: 2.5, recommendedMm: 4 });
    // Guardado y reabierto, el detalle se conserva
    const back = fromStoredNotes(toStoredNotes(notes));
    expect(buildJointRows(group([rec('1'), rec('2')]), back, null).map((r) => [r.status, r.blocks, r.weak])).toEqual(rows.map((r) => [r.status, r.blocks, r.weak]));
  });
});
