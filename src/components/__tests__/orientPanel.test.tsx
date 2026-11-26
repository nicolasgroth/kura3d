/**
 * @file src/components/__tests__/orientPanel.test.tsx
 * @description Panel «Orientar para imprimir» con el motor real: calcula al abrirse (estado anunciado), lista de la
 * «T» con «Actual» y «Recomendada» y sus motivos en lenguaje claro, esfera sin recomendación, teclado (flechas
 * recorren y muestran la vista previa, Enter aplica, Esc vuelve), ángulo de voladizo que recalcula, nota fija y
 * disponibilidad de la acción en el catálogo y la paleta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeObject } from '../../engine/__tests__/geometryTestUtils';
import { tUpright } from '../../engine/__tests__/orientShapes';
import { actionAvailability } from '../../store/actionsCatalog';
import { RIGHT_PANEL_DEFAULT_WIDTH } from '../../store/rightPanelPrefs';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { actionPaletteItems } from '../actionPaletteItems';
import { OrientPanel, parseOrientAngle } from '../orient/OrientPanel';
import { RightInspector } from '../RightInspector';

const tPiece = (): SceneObject => makeObject('t', tUpright(), { position: [20, 0, 5], name: 'Te' });

function sphereMesh(): SceneObject['mesh'] {
  const g = new THREE.SphereGeometry(15, 40, 28);
  return { positions: new Float32Array(g.getAttribute('position').array), indices: new Uint32Array(g.getIndex()!.array), normals: new Float32Array(0) } as never;
}

async function seed(objects: SceneObject[], selectedIds: string[], language: 'es' | 'en' = 'es') {
  localStorage.clear();
  useKuraStore.setState({
    engineReady: true, engineError: null, busyOperation: null, language, objects, selectedIds, groups: [], past: [], future: [], toasts: [],
    activeAction: 'orient', activeTool: 'select', rightCollapsed: false, rightPanelWidth: RIGHT_PANEL_DEFAULT_WIDTH,
    orient: null, orientRunning: false, orientStale: false, orientPreviewId: null, orientOverhang: null, orientKeepXY: true,
  } as never);
}

const options = () => screen.getAllByTestId('orient-option');

describe('Orientar para imprimir: panel', () => {
  afterEach(() => {
    useKuraStore.getState().clearOrient();
    cleanup();
  });

  it('calcula al abrirse y lista la «T» con Actual, Recomendada, medidas y motivos claros', async () => {
    await seed([tPiece()], ['t']);
    render(<RightInspector />);
    expect(screen.getByRole('heading', { name: 'Orientar para imprimir' })).toBeTruthy();
    await screen.findByTestId('orient-options');
    const list = screen.getByRole('listbox', { name: 'Orientaciones posibles' });
    expect(list).toBeTruthy();
    const first = options()[0];
    expect(within(first).getByTestId('orient-badge-recommended').textContent).toContain('Recomendada');
    expect(first.textContent).toMatch(/Sin voladizos: no necesita soporte/);
    expect(first.textContent).toMatch(/menos soporte que ahora/);
    const current = options().find((o) => within(o).queryByTestId('orient-badge-current'))!;
    expect(current.textContent).toContain('Actual');
    // Cuatro medidas por opción y nombre accesible completo.
    expect(first.querySelectorAll('[data-stat]')).toHaveLength(4);
    expect(first.getAttribute('aria-label')).toMatch(/^Opción 1\. Recomendada\./);
    expect(first.getAttribute('aria-label')).toContain('Soporte aprox.');
    expect(screen.getByTestId('orient-summary').dataset.kind).toBe('better');
    // La nota honesta es fija.
    expect(screen.getByTestId('orient-note').textContent).toMatch(/aproximado.*puentes cortos.*decisión final es tuya/s);
  });

  it('muestra el indicador de cálculo con Cancelar mientras corre y lo anuncia en una región de estado', async () => {
    await seed([tPiece()], ['t']);
    useKuraStore.setState({ orientRunning: true } as never);
    render(<OrientPanel primary={useKuraStore.getState().objects[0]} />);
    // Al montar, el panel arranca su propio cálculo: el indicador vive en un `role="status"`.
    const status = screen.getAllByRole('status').find((el) => el.getAttribute('data-testid') === 'orient-status')!;
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(within(status).getByTestId('orient-running').textContent).toContain('Calculando orientaciones');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('orient-cancel'));
    await waitFor(() => expect(useKuraStore.getState().orientRunning).toBe(false));
    expect(screen.getByTestId('orient-cancelled')).toBeTruthy();
    expect(screen.getByTestId('orient-recalc')).toBeTruthy();
  });

  it('una esfera no tiene recomendada: lo dice arriba y no marca ninguna', async () => {
    await seed([makeObject('s', sphereMesh(), { name: 'Bola' })], ['s']);
    render(<RightInspector />);
    await screen.findByTestId('orient-options');
    expect(screen.getByTestId('orient-summary').dataset.kind).toBe('equivalent');
    expect(screen.getByTestId('orient-summary').textContent).toContain('no hay una recomendada');
    expect(screen.queryByTestId('orient-badge-recommended')).toBeNull();
    expect((screen.getByTestId('orient-apply') as HTMLButtonElement).disabled).toBe(true);
  });

  it('flechas recorren y muestran la vista previa; Enter aplica; la lista se recalcula con la aplicada como Actual', async () => {
    await seed([tPiece()], ['t']);
    render(<RightInspector />);
    await screen.findByTestId('orient-options');
    const before = useKuraStore.getState().objects[0];
    const [first, second] = options();
    // La recomendada ya está elegida y en vista previa.
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(useKuraStore.getState().operationPreview.key).toBe('orient');
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(second);
    expect(useKuraStore.getState().orientPreviewId).toBe(second.dataset.candidate);
    expect(useKuraStore.getState().objects[0].rotation).toEqual(before.rotation);
    fireEvent.keyDown(second, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
    const pastBefore = useKuraStore.getState().past.length;
    fireEvent.keyDown(first, { key: 'Enter' });
    await waitFor(() => expect(useKuraStore.getState().past.length).toBe(pastBefore + 1));
    await waitFor(() => expect(screen.getByTestId('orient-summary').dataset.kind).toBe('best'));
    expect(screen.getByTestId('orient-summary').textContent).toContain('ya es la mejor');
    const now = options().find((o) => within(o).queryByTestId('orient-badge-current'))!;
    expect(now.textContent).toContain('Sin voladizos');
    // El foco queda en la opción aplicada (ahora «Actual») y es la única elegida: un segundo Enter no revierte.
    expect(document.activeElement).toBe(now);
    expect(useKuraStore.getState().orientPreviewId).toBe(now.dataset.candidate);
    expect(options().filter((o) => o.getAttribute('aria-selected') === 'true')).toEqual([now]);
    const pastAfter = useKuraStore.getState().past.length;
    fireEvent.keyDown(now, { key: 'Enter' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(useKuraStore.getState().past.length).toBe(pastAfter);
  });

  it('el botón Aplicar está deshabilitado con la actual y aplica la elegida', async () => {
    await seed([tPiece()], ['t']);
    render(<RightInspector />);
    await screen.findByTestId('orient-options');
    const apply = screen.getByTestId('orient-apply') as HTMLButtonElement;
    expect(apply.disabled).toBe(false);
    const current = options().find((o) => within(o).queryByTestId('orient-badge-current'))!;
    fireEvent.click(current);
    expect(apply.disabled).toBe(true);
    expect(screen.getAllByText('Elige una orientación distinta de la actual para aplicarla.').length).toBeGreaterThan(0);
    fireEvent.click(options()[0]);
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);
    await waitFor(() => expect(useKuraStore.getState().past.length).toBe(1));
  });

  it('Esc vuelve al resumen y limpia la vista previa', async () => {
    await seed([tPiece()], ['t']);
    render(<RightInspector />);
    await screen.findByTestId('orient-options');
    expect(useKuraStore.getState().operationPreview.key).toBe('orient');
    fireEvent.keyDown(options()[0], { key: 'Escape' });
    expect(useKuraStore.getState().activeAction).toBeNull();
    expect(useKuraStore.getState().operationPreview.key).toBeNull();
    expect(useKuraStore.getState().orient).toBeNull();
  });

  it('el ángulo de voladizo recalcula con Enter y rechaza valores fuera de 30°–70°', async () => {
    await seed([tPiece()], ['t']);
    render(<RightInspector />);
    await screen.findByTestId('orient-options');
    const input = screen.getByRole('textbox', { name: 'Ángulo de voladizo (°)' }) as HTMLInputElement;
    expect(input.value).toBe('45');
    fireEvent.change(input, { target: { value: '90' } });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toContain('entre 30° y 70°');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useKuraStore.getState().orient?.analysis.overhangAngleDeg).toBe(45);
    fireEvent.change(input, { target: { value: '60' } });
    expect(input.getAttribute('aria-invalid')).toBe('false');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(useKuraStore.getState().orient?.analysis.overhangAngleDeg).toBe(60));
    expect(parseOrientAngle('55,5')).toBe(55.5);
    expect(parseOrientAngle('29')).toBeNull();
    expect(parseOrientAngle('')).toBeNull();
  });

  it('en inglés usa los textos y el formato numérico del idioma', async () => {
    await seed([tPiece()], ['t'], 'en');
    render(<RightInspector />);
    await screen.findByTestId('orient-options');
    expect(screen.getByRole('heading', { name: 'Orient for printing' })).toBeTruthy();
    expect(options()[0].textContent).toMatch(/less support than now/);
    expect(screen.getByTestId('orient-apply').textContent).toContain('Apply orientation');
  });
});

describe('Orientar para imprimir: entrada', () => {
  const state = (objects: SceneObject[], selectedIds: string[]) => ({ objects, selectedIds, groups: [], busyOperation: null });

  it('necesita un sólido seleccionado y, si no, dice por qué', () => {
    const solid = tPiece();
    expect(actionAvailability(state([solid], ['t']), 'orient')).toEqual({ enabled: true });
    expect(actionAvailability(state([solid], []), 'orient').reason).toBe('rediseno.reason.noSelection');
    expect(actionAvailability(state([solid, { ...solid, id: 'u' }], ['t', 'u']), 'orient').reason).toBe('orient.ui.reason.needOne');
    expect(actionAvailability(state([{ ...solid, role: 'negative' }], ['t']), 'orient').reason).toBe('orient.ui.reason.notSolid');
    expect(actionAvailability(state([{ ...solid, locked: true }], ['t']), 'orient').reason).toBe('rediseno.reason.locked');
  });

  it('la paleta de comandos ofrece «Orientar para imprimir…» y busca por sinónimos', () => {
    const items = actionPaletteItems('es', state([tPiece()], ['t']), []);
    const item = items.find((i) => i.label === 'Orientar para imprimir…')!;
    expect(item).toBeTruthy();
    expect(item.keywords).toContain('voladizo');
    expect(item.unavailable).toBeUndefined();
  });
});
