/**
 * @file src/components/__tests__/SplitPrefs.test.tsx
 * @description Preferencias de "División y uniones": se guardan (localStorage y validación), el panel de
 * división y el corte por plano las toman al abrirse, cambiar algo en el panel no las modifica y la casilla
 * "Reforzar uniones débiles" (apagada por defecto) manda `reinforceWeakJoints` al motor. También los textos
 * del aviso de unión débil y de refuerzo con las medidas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { OPERATION_DEFAULTS } from '../../engine/operationLimits';
import { DEFAULT_SPLIT_PREFERENCES, loadInitialSplitPreferences, sanitizeSplitPreferences, STORAGE_SPLIT_PREFS_KEY } from '../../store/splitPreferences';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { PlaneCutModal } from '../PlaneCutModal';
import { SplitSettings } from '../settings/SplitSettings';
import { SplitForBedPanel } from '../split/SplitForBedPanel';

vi.mock('../../engine/cutConnectorSuggest', () => ({
  cutOffsetRange: () => ({ min: -10, max: 10 }),
  suggestCutConnectors: () => Promise.resolve({ feasible: true, size: 4, depth: 6, count: 2, maxSize: 9, maxDepth: 12, maxCount: 4 }),
  checkCutConnectorFit: () => Promise.resolve(true),
  cutConnectorCenters: () => Promise.resolve([]),
}));

const request = vi.fn();
const split = vi.fn();
const kindSelect = () => screen.getByLabelText(t('es', 'dialog.cut.connectorType'), { selector: 'select' }) as HTMLSelectElement;

beforeEach(() => {
  request.mockReset();
  split.mockReset().mockResolvedValue(null);
  localStorage.clear();
  useKuraStore.setState({
    language: 'es',
    objects: [fakeBox('a', 'Cubo', 300)],
    selectedIds: ['a'],
    customBedDimensions: { width: 256, depth: 256, height: 256 },
    requestSplitPlan: request,
    splitObjectForBed: split,
    busyOperation: null,
    splitPrefs: DEFAULT_SPLIT_PREFERENCES,
  } as never);
});

describe('preferencias de división', () => {
  it('valores iniciales: espiga fija, holgura de OPERATION_DEFAULTS y refuerzo apagado', () => {
    expect(DEFAULT_SPLIT_PREFERENCES).toEqual({ connectorType: 'dowel', tolerance: 0.25, connectorSize: 'auto', reinforceWeakJoints: false });
    expect(OPERATION_DEFAULTS.split.reinforceWeakJoints).toBe(false);
  });

  it('se validan: tipo desconocido, holgura fuera de rango o basura vuelven a lo seguro', () => {
    expect(sanitizeSplitPreferences({ connectorType: 'x', tolerance: 99, reinforceWeakJoints: 'sí' })).toEqual({ connectorType: 'dowel', tolerance: 5, connectorSize: 'auto', reinforceWeakJoints: false });
    expect(sanitizeSplitPreferences(null)).toEqual(DEFAULT_SPLIT_PREFERENCES);
    expect(sanitizeSplitPreferences({ connectorSize: 3 }).connectorSize).toBe(3);
    expect(sanitizeSplitPreferences({ connectorSize: 'enorme' }).connectorSize).toBe('auto');
    expect(sanitizeSplitPreferences({ connectorSize: 9999 }).connectorSize).toBe(500);
  });

  it('Ajustes guarda las preferencias y se recuperan al reiniciar', () => {
    render(<SplitSettings idPrefix="s" />);
    fireEvent.change(screen.getByLabelText(t('es', 'settings.split.connector')), { target: { value: 'loose-dowel' } });
    fireEvent.click(screen.getByLabelText(new RegExp(t('es', 'settings.split.reinforce'))));
    expect(useKuraStore.getState().splitPrefs).toMatchObject({ connectorType: 'loose-dowel', reinforceWeakJoints: true });
    expect(JSON.parse(localStorage.getItem(STORAGE_SPLIT_PREFS_KEY)!)).toMatchObject({ connectorType: 'loose-dowel', reinforceWeakJoints: true });
    expect(loadInitialSplitPreferences()).toMatchObject({ connectorType: 'loose-dowel', reinforceWeakJoints: true });
    // Todos los tipos del panel, incluido el tarugo suelto
    const values = Array.from((screen.getByLabelText(t('es', 'settings.split.connector')) as HTMLSelectElement).options).map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['auto', 'dowel', 'peg', 'dovetail', 'loose-dowel', 'lap', 'none']));
  });

  it('el panel de división toma conector y holgura preferidos al abrirse y cambiarlos allí no toca la preferencia', () => {
    useKuraStore.getState().setSplitPrefs({ connectorType: 'loose-dowel', tolerance: 0.4 });
    render(<SplitForBedPanel open onClose={() => undefined} />);
    expect(kindSelect().value).toBe('loose-dowel');
    expect(request.mock.calls.at(-1)![2].connector).toMatchObject({ type: 'loose-dowel', tolerance: 0.4 });
    fireEvent.change(kindSelect(), { target: { value: 'peg' } });
    expect(useKuraStore.getState().splitPrefs.connectorType).toBe('loose-dowel');
  });

  it('el tamaño del conector es automático por defecto, se manda al motor y se puede fijar en diámetro Ø', async () => {
    useKuraStore.getState().setSplitPrefs({ connectorType: 'dowel' });
    const { unmount } = render(<SplitForBedPanel open onClose={() => undefined} />);
    const auto = screen.getByLabelText(t('es', 'split.size.auto')) as HTMLInputElement;
    expect(auto.checked).toBe(true);
    expect(request.mock.calls.at(-1)![2].connector).toMatchObject({ sizeAuto: true });
    expect((screen.getByLabelText(`${t('es', 'split.size.label')} (mm)`) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(auto);
    const call = request.mock.calls.at(-1)![2].connector;
    expect(call.sizeAuto).toBeUndefined();
    expect(call.size).toBe(4);
    // El campo muestra el diámetro (el doble del radio interno)
    expect((screen.getByLabelText(`${t('es', 'split.size.label')} (mm)`) as HTMLInputElement).value).toBe('8');
    unmount();
    // La preferencia fija un radio guardado y el panel lo abre como diámetro
    useKuraStore.getState().setSplitPrefs({ connectorSize: 3 });
    render(<SplitForBedPanel open onClose={() => undefined} />);
    expect((screen.getByLabelText(t('es', 'split.size.auto')) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText(`${t('es', 'split.size.label')} (mm)`) as HTMLInputElement).value).toBe('6');
  });

  it('Ajustes ofrece Automático (recomendado) y, al quitarlo, el diámetro Ø', () => {
    render(<SplitSettings idPrefix="s" />);
    const box = screen.getByLabelText(t('es', 'settings.split.sizeAuto'), { exact: false }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(useKuraStore.getState().splitPrefs.connectorSize).toBe(4);
    expect((screen.getByLabelText(t('es', 'settings.split.sizeValue')) as HTMLInputElement).value).toBe('8');
    fireEvent.click(box);
    expect(useKuraStore.getState().splitPrefs.connectorSize).toBe('auto');
  });

  it('el corte por plano toma el conector preferido; si no lo ofrece usa espiga', () => {
    useKuraStore.getState().setSplitPrefs({ connectorType: 'peg', tolerance: 0.35 });
    const { unmount } = render(<PlaneCutModal open onClose={() => undefined} />);
    expect((screen.getByLabelText(t('es', 'dialog.cut.connectorType')) as HTMLSelectElement).value).toBe('peg');
    unmount();
    useKuraStore.getState().setSplitPrefs({ connectorType: 'loose-dowel' });
    render(<PlaneCutModal open onClose={() => undefined} />);
    expect((screen.getByLabelText(t('es', 'dialog.cut.connectorType')) as HTMLSelectElement).value).toBe('dowel');
  });
});

describe('refuerzo de uniones débiles en el panel', () => {
  const planReady = () =>
    act(() => useKuraStore.setState({
      splitPlanPreview: {
        objectId: 'a', status: 'ready', bed: { widthMm: 256, depthMm: 256, heightMm: 256 }, error: null, errorCode: null,
        plan: {
          bounds: { min: [-150, 0, -150], max: [150, 300, 150] }, usableMm: [246, 246, 246], counts: { x: 2, y: 2, z: 2 },
          planes: [{ axis: 'y', index: 0, position: 150, uniformPosition: 150, sectionAreaMm2: 90000, islands: 1, strips: 0, smallestIslandMm2: 90000, admitsConnectors: true }],
          pieces: [0, 1].map((j) => ({
            code: `A${j + 1}`, cell: [0, j, 0] as [number, number, number], rotated: false, printRotation: [0, 0, 0] as [number, number, number], diagonal: false, bedMarginMm: 5,
            bounds: { min: [-150, j * 150, -150] as [number, number, number], max: [150, (j + 1) * 150, 150] as [number, number, number] },
            sizeMm: [240, 150, 240] as [number, number, number],
          })),
          fitsWithoutCuts: false, connector: { type: 'dowel', size: 1.5, depth: 6, tolerance: 0.25, count: 1 }, elapsedMs: 1,
        },
      },
    } as never));
  const runSplit = async () => {
    planReady();
    const btn = screen.getByRole('button', { name: t('es', 'split.execute'), hidden: true }) as HTMLButtonElement;
    fireEvent.click(btn);
    await vi.waitFor(() => expect(split).toHaveBeenCalled());
    return split.mock.calls[0][1].execute;
  };

  it('apagada por defecto, con su explicación enlazada por aria-describedby', async () => {
    render(<SplitForBedPanel open onClose={() => undefined} />);
    const box = screen.getByLabelText(t('es', 'split.reinforce')) as HTMLInputElement;
    expect(box.checked).toBe(false);
    const help = document.getElementById(box.getAttribute('aria-describedby')!);
    expect(help?.textContent).toBe(t('es', 'split.reinforceHelp'));
    expect(help?.textContent).toContain('cambia el diámetro que pediste');
    expect((await runSplit()).reinforceWeakJoints).toBe(false);
  });

  it('con la casilla activa el motor recibe reinforceWeakJoints: true', async () => {
    render(<SplitForBedPanel open onClose={() => undefined} />);
    fireEvent.click(screen.getByLabelText(t('es', 'split.reinforce')));
    expect((await runSplit()).reinforceWeakJoints).toBe(true);
    expect(useKuraStore.getState().splitPrefs.reinforceWeakJoints).toBe(false);
  });

  it('la preferencia de Ajustes marca la casilla al abrir', () => {
    useKuraStore.getState().setSplitPrefs({ reinforceWeakJoints: true });
    render(<SplitForBedPanel open onClose={() => undefined} />);
    expect((screen.getByLabelText(t('es', 'split.reinforce')) as HTMLInputElement).checked).toBe(true);
  });
});

describe('avisos con medidas', () => {
  it('unión débil: radio medido, radio recomendado, cuidado al imprimir y armar, y cómo reforzar', () => {
    const text = t('es', 'splitJoints.note.weak', { measured: '1,5', recommended: '4' });
    expect(text).toContain('1,5 mm');
    expect(text).toContain('4 mm');
    expect(text).toMatch(/imprimir/);
    expect(text).toMatch(/armar/);
    expect(text).toContain('Reforzar uniones débiles');
  });

  it('refuerzo aplicado: pedido → aplicado con radio y cantidad, en los 6 idiomas', () => {
    for (const lang of ['es', 'en', 'de', 'fr', 'hi', 'zh'] as const) {
      const text = t(lang, 'engineWarning.SPLIT_CONNECTOR_REINFORCED', { label: '1', a: 'A1', b: 'A2', requested: 1.5, requestedCount: 1, size: 3, count: 2 });
      expect(text).toContain('→');
      expect(text).toContain('1.5');
      expect(text).toContain('3');
    }
  });
});
