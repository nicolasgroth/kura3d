/**
 * @file src/store/__tests__/plateArrangePanel.store.test.ts
 * @description Lógica del panel «Repartir en placas…» con el motor real: la vista previa deja contornos para el visor
 * y nombra lo que no cabe; «Repartir» desde Armado aplica, pasa a Imprimir y avisa con Deshacer persistente; desde
 * Imprimir no cambia de vista; el paso se llama «Repartir en placas» en el historial y deshacerlo restaura; «Una
 * placa por objeto» usa su acción; cerrar descarta la vista previa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { arrangeHeadline } from '../../components/plates/PlateArrangeSummary';
import { t } from '../../i18n';
import { historyTimeline } from '../historyLabels';
import {
  applyPlateArrange, closePlateArrangePanel, openPlateArrangePanel, refreshPlateArrangePreview, setPlateArrangeOptions, usePlateArrangePanel,
} from '../plateArrangePanel';
import { newPlatesUsed } from '../../core/scene/plateArrangeTypes';
import { useKuraStore } from '../useKuraStore';
import { addBox, resetStore, store } from './storeTestUtils';

const BED = { width: 200, depth: 200, height: 200 };
const panel = () => usePlateArrangePanel.getState();

describe('panel Repartir en placas: lógica', () => {
  beforeEach(async () => {
    closePlateArrangePanel();
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print', customBedDimensions: BED, language: 'es', toasts: [] });
  });

  it('la vista previa deja contornos y nombra lo que no cabe, sin tocar la escena', async () => {
    await addBox(120, [0, 0, 0]);
    const big = await addBox(400, [300, 0, 0]);
    store().setSelection([]);
    const before = { objects: store().objects, past: store().past };
    expect(openPlateArrangePanel()).toBe(true);
    await refreshPlateArrangePreview();
    expect(panel().status).toBe('ready');
    expect(panel().preview!.report.unplaced).toEqual([{ id: big.id, reason: 'tooLarge' }]);
    expect(panel().ghost!.rects).toHaveLength(1);
    expect(store().objects).toBe(before.objects);
    expect(store().past).toBe(before.past);
  });

  it('con piezas que no caben en una placa, el contorno incluye las camas nuevas', async () => {
    for (let i = 0; i < 3; i++) await addBox(120, [i * 5, 0, 0]);
    store().setSelection([]);
    openPlateArrangePanel();
    await refreshPlateArrangePreview();
    expect(panel().preview!.report.platesCreated).toBe(3);
    expect(panel().ghost!.newBeds).toHaveLength(2);
    expect(panel().ghost!.rects).toHaveLength(3);
  });

  it('resumen coherente: 3 cubos, cama de 60, solo la selección (1 pieza) → 1 placa usada y 1 nueva, en singular', async () => {
    useKuraStore.setState({ customBedDimensions: { width: 60, depth: 60, height: 100 } });
    const cubes = [];
    for (let i = 0; i < 3; i++) cubes.push(await addBox(20, [i * 22 - 22, 0, 0]));
    store().setSelection([cubes[2].id]);
    openPlateArrangePanel();
    await refreshPlateArrangePreview();
    const report = panel().preview!.report;
    // Bus/MCP: la implícita que pasa a «Placa 1» también se agrega a la escena; la interfaz no la llama «nueva».
    expect(report.platesUsed).toHaveLength(1);
    expect(arrangeHeadline('es', report)).toBe('Se usará 1 placa (1 nueva). 1 pieza colocada.');
    expect(arrangeHeadline('en', report)).toBe('1 plate will be used (1 new). 1 part placed.');
    // Todo en la placa que ya hay: sin «0 nuevas».
    store().setSelection([]);
    useKuraStore.setState({ customBedDimensions: { width: 200, depth: 200, height: 100 } });
    setPlateArrangeOptions({ scope: 'all' });
    await refreshPlateArrangePreview();
    expect(arrangeHeadline('es', panel().preview!.report)).toBe('Se usará 1 placa existente, sin crear placas nuevas. 3 piezas colocadas.');
  });

  it('cambiar una opción descarta la vista previa vieja', async () => {
    await addBox(20, [0, 0, 0]);
    store().setSelection([]);
    openPlateArrangePanel();
    await refreshPlateArrangePreview();
    expect(panel().status).toBe('ready');
    setPlateArrangeOptions({ spacingMm: 12 });
    expect(panel().status).toBe('idle');
    expect(panel().preview).toBeNull();
    expect(panel().ghost).toBeNull();
  });

  it('«Repartir» desde Armado cierra, pasa a Imprimir, avisa con Deshacer y el paso se llama «Repartir en placas»', async () => {
    const boxes = [await addBox(120, [0, 0, 0]), await addBox(120, [10, 0, 0]), await addBox(120, [20, 0, 0])];
    expect(store().setLayout('assembly')).toBe(true);
    store().setSelection([]);
    openPlateArrangePanel();
    const steps = store().past.length;
    expect(await applyPlateArrange()).toBe(true);
    expect(panel().open).toBe(false);
    expect(store().layout).toBe('print');
    expect(store().plates).toHaveLength(3);
    expect(new Set(boxes.map((b) => store().objects.find((o) => o.id === b.id)!.plateRef)).size).toBe(3);
    expect(store().past.length).toBe(steps + 1);
    const toast = store().toasts.find((x) => x.text.includes(t('es', 'plates.arrangeDlg.toast.switched')));
    expect(toast).toBeTruthy();
    expect(toast!.action?.label).toBe(t('es', 'toast.undo'));
    expect(toast!.action?.transient).toBe(false);
    expect(toast!.action?.applicable?.()).toBe(true);
    expect(historyTimeline('es', store()).entries.at(-1)!.label).toBe('Repartir en placas');
    // El aviso del store no se duplica: solo el del panel.
    expect(store().toasts.filter((x) => x.text.includes('repartid'))).toHaveLength(1);
    toast!.action!.run();
    expect(store().plates).toHaveLength(0);
  });

  it('el aviso de Repartir dice las mismas placas y nuevas que la vista previa (no «existentes» si una es nueva)', async () => {
    await addBox(120, [0, 0, 0]);
    await addBox(120, [10, 0, 0]);
    await addBox(120, [20, 0, 0]);
    store().setSelection([]);
    store().createPlate();
    openPlateArrangePanel();
    await refreshPlateArrangePreview();
    const preview = panel().preview!.report;
    const created = newPlatesUsed(preview);
    expect(created).toBeGreaterThan(0);
    expect(await applyPlateArrange()).toBe(true);
    const toast = store().toasts.find((x) => x.text.includes('repartid'))!;
    expect(toast.text).not.toContain('existente');
    expect(toast.text).toContain(`en ${preview.platesUsed.length} placas (${created} ${created === 1 ? 'nueva' : 'nuevas'})`);
  });

  it('desde Imprimir no cambia de vista y lista lo que no cupo en un aviso aparte', async () => {
    await addBox(120, [0, 0, 0]);
    const big = await addBox(400, [300, 0, 0]);
    store().setSelection([]);
    openPlateArrangePanel();
    expect(await applyPlateArrange()).toBe(true);
    expect(store().layout).toBe('print');
    expect(store().toasts.some((x) => x.text.includes(t('es', 'plates.arrangeDlg.toast.switched')))).toBe(false);
    const list = store().toasts.find((x) => x.text.startsWith('No cupieron'));
    expect(list?.text).toContain(store().objects.find((o) => o.id === big.id)!.name);
    expect(list?.text).toContain('es más grande que la cama');
  });

  it('«Una placa por objeto» usa su acción y respeta el alcance', async () => {
    const a = await addBox(20, [0, 0, 0]);
    const b = await addBox(20, [40, 0, 0]);
    await addBox(20, [80, 0, 0]);
    store().setSelection([a.id, b.id]);
    openPlateArrangePanel();
    expect(panel().scope).toBe('selection');
    setPlateArrangeOptions({ criterion: 'onePerObject' });
    expect(await applyPlateArrange()).toBe(true);
    expect(panel().open).toBe(false);
    const ref = (id: string) => store().objects.find((o) => o.id === id)!.plateRef;
    expect(ref(a.id)).toBeTruthy();
    expect(ref(b.id)).toBeTruthy();
    expect(ref(a.id)).not.toBe(ref(b.id));
  });

  it('con una operación en curso no abre', async () => {
    await addBox(20, [0, 0, 0]);
    useKuraStore.setState({ busyOperation: 'x' });
    expect(openPlateArrangePanel()).toBe(false);
    useKuraStore.setState({ busyOperation: null });
  });
});
