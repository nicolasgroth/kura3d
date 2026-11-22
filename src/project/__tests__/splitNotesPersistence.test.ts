/**
 * @file src/project/__tests__/splitNotesPersistence.test.ts
 * @description Los avisos de las uniones de "dividir para imprimir" (`splitNotes`) viajan en el `.kura`
 * (`metadata.split.groupNotes`): tras dividir, guardar y reabrir se recuperan los mismos avisos y el mismo
 * estado del armado; un archivo anterior sin el campo sigue abriendo; un campo corrupto o desmedido se
 * rechaza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { groupNotesOf } from '../../core/scene/splitGroupNotes';
import { buildJointRows, groupJointRecords } from '../../core/scene/splitJointStatus';
import { splitGroupOf } from '../../core/scene/splitGroups';
import { resetStore, store, addBox } from '../../store/__tests__/storeTestUtils';
import { DEFAULT_PRINTER_PROFILES, type SceneObject } from '../../types/kura';
import { decodeProject, encodeProject } from '../projectCodec';

const doc = (objects: SceneObject[]) => ({
  objects, selectedIds: [], past: [], future: [], unitSystem: 'mm' as const, printerProfile: DEFAULT_PRINTER_PROFILES[0],
  customBedDimensions: null, sectionPlane: { enabled: false, heightMm: 0 }, snapGridMm: 1,
});

describe('avisos de uniones en el .kura', () => {
  beforeEach(() => resetStore());

  it('dividir → guardar → abrir: mismos avisos por unión y mismo estado del armado', async () => {
    const box = await addBox(400);
    const res = await store().splitObjectForBed(box.id, {
      bed: { widthMm: 250, depthMm: 250, heightMm: 250 },
      plan: { connector: { type: 'dowel', size: 4, depth: 8, tolerance: 0.25, count: 1 } },
      execute: { connector: { type: 'dowel', size: 4, depth: 8, tolerance: 0.25, count: 1 } },
      dryRun: false,
    });
    expect(res?.parts.length).toBeGreaterThan(1);
    const before = store().splitNotes[box.id];
    expect(before).toBeTruthy();
    const reopened = decodeProject(encodeProject(doc(store().objects))).objects;
    const group = splitGroupOf(reopened, reopened.find((o) => o.metadata?.split)!.id)!;
    const after = groupNotesOf(group.parts, null)!;
    expect(after).toBeTruthy();
    expect(after.warnings.map((w) => [w.code, w.params])).toEqual(before.warnings.map((w) => [w.code, w.params]));
    expect(after.report).toEqual(before.report);
    // Las filas (estado + avisos por unión) son las mismas antes y después de reabrir.
    const sessionGroup = splitGroupOf(store().objects, store().objects.find((o) => o.metadata?.split)!.id)!;
    const strip = (rows: ReturnType<typeof buildJointRows>) => rows.map((r) => ({ l: r.label, s: r.status, w: r.warnings.map((x) => x.code), d: r.labelDots }));
    expect(strip(buildJointRows(group, after, null))).toEqual(strip(buildJointRows(sessionGroup, before, null)));
    expect(groupJointRecords(group).length).toBeGreaterThan(0);
  }, 120_000);

  it('un aviso guardado con la pieza (marca de puntos) sobrevive y llega a su unión', async () => {
    const box = await addBox(400);
    await store().splitObjectForBed(box.id, {
      bed: { widthMm: 250, depthMm: 250, heightMm: 250 }, plan: {}, execute: { connector: null }, dryRun: false,
    });
    const objects = store().objects.map((o) => ({ ...o }));
    const first = objects.find((o) => o.metadata?.split)!;
    const label = first.metadata!.split!.joints![0].label;
    first.metadata = {
      ...first.metadata,
      split: {
        ...first.metadata!.split!,
        groupNotes: {
          warnings: [{ code: 'SPLIT_LABEL_DOTS', params: { label, a: 'A1', b: 'A2' } }],
          suggestions: [], weakJoints: [], gluedByFix: [], changedByFix: [],
          report: { ok: false, steps: 0, blocked: ['B1'], clashes: 1, interference: 0, gaps: 0 },
        },
      },
    };
    const reopened = decodeProject(encodeProject(doc(objects))).objects;
    const group = splitGroupOf(reopened, reopened.find((o) => o.metadata?.split)!.id)!;
    const notes = groupNotesOf(group.parts, null)!;
    expect(notes.report?.blocked).toEqual(['B1']);
    const row = buildJointRows(group, notes, null).find((r) => r.label === label)!;
    expect(row.labelDots).toBe(true);
    expect(row.warnings.map((w) => w.code)).toContain('SPLIT_LABEL_DOTS');
  }, 120_000);

  it('un proyecto sin el campo abre igual y un campo corrupto o desmedido se rechaza', async () => {
    const box = await addBox(400);
    await store().splitObjectForBed(box.id, {
      bed: { widthMm: 250, depthMm: 250, heightMm: 250 }, plan: {}, execute: { connector: null }, dryRun: false,
    });
    const objects = store().objects.map((o) => {
      if (!o.metadata?.split) return o;
      const { groupNotes: _drop, ...split } = o.metadata.split;
      return { ...o, metadata: { ...o.metadata, split } };
    });
    expect(() => decodeProject(encodeProject(doc(objects)))).not.toThrow();
    const bad = objects.map((o, i) =>
      i === 0 && o.metadata?.split
        ? { ...o, metadata: { ...o.metadata, split: { ...o.metadata.split, groupNotes: { warnings: new Array(300).fill({ code: 'X', params: {} }), suggestions: [], weakJoints: [], gluedByFix: [], changedByFix: [] } } } }
        : o,
    );
    expect(() => encodeProject(doc(bad as SceneObject[]))).toThrow();
  }, 120_000);
});
