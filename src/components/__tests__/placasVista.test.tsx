/**
 * @file src/components/__tests__/placasVista.test.tsx
 * @description Interfaz de placas (P2): la tira aparece desde la segunda placa (una ficha por placa con nombre,
 * piezas y estado con texto, la activa con `aria-pressed`, renombrar con F2 o doble clic, flechas entre fichas,
 * «Solo esta», borrar con confirmación que dice a qué placa pasan), el botón «+ Placa» solo con menos de dos placas,
 * el aviso de fuera de volumen por placa y «Mover a placa» en el menú contextual y la paleta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionPaletteItems } from '../actionPaletteItems';
import { moveToPlateName } from '../../store/actionLabels';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { ConfirmDialogHost } from '../ConfirmDialogHost';
import { PlateStrip } from '../plates/PlateStrip';
import { ViewportHudBottom } from '../viewport/ViewportHudBottom';
import { ObjectContextMenu } from '../viewport/ObjectContextMenu';
import { AddFirstPlateButton } from '../plates/AddFirstPlateButton';

const PLATES: ScenePlate[] = [
  { id: 'p1', name: 'Placa 1', origin: [0, 0] },
  { id: 'p2', name: 'Placa 2', origin: [300, 0] },
  { id: 'p3', name: 'Placa 3', origin: [600, 0] },
];

/** Cubo con malla real (para que el estado de volumen se pueda medir). */
function solid(id: string, name: string, position: [number, number, number], plateRef?: string): SceneObject {
  const h = 10;
  const positions = new Float32Array([-h, 0, -h, h, 0, -h, h, 0, h, -h, 0, h, -h, 20, -h, h, 20, -h, h, 20, h, -h, 20, h]);
  return { ...fakeBox(id, name), position, mesh: { positions, indices: new Uint32Array([0, 1, 2, 0, 2, 3]) }, ...(plateRef ? { plateRef } : {}) } as SceneObject;
}

function seed(plates: ScenePlate[], objects: SceneObject[], activePlateId: string | null = plates[0]?.id ?? null) {
  useKuraStore.setState({
    language: 'es', plates, objects, activePlateId, selectedIds: [], plateSolo: false, past: [], future: [], busyOperation: null, layout: 'print',
    printerProfile: { ...useKuraStore.getState().printerProfile, showPrintVolume: true, bedWidthMm: 200, bedDepthMm: 200, maxHeightMm: 200 },
    customBedDimensions: null, groups: [], toasts: [],
  } as never);
}

beforeEach(() => seed([], []));
afterEach(() => cleanup());

