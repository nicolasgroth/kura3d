/**
 * @file src/components/__tests__/fitCheckPanel.test.tsx
 * @description Panel «Comprobar encaje» en el panel contextual: estado vacío (alcance y opciones), sin objetos
 * suficientes, corriendo (fase, avance y Cancelar), con choque (resumen, orden por gravedad, estado en texto,
 * cifra, marcas y recomendación), con holgura justa, todo calza, informe invalidado por un cambio en la escena,
 * teclado de la lista (flechas resaltan, Enter encuadra), limpieza del resaltado al salir y la disponibilidad
 * de la acción en el catálogo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FitCheckReport, FitPairResult } from '../../engine/fitCheck';
import { resolveFitCheckOptions } from '../../engine/fitCheck/runFitCheck';
import { actionAvailability } from '../../store/actionsCatalog';
import { fitCheckAfterFitTargets, fitCheckTargets } from '../../store/fitCheckTargets';
import { panelContextOf } from '../../store/panelContext';
import { RIGHT_PANEL_DEFAULT_WIDTH } from '../../store/rightPanelPrefs';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject } from '../../types/kura';
import { RightInspector } from '../RightInspector';
import { pairsBySeverity, phaseView } from '../fitCheck/fitCheckView';

const objs = (): SceneObject[] => [fakeBox('caja', 'Caja'), { ...fakeBox('placa', 'Placa'), role: 'reference' } as SceneObject, fakeBox('tapa', 'Tapa')];

function pair(partial: Partial<FitPairResult> & Pick<FitPairResult, 'aId' | 'bId' | 'status'>): FitPairResult {
  return {
    aName: partial.aId === 'placa' ? 'Placa' : partial.aId === 'caja' ? 'Caja' : 'Tapa',
    bName: partial.bId === 'caja' ? 'Caja' : partial.bId === 'tapa' ? 'Tapa' : 'Placa',
    kind: 'reference-solid',
    approximate: false,
    interference: null,
    clearanceMm: null,
    closest: null,
    simplified: false,
    recommendation: null,
    ...partial,
  };
}

const clash = pair({
  aId: 'placa',
  bId: 'caja',
  status: 'interferes',
  approximate: true,
  interference: { volumeMm3: 125.5, zoneBox: { min: [0, 0, 0], max: [5, 5, 5] }, point: [2.5, 2.5, 2.5], approximate: true, depthMm: 1 },
  clearanceMm: 0,
  recommendation: { key: 'fitCheck.rec.enlarge', params: { inner: 'Placa', outer: 'Caja', volumeMm3: 125.5, x: 1, y: 2, z: 3, perSideMm: 0.6, axes: 'X' }, estimate: true },
});
const tight = pair({
  aId: 'caja',
  bId: 'tapa',
  status: 'tight',
  kind: 'solid-solid',
  clearanceMm: 0.1,
  closest: { onA: [0, 0, 10], onB: [0, 0, 10.1] },
  recommendation: { key: 'fitCheck.rec.tight', params: { a: 'Caja', b: 'Tapa', gapMm: 0.1, targetMm: 0.25, missingMm: 0.15, x: 0, y: 0, z: 10, direction: '+z' } },
});
const okPair = pair({ aId: 'placa', bId: 'tapa', status: 'ok', clearanceMm: 1.5, closest: { onA: [0, 0, 0], onB: [1.5, 0, 0] } });

function report(pairs: FitPairResult[], extra: Partial<FitCheckReport> = {}): FitCheckReport {
  const count = (s: string) => pairs.filter((p) => p.status === s).length;
  const worst = pairs.find((p) => p.status === 'interferes') ?? pairs.find((p) => p.status === 'tight') ?? null;
  return {
    version: 1,
    objectIds: ['caja', 'placa', 'tapa'],
    options: resolveFitCheckOptions(),
    pairs,
    summary: {
      objects: 3,
      possiblePairs: 3,
      broadPhaseCandidates: pairs.length,
      evaluatedPairs: pairs.length,
      interferes: count('interferes'),
      tight: count('tight'),
      ok: count('ok'),
      far: count('far'),
      skipped: 0,
      worst: worst ? { aId: worst.aId, bId: worst.bId, status: worst.status } : null,
      message: worst
        ? { key: 'fitCheck.summary.issues', params: { pairs: pairs.length, clashes: count('interferes'), tight: count('tight'), a: worst.aName, b: worst.bName } }
        : { key: 'fitCheck.summary.clean', params: { pairs: pairs.length } },
    },
    subtractions: { applied: 0, ignored: 0, failed: [] },
    truncated: false,
    notes: [],
    durationMs: 12,
    ...extra,
  };
}

function seed(extra: Record<string, unknown> = {}) {
  localStorage.clear();
  useKuraStore.setState({
    language: 'es',
    objects: objs(),
    selectedIds: [],
    activeAction: 'fitCheck',
    activeTool: 'select',
    rightCollapsed: false,
    rightPanelWidth: RIGHT_PANEL_DEFAULT_WIDTH,
    busyOperation: null,
    fitCheck: null,
    fitCheckRunning: null,
    fitCheckHighlight: null,
    fitCheckStale: false,
    ...extra,
  } as never);
}

const withReport = (r: FitCheckReport) => ({ fitCheck: { report: r, inputs: [] } });

describe('Comprobar encaje: panel', () => {
  beforeEach(() => seed());

  it('sin informe muestra el alcance, la holgura por defecto, la casilla y Comprobar', () => {
    render(<RightInspector />);
    expect(document.getElementById('kura-inspector-panel')!.dataset.context).toBe('action');
    expect(screen.getByRole('heading', { name: 'Comprobar encaje' })).toBeTruthy();
    expect(screen.getByTestId('fit-check-scope').textContent).toContain('Se comprueban los 3 objetos visibles.');
    expect((screen.getByRole('textbox', { name: 'Holgura deseada (mm)' }) as HTMLInputElement).value).toBe('0.25');
    expect((screen.getByRole('checkbox', { name: 'Aplicar restas pendientes (en copia)' }) as HTMLInputElement).checked).toBe(true);
    const run = screen.getByRole('button', { name: 'Comprobar' }) as HTMLButtonElement;
    expect(run.disabled).toBe(false);
    expect(run.getAttribute('data-help')).toBe('fitCheck.run');
    expect(screen.queryByTestId('fit-check-result')).toBeNull();
  });

  it('Comprobar envía los objetos y las opciones; una holgura inválida lo deshabilita', () => {
    const checkFit = vi.fn(async () => null);
    seed({ checkFit, selectedIds: ['caja', 'placa'] });
    render(<RightInspector />);
    expect(screen.getByTestId('fit-check-scope').textContent).toContain('los 2 objetos seleccionados');
    const input = screen.getByRole('textbox', { name: 'Holgura deseada (mm)' });
    fireEvent.change(input, { target: { value: '0,4' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Aplicar restas pendientes (en copia)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }));
    expect(checkFit).toHaveBeenCalledWith({ ids: ['caja', 'placa'], options: { clearanceTargetMm: 0.4, applyPendingSubtractions: false } });
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect((screen.getByRole('button', { name: 'Comprobar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('con menos de dos objetos dice por qué y no deja comprobar', () => {
    seed({ objects: [fakeBox('caja', 'Caja')] });
    render(<RightInspector />);
    expect(screen.getByTestId('fit-check-scope').textContent).toContain('Hacen falta dos objetos visibles');
    expect((screen.getByRole('button', { name: 'Comprobar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('corriendo muestra la fase, el avance y Cancelar', () => {
    const cancelFitCheck = vi.fn();
    seed({ fitCheckRunning: { phase: 'pair:2/4' }, cancelFitCheck });
    render(<RightInspector />);
    expect(screen.getByTestId('fit-check-running').textContent).toContain('Revisando par 2 de 4');
    const bar = screen.getByRole('progressbar', { name: 'Avance de la comprobación' }) as HTMLProgressElement;
    expect(bar.value).toBe(60);
    expect((screen.getByTestId('fit-check-run') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(cancelFitCheck).toHaveBeenCalled();
  });

  it('con choque: resumen, pares por gravedad con estado en texto, cifra, marcas y recomendación', () => {
    seed(withReport(report([okPair, tight, clash])));
    render(<RightInspector />);
    expect(screen.getByTestId('fit-check-count-pairs').textContent).toBe('3');
    expect(screen.getByTestId('fit-check-count-clashes').textContent).toBe('1');
    expect(screen.getByTestId('fit-check-count-tight').textContent).toBe('1');
    expect(screen.getByText('Peor caso').nextSibling?.textContent).toBe('«Placa» y «Caja»');
    expect(screen.getByRole('button', { name: 'Volver a comprobar' })).toBeTruthy();
    const options = within(screen.getByRole('listbox', { name: 'Pares, del más grave al menos' })).getAllByRole('option');
    expect(options.map((o) => o.dataset.status)).toEqual(['interferes', 'tight', 'ok']);
    expect(options[0].textContent).toContain('Choque');
    expect(options[0].textContent).toContain('Choque de 125,5 mm³');
    expect(options[0].textContent).toContain('Aproximado');
    expect(options[0].textContent).toContain('Estimado');
    expect(options[0].textContent).toContain('Agranda el alojamiento unos 0,6 mm por lado');
    expect(options[1].textContent).toContain('Justo');
    expect(options[1].textContent).toContain('Holgura 0,10 mm');
    expect(options[1].textContent).toContain('+Z (arriba)');
    expect(options[2].textContent).toContain('Bien');
    expect(screen.queryByTestId('fit-check-clean')).toBeNull();
  });

  it('con holgura justa (sin choque) no dice que todo calza', () => {
    seed(withReport(report([tight])));
    render(<RightInspector />);
    expect(screen.getByTestId('fit-check-count-tight').textContent).toBe('1');
    expect(screen.queryByTestId('fit-check-clean')).toBeNull();
    expect(screen.getByRole('option').textContent).toContain('Justo');
  });

  it('sin pares cercanos no dice que todo calza: explica que no hubo nada que comparar', () => {
    seed(withReport(report([])));
    render(<RightInspector />);
    expect(screen.getByTestId('fit-check-count-pairs').textContent).toBe('0');
    const clean = screen.getByTestId('fit-check-clean').textContent!;
    expect(clean).not.toContain('Todo calza');
    expect(clean).toMatch(/^Ningún objeto está a menos de [\d,.]+ mm de otro: no hay pares que comparar\.$/);
  });

  it('al cambiar la selección el resultado anterior deja de mostrarse y pide volver a comprobar', () => {
    seed({ ...withReport(report([okPair])), selectedIds: ['caja', 'placa'] });
    render(<RightInspector />);
    expect(screen.getByTestId('fit-check-result')).toBeTruthy();
    act(() => useKuraStore.setState({ selectedIds: ['caja', 'placa', 'tapa'] }));
    expect(screen.getByTestId('fit-check-scope').textContent).toContain('los 3 objetos seleccionados');
    expect(screen.queryByTestId('fit-check-result')).toBeNull();
    expect(screen.getByTestId('fit-check-stale').textContent).toContain('Cambiaste la selección');
    expect(screen.getByRole('button', { name: 'Volver a comprobar' })).toBeTruthy();
    // Un informe nuevo (otra referencia) vuelve a mostrarse con el alcance actual.
    act(() => useKuraStore.setState(withReport(report([clash])) as never));
    expect(screen.getByTestId('fit-check-count-clashes').textContent).toBe('1');
    expect(screen.queryByTestId('fit-check-stale')).toBeNull();
  });

  it('todo calza: estado vacío claro y notas visibles (truncado y restas)', () => {
    seed(withReport(report([okPair], { truncated: true, subtractions: { applied: 2, ignored: 0, failed: [] }, notes: [{ key: 'fitCheck.note.openMesh', params: { name: 'Placa' } }] })));
    render(<RightInspector />);
    expect(screen.getByTestId('fit-check-clean').textContent).toBe('Todo calza: ningún par choca ni queda justo.');
    const notes = screen.getByTestId('fit-check-notes');
    expect(notes.textContent).toContain('Resultado parcial');
    expect(notes.textContent).toContain('Restas aplicadas en copia: 2');
    expect(notes.textContent).toContain('«Placa» no es una malla cerrada');
  });

  it('invalidado: avisa que la escena cambió y ofrece volver a comprobar', () => {
    seed(withReport(report([clash])));
    render(<RightInspector />);
    act(() => useKuraStore.getState().clearFitCheck('stale'));
    expect(screen.getByTestId('fit-check-stale').textContent).toContain('La escena cambió');
    expect(screen.queryByTestId('fit-check-result')).toBeNull();
    expect(screen.getByRole('button', { name: 'Volver a comprobar' })).toBeTruthy();
  });

  it('teclado: flechas resaltan el par, Enter lo encuadra; al salir se limpia el resaltado', () => {
    const requestCameraPreset = vi.fn();
    seed({ ...withReport(report([okPair, tight, clash])), requestCameraPreset });
    const view = render(<RightInspector />);
    const options = screen.getAllByRole('option');
    expect(options[0].tabIndex).toBe(0);
    expect(options[1].tabIndex).toBe(-1);
    act(() => options[0].focus());
    fireEvent.keyDown(options[0], { key: 'ArrowDown' });
    expect(useKuraStore.getState().fitCheckHighlight).toEqual({ aId: 'caja', bId: 'tapa' });
    expect(document.activeElement).toBe(screen.getAllByRole('option')[1]);
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true');
    expect(requestCameraPreset).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getAllByRole('option')[1], { key: 'Enter' });
    expect(requestCameraPreset).toHaveBeenCalledWith('focus', ['caja', 'tapa']);
    fireEvent.keyDown(screen.getAllByRole('option')[1], { key: 'End' });
    expect(useKuraStore.getState().fitCheckHighlight).toEqual({ aId: 'placa', bId: 'tapa' });
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(useKuraStore.getState().activeAction).toBeNull();
    expect(useKuraStore.getState().fitCheckHighlight).toBeNull();
    view.unmount();
  });
});

describe('Comprobar encaje: alcance y disponibilidad', () => {
  it('opera sobre la selección con 2+ y si no sobre lo visible (sin negativos)', () => {
    const scene = [...objs(), { ...fakeBox('hueco', 'Hueco'), role: 'negative' } as SceneObject, { ...fakeBox('oculta', 'Oculta'), visible: false } as SceneObject];
    expect(fitCheckTargets(scene, ['caja', 'tapa'])).toEqual({ ids: ['caja', 'tapa'], source: 'selection' });
    expect(fitCheckTargets(scene, ['caja'])).toEqual({ ids: ['caja', 'placa', 'tapa'], source: 'visible' });
    expect(fitCheckTargets(scene, ['caja', 'hueco']).source).toBe('visible');
  });

  it('la acción se deshabilita con motivo si no hay dos objetos', () => {
    const state = { objects: [fakeBox('a', 'A')], selectedIds: [], groups: [], busyOperation: null } as never;
    expect(actionAvailability(state, 'fitCheck')).toEqual({ enabled: false, reason: 'fitCheck.ui.reason.needTwo' });
    expect(actionAvailability({ ...(state as object), objects: objs() } as never, 'fitCheck').enabled).toBe(true);
  });

  it('el panel de encaje se muestra sin selección y con varios objetos', () => {
    const base = { activeAction: 'fitCheck' as const, activeTool: 'select' as const, objects: objs() };
    expect(panelContextOf({ ...base, selectedIds: [] })).toEqual({ kind: 'action', id: 'fitCheck', objectId: null });
    expect(panelContextOf({ ...base, selectedIds: ['caja', 'tapa'] })).toEqual({ kind: 'action', id: 'fitCheck', objectId: null });
  });

  it('tras ajustar a la impresora solo se ofrece con referencias o medidas funcionales', () => {
    const scene = objs();
    expect(fitCheckAfterFitTargets(scene, ['caja'], 0)).toEqual(['caja', 'placa']);
    const sinRef = scene.filter((o) => o.role !== 'reference');
    expect(fitCheckAfterFitTargets(sinRef, ['caja', 'tapa'], 0)).toBeNull();
    expect(fitCheckAfterFitTargets(sinRef, ['caja', 'tapa'], 2)).toEqual(['caja', 'tapa']);
    expect(fitCheckAfterFitTargets(sinRef, ['caja'], 2)).toBeNull();
  });

  it('fases y orden por gravedad', () => {
    expect(phaseView('es', 'prepare:1/2')).toEqual({ text: 'Preparando objeto 1 de 2', fraction: 0.1 });
    expect(phaseView('es', null).fraction).toBeNull();
    expect(pairsBySeverity([okPair, tight, clash]).map((p) => p.status)).toEqual(['interferes', 'tight', 'ok']);
  });
});
