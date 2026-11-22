/**
 * @file src/store/__tests__/validateAssemblyCommand.test.ts
 * @description `split_for_bed` con tarugo suelto (`loose-dowel`) deja tarugos como objeto aparte y las
 * uniones guardadas en `metadata.split.joints`; el proyecto las conserva al guardar y abrir; el comando
 * de solo lectura `validate_assembly` revalida por grupo o por selección y tipa los errores.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { isReadCommand, toolAccess } from '../../core/commands/commandPolicy';
import { decodeProject, encodeProject } from '../../project/projectCodec';
import { DEFAULT_PRINTER_PROFILES, type KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { addBox, resetStore, store } from './storeTestUtils';

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand({ id: 't_va', command: command as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;

describe('validate_assembly y tarugo suelto', () => {
  beforeEach(() => resetStore());

  it('divide con tarugos sueltos, guarda las uniones, sobrevive al proyecto y revalida', async () => {
    const box = await addBox(300);
    const res = await run('split_for_bed', { id: box.id, bedWidthMm: 400, bedDepthMm: 400, bedHeightMm: 200, connectorType: 'loose-dowel', connectorSize: 3, connectorDepth: 6, connectorCount: 1 });
    expect(res.ok).toBe(true);
    const out = res.result as { looseDowels?: Array<{ id: string; count: number; diameterMm: number }> };
    expect(out.looseDowels).toHaveLength(1);
    const dowel = store().objects.find((o) => o.id === out.looseDowels![0].id)!;
    expect(dowel.metadata?.splitDowel?.count).toBe(out.looseDowels![0].count);
    // La firmeza activa puede agrandar el tarugo (a lo más al doble); el largo es 2·6 − 2·0,25; coma decimal en es
    expect(dowel.name).toMatch(/^Tarugo Ø[\d,]+×11,5 ×\d+$/);
    expect(out.looseDowels![0].diameterMm).toBeLessThanOrEqual(12 + 1e-9);
    const parts = store().objects.filter((o) => o.metadata?.split?.groupId === box.id);
    expect(parts).toHaveLength(2);
    expect(parts.every((p) => (p.metadata!.split!.joints ?? []).length === 1)).toBe(true);

    // Guardar y abrir conserva uniones y tarugos
    const doc = decodeProject(encodeProject({
      objects: store().objects, selectedIds: [], past: [], future: [], unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0],
      customBedDimensions: null, sectionPlane: { enabled: false, heightMm: 0 }, snapGridMm: 1,
    }));
    const restored = doc.objects.find((o) => o.metadata?.split)!;
    expect(restored.metadata!.split!.joints![0].connector!.type).toBe('loose-dowel');
    expect(doc.objects.some((o) => o.metadata?.splitDowel)).toBe(true);

    expect(isReadCommand('validate_assembly')).toBe(true);
    expect(toolAccess('kura_validate_assembly')).toBe('read');
    const before = store().objects.length;
    const v = await run('validate_assembly', { groupId: box.id });
    expect(v.ok).toBe(true);
    const r = v.result as { ok: boolean; joints: number; steps: number; parts: number };
    expect(r).toMatchObject({ ok: true, joints: 1, steps: 2, parts: 2 });
    expect(store().objects.length).toBe(before);
    const one = await run('validate_assembly', { ids: [parts[0].id] });
    expect((one.result as { joints: number }).joints).toBe(0);
  }, 60_000);

  it('tipa los errores', async () => {
    const box = await addBox(20);
    expect((await run('validate_assembly', {})).errorCode).toBe('invalid-params');
    expect((await run('validate_assembly', { groupId: 'nada' })).errorCode).toBe('not-found');
    expect((await run('validate_assembly', { ids: [box.id] })).errorCode).toBe('precondition');
  });
});