describe('tira de placas', () => {
  it('no existe con una placa o ninguna', () => {
    const { container, rerender } = render(<PlateStrip />);
    expect(container.firstChild).toBeNull();
    act(() => seed([PLATES[0]], [solid('a', 'A', [0, 0, 0], 'p1')]));
    rerender(<PlateStrip />);
    expect(screen.queryByTestId('plate-strip')).toBeNull();
  });

  it('una ficha por placa con nombre, piezas y estado con texto; la activa va con aria-pressed', () => {
    seed(PLATES, [solid('a', 'A', [0, 0, 0], 'p1'), solid('b', 'B', [600, 0, 0], 'p3'), solid('c', 'C', [900, 0, 0], 'p3')], 'p3');
    render(<PlateStrip />);
    const strip = screen.getByRole('region', { name: 'Placas de impresión' });
    const chips = within(strip).getAllByRole('button', { pressed: undefined }).filter((b) => b.classList.contains('kura-plate-chip-main'));
    expect(chips.map((c) => c.getAttribute('aria-label'))).toEqual([
      'Placa 1: 1 pieza, Bien',
      'Placa 2: 0 piezas, Vacía',
      'Placa 3: 2 piezas, Fuera de volumen',
    ]);
    expect(chips.map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
    // El estado también se ve como texto (no depende del color).
    expect(within(chips[2]).getByText('Fuera de volumen')).toBeTruthy();
    expect(within(chips[1]).getByText('Vacía')).toBeTruthy();
  });

  it('pulsar una ficha la deja activa (sin paso de deshacer)', async () => {
    seed(PLATES, [solid('a', 'A', [0, 0, 0], 'p1')]);
    render(<PlateStrip />);
    await userEvent.setup().click(screen.getByRole('button', { name: /^Placa 2:/ }));
    expect(useKuraStore.getState().activePlateId).toBe('p2');
    expect(useKuraStore.getState().past).toHaveLength(0);
  });

  it('F2 renombra la placa (Enter confirma, un paso de deshacer; Escape cancela)', async () => {
    const user = userEvent.setup();
    seed(PLATES, [solid('a', 'A', [0, 0, 0], 'p1')]);
    render(<PlateStrip />);
    screen.getByRole('button', { name: /^Placa 2:/ }).focus();
    await user.keyboard('{F2}');
    const input = screen.getByRole('textbox', { name: 'Nombre de la placa' });
    await user.clear(input);
    await user.type(input, 'Cabeza{Enter}');
    expect(useKuraStore.getState().plates[1].name).toBe('Cabeza');
    expect(useKuraStore.getState().past).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole('button', { name: /^Cabeza:/ })).toBe(document.activeElement));

    fireEvent.doubleClick(screen.getByRole('button', { name: /^Cabeza:/ }));
    await user.keyboard('Otra{Escape}');
    expect(useKuraStore.getState().plates[1].name).toBe('Cabeza');
  });

  it('las flechas mueven el foco entre fichas', async () => {
    const user = userEvent.setup();
    seed(PLATES, []);
    render(<PlateStrip />);
    screen.getByRole('button', { name: /^Placa 1:/ }).focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Placa 2:/ }));
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Placa 3:/ }));
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Placa 1:/ }));
  });

  it('«+» crea una placa y «Solo esta» alterna la vista', async () => {
    const user = userEvent.setup();
    seed(PLATES, []);
    render(<PlateStrip />);
    await user.click(screen.getByTestId('plate-add'));
    expect(useKuraStore.getState().plates).toHaveLength(4);
    const solo = screen.getByRole('button', { name: /Solo esta/ });
    expect(solo.getAttribute('aria-pressed')).toBe('false');
    await user.click(solo);
    expect(useKuraStore.getState().plateSolo).toBe(true);
    expect(screen.getByRole('button', { name: /Solo esta/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('borrar una placa vacía no pregunta; con piezas confirma diciendo a qué placa pasan', async () => {
    const user = userEvent.setup();
    seed(PLATES, [solid('a', 'A', [300, 0, 0], 'p2')], 'p2');
    render(<><PlateStrip /><ConfirmDialogHost /></>);
    await user.click(screen.getByRole('button', { name: 'Borrar placa «Placa 2»' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('tiene 1 pieza');
    expect(dialog.textContent).toContain('«Placa 1»');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(useKuraStore.getState().plates).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Borrar placa «Placa 2»' }));
    await user.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Borrar placa' }));
    await waitFor(() => expect(useKuraStore.getState().plates.map((p) => p.id)).toEqual(['p1', 'p3']));
    expect(useKuraStore.getState().objects[0].plateRef).toBe('p1');
    expect(useKuraStore.getState().toasts.some((x) => x.text.includes('«Placa 1»'))).toBe(true);

    // Placa 3 está vacía: se borra directo.
    act(() => {
      useKuraStore.getState().setActivePlate('p3');
    });
    await user.click(screen.getByRole('button', { name: 'Borrar placa «Placa 3»' }));
    await waitFor(() => expect(useKuraStore.getState().plates).toHaveLength(1));
  });
});

describe('«+ Placa» y aviso por placa en el pie del visor', () => {
  it('el botón existe con una placa o ninguna y desaparece desde la segunda', () => {
    const { rerender } = render(<AddFirstPlateButton />);
    expect(screen.getByRole('button', { name: '+ Placa' })).toBeTruthy();
    act(() => seed([PLATES[0]], []));
    rerender(<AddFirstPlateButton />);
    expect(screen.getByRole('button', { name: '+ Placa' })).toBeTruthy();
    act(() => seed(PLATES, []));
    rerender(<AddFirstPlateButton />);
    expect(screen.queryByRole('button', { name: '+ Placa' })).toBeNull();
  });

  it('«+ Placa» crea la segunda placa (y la primera queda explícita)', async () => {
    seed([], [solid('a', 'A', [0, 0, 0])]);
    render(<AddFirstPlateButton />);
    await userEvent.setup().click(screen.getByRole('button', { name: '+ Placa' }));
    const { plates, objects } = useKuraStore.getState();
    expect(plates.map((p) => p.name)).toEqual(['Placa 1', 'Placa 2']);
    expect(objects[0].plateRef).toBe(plates[0].id);
  });

  it('el aviso de fuera de volumen dice en qué placa; sin placas no agrega nada', () => {
    seed([], [solid('a', 'A', [1000, 0, 0])]);
    const { rerender } = render(<ViewportHudBottom />);
    expect(screen.getByText('Fuera de volumen')).toBeTruthy();
    expect(screen.queryByTestId('oob-plates')).toBeNull();
    act(() => seed(PLATES, [solid('a', 'A', [0, 0, 0], 'p1'), solid('b', 'B', [300, 0, 0], 'p2'), solid('c', 'C', [400, 0, 0], 'p3')]));
    rerender(<ViewportHudBottom />);
    expect(screen.getByTestId('oob-plates').textContent).toBe('en Placa 3');
  });
});

describe('mover a placa', () => {
  const target = solid('a', 'Pieza A', [20, 0, 0], 'p1');
  const open = (plates: ScenePlate[]) => {
    seed(plates, [target, solid('b', 'Pieza B', [0, 0, 0], plates[0]?.id)]);
    useKuraStore.setState({ selectedIds: ['a'] });
    render(<div className="kura-viewport-wrap"><ObjectContextMenu menu={{ objectId: 'a', x: 10, y: 10 }} target={target} onClose={vi.fn()} /></div>);
  };
  const openPosition = async (user: ReturnType<typeof userEvent.setup>) => {
    const menu = screen.getAllByRole('menu')[0];
    const group = within(menu).getByRole('menuitem', { name: 'Posición y tipo' });
    group.focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(document.activeElement).not.toBe(group));
    return screen.findByRole('menu', { name: 'Posición y tipo' });
  };

  it('con una placa o ninguna el menú no trae «Mover a placa»', async () => {
    open([PLATES[0]]);
    const sub = await openPosition(userEvent.setup());
    expect(within(sub).queryByRole('menuitem', { name: moveToPlateName('es') })).toBeNull();
  });

  it('desde la segunda placa lista las placas (la actual apagada) y «Placa nueva»; mover es un paso', async () => {
    const user = userEvent.setup();
    open(PLATES);
    const sub = await openPosition(user);
    const trigger = within(sub).getByRole('menuitem', { name: 'Mover a placa' });
    trigger.focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(document.activeElement).not.toBe(trigger));
    const list = await screen.findByRole('menu', { name: trigger.textContent ?? '' });
    const items = within(list).getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Placa 1 (actual)', 'Placa 2', 'Placa 3', 'Placa nueva']);
    expect(items[0].getAttribute('aria-disabled') ?? (items[0] as HTMLButtonElement).disabled).toBeTruthy();
    await user.click(items[1]);
    const state = useKuraStore.getState();
    expect(state.objects.find((o) => o.id === 'a')!.plateRef).toBe('p2');
    expect(state.objects.find((o) => o.id === 'a')!.position[0]).toBe(320);
    expect(state.past).toHaveLength(1);
  });

  it('la paleta ofrece «Mover a placa: <placa>» con el mismo nombre, solo desde la segunda placa', () => {
    const state = { objects: [target], selectedIds: ['a'], groups: [], busyOperation: null };
    expect(actionPaletteItems('es', { ...state, plates: [PLATES[0]] }, []).some((i) => i.id.startsWith('action-moveToPlate'))).toBe(false);
    const items = actionPaletteItems('es', { ...state, plates: PLATES }, []).filter((i) => i.id.startsWith('action-moveToPlate'));
    expect(items.map((i) => i.label)).toEqual(['Mover a placa: Placa 1', 'Mover a placa: Placa 2', 'Mover a placa: Placa 3', 'Mover a placa: Placa nueva']);
    expect(items.every((i) => i.label.startsWith(moveToPlateName('es')))).toBe(true);
    expect(actionPaletteItems('es', { ...state, selectedIds: [], plates: PLATES }, []).find((i) => i.id === 'action-moveToPlate-p2')!.unavailable).toBeTruthy();
  });
});
