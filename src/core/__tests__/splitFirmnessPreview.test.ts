/**
 * @file src/core/__tests__/splitFirmnessPreview.test.ts
 * @description Lo que el resumen de "dividir para imprimir" promete antes de cortar es lo que el corte produce: la
 * firmeza prevista por unión (`BedSplitPlan.jointPreview`) coincide con `SplitJoint.strength` de la ejecución y con lo
 * guardado en cada pieza tras dividir desde el store (mismas medidas de conector, mismo nivel). Con el tamaño
 * automático apagado la previa usa el tamaño manual. También comprueba que el archivo de datos reales del motor que
 * usa la prueba de componente (`SplitJointFirmness.test.tsx`, que en jsdom no puede cargar el WASM) sigue vigente.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import saved from '../../components/__tests__/fixtures/jointPreview.json';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPrimitiveMesh, initManifoldEngine, jointRecord } from '../../engine';
import type { BedSplitPlan, SplitConnectorOptions } from '../../engine';
import { createKeyedNaming } from '../scene/resultNames';
import { APP_BUILD_POLICY, buildSceneObject } from '../scene/sceneObjects';
import * as ops from '../operations';
import { resetStore, store } from '../../store/__tests__/storeTestUtils';
import type { SplitJointRecord } from '../../types/kura';

const naming = createKeyedNaming((key) => key, { color: (hex) => hex, structure: (_r, id) => id });
let counter = 0;
const ctx: ops.OperationContext = { policy: APP_BUILD_POLICY, newId: () => `g_${++counter}`, naming };
const BED = { widthMm: 120, depthMm: 120, heightMm: 120 };

const base = (extra: Partial<SplitConnectorOptions> = {}): SplitConnectorOptions => ({
  type: 'dowel', size: 4, depth: 8, tolerance: 0.25, count: 2, minWallForConnectorMm: 2, ...extra,
});
const exec = (connector: SplitConnectorOptions) => ({ connector, labels: 'engraved' as const });

/** Barra de 440 mm en X (3 uniones con la cama de 120) y sección `section` × `section`. */
async function bar(section: number) {
  const mesh = await createPrimitiveMesh('box', { width: 440, height: section, depth: section });
  return buildSceneObject({ id: `bar${section}`, name: 'Barra', source: 'primitive', mesh });
}
async function previewOf(section: number, connector: SplitConnectorOptions): Promise<BedSplitPlan> {
  return ops.planSplitForBed(ctx, await bar(section), BED, { connector }, exec(connector));
}

const CASES: Record<string, { section: number; connector: SplitConnectorOptions }> = {
  wide: { section: 40, connector: base({ sizeAuto: true }) },
  thin: { section: 4, connector: base({ sizeAuto: true }) },
  manualWeak: { section: 100, connector: base({ size: 1.5, count: 1 }) },
  autoSame: { section: 100, connector: base({ sizeAuto: true, size: 1.5, count: 1 }) },
};

beforeAll(async () => {
  await initManifoldEngine();
}, 60_000);

describe('la previa de firmeza es lo que produce el corte', () => {
  it('cada unión de la previa trae la misma firmeza y medidas que la ejecución y que el registro guardado', async () => {
    const obj = await bar(40);
    const connector = CASES.wide.connector;
    const plan = await ops.planSplitForBed(ctx, obj, BED, { connector }, exec(connector));
    const { result } = await ops.executeBedSplit(ctx, obj, plan, { ...exec(connector), bed: BED });
    expect(plan.jointPreview).toHaveLength(result.joints.length);
    for (const j of result.joints) {
      const p = plan.jointPreview!.find((x) => x.label === j.label)!;
      expect(p.strength).toEqual(j.strength);
      expect(p.kind).toBe(j.kind);
      expect(p.connectorType).toBe(j.connector?.type ?? null);
      expect(p.strength.sizeMm).toBe(j.connector!.size);
      expect(p.strength.count).toBe(j.connectorCenters.length);
      // El registro que viaja con la pieza (y al .kura) lleva la misma firmeza
      expect(jointRecord(j).strength).toEqual(j.strength);
    }
  }, 120_000);

  it('al dividir desde el store, las piezas guardan la firmeza que prometió la previa (barra fina: para pegar)', async () => {
    await resetStore();
    for (const key of ['wide', 'thin'] as const) {
      const { section, connector } = CASES[key];
      const preview = await previewOf(section, connector);
      const created = (await store().createPrimitive('box', { width: 440, height: section, depth: section }, { position: [0, 0, 0] }))!;
      const out = await store().splitObjectForBed(created.id, { bed: BED, plan: { connector }, execute: exec(connector), dryRun: false });
      expect(out).not.toBeNull();
      const parts = store().objects.filter((o) => o.metadata?.split?.groupId === created.id);
      const saved = new Map<string, SplitJointRecord>();
      for (const p of parts) for (const r of p.metadata!.split!.joints ?? []) saved.set(r.label, r);
      expect(saved.size).toBe(preview.jointPreview!.length);
      for (const p of preview.jointPreview!) {
        const rec = saved.get(p.label)!;
        expect(rec.strength).toEqual(p.strength);
        if (p.connectorType) expect(rec.connector?.size).toBe(p.strength.sizeMm);
      }
    }
  }, 180_000);

  it('con el tamaño manual la previa usa ese tamaño y marca débiles las uniones; con el automático no', async () => {
    const manual = await previewOf(CASES.manualWeak.section, CASES.manualWeak.connector);
    expect(manual.jointPreview!.length).toBeGreaterThan(0);
    for (const j of manual.jointPreview!) {
      expect(j.strength.level).toBe('weak');
      expect(j.strength.sizeMm).toBe(1.5);
      expect(j.strength.reasons).toContain('low-area');
    }
    const auto = await previewOf(CASES.autoSame.section, CASES.autoSame.connector);
    for (const j of auto.jointPreview!) expect(j.strength.level).not.toBe('weak');
  }, 120_000);

  it('los datos del motor que usa la prueba de componente (fixtures/jointPreview.json) siguen vigentes', async () => {
    // Si falla, el motor cambió: copia el JSON actual de `fresh` a src/components/__tests__/fixtures/jointPreview.json.
    const fresh: Record<string, unknown> = {};
    for (const [key, c] of Object.entries(CASES)) fresh[key] = (await previewOf(c.section, c.connector)).jointPreview;
    expect(JSON.parse(JSON.stringify(saved))).toEqual(JSON.parse(JSON.stringify(fresh)));
  }, 180_000);
});
