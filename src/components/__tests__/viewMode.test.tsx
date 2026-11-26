/**
 * @file src/components/__tests__/viewMode.test.tsx
 * @description Interfaz de los modos de vista (P4): el selector solo aparece cuando hay algo que alternar, es un
 * radiogroup navegable con flechas, cambia `layout` sin sumar pasos de deshacer y, si el store lo rechaza, no cambia y
 * un aviso dice por qué; el rótulo y la separación visual solo existen fuera de Imprimir y no tocan la escena; el pie
 * del visor y la tira de placas cambian según el modo; las acciones de cama salen deshabilitadas con su motivo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { actionAvailability } from '../../store/actionsCatalog';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { PlateStrip } from '../plates/PlateStrip';
import { ViewModeHud } from '../viewmode/ViewModeHud';
import { ViewModeSelector } from '../viewmode/ViewModeSelector';
import { ViewportHudBottom } from '../viewport/ViewportHudBottom';

const PLATES: ScenePlate[] = [
  { id: 'p1', name: 'Placa 1', origin: [0, 0] },
  { id: 'p2', name: 'Placa 2', origin: [300, 0] },
];

function piece(id: string, position: [number, number, number], extra: Partial<SceneObject> = {}): SceneObject {
  return { ...fakeBox(id, id), position, ...extra } as SceneObject;
}

function seed(over: Record<string, unknown> = {}, objects: SceneObject[] = [piece('a', [0, 0, 0]), piece('b', [100, 0, 0])]) {
  useKuraStore.setState({
    language: 'es', objects, plates: [], activePlateId: null, selectedIds: [], groups: [], past: [], future: [], toasts: [],
    busyOperation: null, layout: 'print', freeView: false, figureExplode: null, plateSolo: false, showBed: true,
    ...over,
  } as never);
}

const store = () => useKuraStore.getState();

beforeEach(() => seed());
afterEach(() => cleanup());

describe('selector Imprimir / Armado / Libre', () => {
  it('no ensucia la barra con un proyecto simple de una placa', () => {
    const { container } = render(<ViewModeSelector />);
    expect(container.firstChild).toBeNull();
  });

  it('con dos placas es un radiogroup con tres opciones y Imprimir marcada', () => {
    seed({ plates: PLATES });
    render(<ViewModeSelector />);
    const group = screen.getByRole('radiogroup', { name: 'Modo de vista' });
    const radios = screen.getAllByRole('radio');
    expect(group).toBeTruthy();
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual(['Imprimir', 'Armado', 'Libre']);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    // Un solo tabulador (roving tabindex) y tooltip en cada opción.
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    for (const r of radios) expect(r.getAttribute('title')).toBeTruthy();
  });

  it('un clic cambia la disposición sin sumar pasos de deshacer', () => {
    seed({ plates: PLATES });
    render(<ViewModeSelector />);
    fireEvent.click(screen.getByTestId('viewmode-assembly'));
    expect(store().layout).toBe('assembly');
    expect(screen.getByTestId('viewmode-assembly').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId('viewmode-free'));
    expect(store().freeView).toBe(true);
    expect(store().layout).toBe('assembly');
    expect(store().past.length).toBe(0);
  });

  it('las flechas mueven y eligen; Inicio y Fin saltan a los extremos', () => {
    seed({ plates: PLATES });
    render(<ViewModeSelector />);
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(store().layout).toBe('assembly');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(store().freeView).toBe(true);
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(store().layout).toBe('print');
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(store().freeView).toBe(true);
    fireEvent.keyDown(group, { key: 'Home' });
    expect(store().layout).toBe('print');
  });

  it('si el store lo rechaza no cambia y un aviso dice por qué', () => {
    seed({ plates: PLATES, busyOperation: 'repair' });
    render(<ViewModeSelector />);
    fireEvent.click(screen.getByTestId('viewmode-assembly'));
    expect(store().layout).toBe('print');
    expect(screen.getByTestId('viewmode-print').getAttribute('aria-checked')).toBe('true');
    expect(store().toasts.map((x) => x.text)).toContain(t('es', 'viewMode.blocked.busy'));
  });

  it('estando en Armado se ofrece aunque el proyecto sea simple (para poder volver)', () => {
    seed({ layout: 'assembly' });
    render(<ViewModeSelector />);
    expect(screen.getByTestId('viewmode-assembly').getAttribute('aria-checked')).toBe('true');
  });
});

describe('rótulo y separación visual', () => {
  it('en Imprimir no dibuja nada', () => {
    const { container } = render(<ViewModeHud />);
    expect(container.firstChild).toBeNull();
  });

  it('en Armado dice la vista, que mover aquí no mueve la pieza de su placa y permite volver', () => {
    seed({ layout: 'assembly' });
    render(<ViewModeHud />);
    expect(screen.getByTestId('viewmode-badge').textContent).toContain('Vista armada');
    expect(screen.getByTestId('viewmode-badge').textContent).toContain('no cambia su lugar en la placa');
    fireEvent.click(screen.getByTestId('viewmode-back'));
    expect(store().layout).toBe('print');
  });

  it('en Libre el rótulo dice «Vista libre»', () => {
    seed({ layout: 'assembly', freeView: true });
    render(<ViewModeHud />);
    expect(screen.getByTestId('viewmode-badge').textContent).toContain('Vista libre');
  });

  it('el deslizador separa solo en el dibujo: no toca objetos ni historial', () => {
    seed({ layout: 'assembly' });
    const objects = store().objects;
    render(<ViewModeHud />);
    const slider = screen.getByTestId('viewmode-explode') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '40' } });
    expect(store().figureExplode).toMatchObject({ scope: 'all', factor: 0.4 });
    expect(store().objects).toBe(objects);
    expect(store().past.length).toBe(0);
    expect(slider.getAttribute('aria-valuetext')).toBe('40 % separado');
    fireEvent.click(screen.getByTestId('viewmode-explode-reset'));
    expect(store().figureExplode).toBeNull();
  });

  it('con un grupo seleccionado se puede separar solo ese grupo; sin grupo, solo toda la figura', () => {
    const group = { id: 'g1', name: 'Grupo' };
    seed(
      { layout: 'assembly', groups: [group], selectedIds: ['a'] },
      [piece('a', [0, 0, 0], { groupRef: 'g1' }), piece('b', [50, 0, 0], { groupRef: 'g1' }), piece('c', [100, 0, 0])],
    );
    render(<ViewModeHud />);
    const scope = screen.getByTestId('viewmode-scope') as HTMLSelectElement;
    fireEvent.change(scope, { target: { value: 'group' } });
    fireEvent.change(screen.getByTestId('viewmode-explode'), { target: { value: '50' } });
    expect(store().figureExplode).toMatchObject({ scope: 'group', groupKey: 'g:g1', factor: 0.5 });
    act(() => useKuraStore.setState({ selectedIds: ['c'] } as never));
    const groupOption = screen.getByRole('option', { name: 'Grupo seleccionado' }) as HTMLOptionElement;
    expect(groupOption.disabled).toBe(true);
  });
});

describe('pie del visor y tira de placas según el modo', () => {
  it('Imprimir muestra la cama; Armado y Libre dicen que aquí no hay cama ni fuera de volumen', () => {
    const { rerender } = render(<ViewportHudBottom />);
    expect(screen.queryByTestId('viewmode-bed-chip')).toBeNull();
    expect(screen.getByText(/Cama/)).toBeTruthy();
    act(() => seed({ layout: 'assembly' }));
    rerender(<ViewportHudBottom />);
    expect(screen.getByTestId('viewmode-bed-chip').textContent).toBe('Sin cama en esta vista');
    expect(screen.queryByText(/Fuera de volumen/)).toBeNull();
    act(() => seed({ layout: 'assembly', freeView: true }));
    rerender(<ViewportHudBottom />);
    expect(screen.getByTestId('viewmode-bed-chip')).toBeTruthy();
  });

  it('la tira queda visible pero atenuada, con su nota, y no deja crear ni borrar placas', () => {
    seed({ plates: PLATES, activePlateId: 'p1' }, [piece('a', [0, 0, 0], { plateRef: 'p1' }), piece('b', [300, 0, 0], { plateRef: 'p2' })]);
    const { rerender } = render(<PlateStrip />);
    expect(screen.queryByTestId('plate-strip-note')).toBeNull();
    expect((screen.getByTestId('plate-add') as HTMLButtonElement).disabled).toBe(false);
    act(() => seed({ plates: PLATES, activePlateId: 'p1', layout: 'assembly' }, [piece('a', [0, 0, 0], { plateRef: 'p1' }), piece('b', [10, 0, 0], { plateRef: 'p2' })]));
    rerender(<PlateStrip />);
    expect(screen.getByTestId('plate-strip').getAttribute('data-view-mode')).toBe('armed');
    expect(screen.getByTestId('plate-strip-note').textContent).toContain('figura armada');
    expect((screen.getByTestId('plate-add') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('plate-delete') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('acciones de cama por modo', () => {
  const base = { objects: [piece('a', [0, 0, 0])], selectedIds: ['a'], groups: [], busyOperation: null };
  it('apoyar, centrar y ajustar a la impresora salen deshabilitadas en Armado y Libre con su motivo', () => {
    for (const id of ['dropToBed', 'centerOnBed', 'fitToBed'] as const) {
      expect(actionAvailability({ ...base, layout: 'print' }, id).enabled).toBe(true);
      for (const layout of ['assembly'] as const) {
        expect(actionAvailability({ ...base, layout }, id)).toEqual({ enabled: false, reason: 'viewMode.reason.printOnly' });
      }
    }
    expect(t('es', 'viewMode.reason.printOnly')).toBe('Disponible en la vista Imprimir');
  });

  it('las demás acciones no se ven afectadas', () => {
    expect(actionAvailability({ ...base, layout: 'assembly' }, 'hollow').enabled).toBe(true);
  });
});
