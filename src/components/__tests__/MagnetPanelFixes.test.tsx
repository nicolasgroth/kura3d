// @vitest-environment jsdom
/**
 * @file src/components/__tests__/MagnetPanelFixes.test.tsx
 * @description Correcciones del panel «Alojamiento de imán»: cursor que no queda pegado, vista previa desde la
 * primitiva real, escritura del hover sin repetidos, resumen inválido, nombre de las flechas, eliminar con foco y
 * Deshacer, sincronía entre pestañas, mensaje propio de valores inválidos, franja de la hoja plegada, clic contra
 * arrastre y contraste del texto de error en tema oscuro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAGNET_DEFAULTS, POCKET_SEGMENTS, placePocket } from '../../core/addons/magnetPocket';
import { MAGNET_PRESET_KIND, MAGNET_PRESET_STORAGE_KEY } from '../../core/addons/magnetPresets';
import { t } from '../../i18n';
import {
  closeMagnetPanel, flushMagnetHover, openMagnetPanel, setMagnetHover, setMagnetParams, useMagnetPanel, useMagnetPresets,
} from '../../store/magnetPanel';
import { createUserPresetsStore } from '../../store/userPresets';
import { useKuraStore } from '../../store/useKuraStore';
import { contrastRatio } from '../../utils/contrast';
import { fakeBox } from '../../test/fakeObjects';
import { MagnetPanel } from '../magnet/MagnetPanel';
import { useMagnetCursor } from '../viewport/magnetCursor';
import { pocketGhostGeometry } from '../viewport/pocketGhostGeometry';
import { MAGNET_CLICK_SLOP_PX, useMagnetPlacement } from '../viewport/useMagnetPlacement';

const store = () => useKuraStore.getState();

beforeEach(() => {
  localStorage.clear();
  useMagnetPresets.getState().reload();
  closeMagnetPanel();
  setMagnetParams({ ...MAGNET_DEFAULTS });
  useKuraStore.setState({ objects: [fakeBox('b1', 'Caja', 20)], toasts: [], toastHistory: [] });
});

afterEach(() => {
  flushMagnetHover();
  closeMagnetPanel();
});

describe('cursor de la capa', () => {
  it('se quita al desmontar la capa aunque el puntero siga encima', () => {
    const canvas = document.createElement('canvas');
    const { result, unmount } = renderHook(() => useMagnetCursor());
    act(() => result.current.onPointerOver({ nativeEvent: { target: canvas } } as never));
    expect(canvas.style.cursor).toBe('crosshair');
    unmount();
    expect(canvas.style.cursor).toBe('');
  });
});

describe('vista previa del hueco', () => {
  it('usa la primitiva real: mismos lados y mismas medidas que el negativo', () => {
    const round = placePocket(MAGNET_DEFAULTS, [0, 0, 0], [0, 1, 0])!;
    const g = pocketGhostGeometry(round.primitive) as THREE.CylinderGeometry;
    expect(g.parameters.radialSegments).toBe(POCKET_SEGMENTS);
    expect(g.parameters.radiusTop).toBeCloseTo(round.primitive.params.radius as number, 9);
    expect(g.parameters.height).toBeCloseTo(round.dims.lengthMm, 9);
    const square = placePocket({ ...MAGNET_DEFAULTS, shape: 'square' }, [0, 0, 0], [0, 1, 0])!;
    const b = pocketGhostGeometry(square.primitive) as THREE.BoxGeometry;
    expect(b.parameters.width).toBeCloseTo(square.primitive.params.width as number, 9);
    expect(b.parameters.depth).toBeCloseTo(square.primitive.params.depth as number, 9);
  });
});

describe('hover sin escrituras repetidas', () => {
  const hit = (x: number) => ({ hostId: 'b1', point: [x, 1, 0] as [number, number, number], normal: [0, 1, 0] as [number, number, number] });

  it('no escribe si punto y normal no cambian (con tolerancia)', () => {
    setMagnetHover(hit(0));
    flushMagnetHover();
    let writes = 0;
    const off = useMagnetPanel.subscribe(() => { writes += 1; });
    setMagnetHover(hit(0));
    setMagnetHover(hit(0.00001));
    flushMagnetHover();
    off();
    expect(writes).toBe(0);
  });

  it('agrupa los movimientos de un cuadro en una sola escritura con el último valor', async () => {
    let writes = 0;
    const off = useMagnetPanel.subscribe(() => { writes += 1; });
    setMagnetHover(hit(1));
    setMagnetHover(hit(2));
    setMagnetHover(hit(3));
    expect(writes).toBe(0);
    await waitFor(() => expect(useMagnetPanel.getState().hover?.point[0]).toBe(3));
    off();
    expect(writes).toBe(1);
  });

  it('salir de la pieza (null) se aplica de inmediato y descarta lo pendiente', () => {
    setMagnetHover(hit(1));
    flushMagnetHover();
    setMagnetHover(hit(2));
    setMagnetHover(null);
    expect(useMagnetPanel.getState().hover).toBeNull();
    flushMagnetHover();
    expect(useMagnetPanel.getState().hover).toBeNull();
  });
});

describe('campos del panel', () => {
  it('el resumen dice que es inválido mientras haya un campo con error', async () => {
    const user = userEvent.setup();
    render(<MagnetPanel />);
    act(() => void openMagnetPanel());
    const clearance = screen.getByLabelText(t('es', 'magnet.clearance'));
    await user.clear(clearance);
    await user.type(clearance, '0,9');
    await user.tab();
    await waitFor(() => expect(screen.getByTestId('magnet-summary').textContent).toBe(t('es', 'magnet.summaryInvalid')));
    await user.clear(clearance);
    await user.type(clearance, '0,3');
    await user.tab();
    await waitFor(() => expect(screen.getByTestId('magnet-summary').textContent).toMatch(/^Hueco: Ø/));
  });

  it('las flechas llevan el nombre de su campo', () => {
    render(<MagnetPanel />);
    act(() => void openMagnetPanel());
    expect(screen.getByLabelText(t('es', 'precision.stepUpFor', { label: t('es', 'magnet.diameter') }))).toBeTruthy();
    expect(screen.getByLabelText(t('es', 'precision.stepDownFor', { label: t('es', 'magnet.height') }))).toBeTruthy();
    expect(screen.queryAllByLabelText(t('es', 'precision.stepUp'))).toHaveLength(0);
  });

  it('recuerda las medidas al cerrar y reabrir', () => {
    act(() => void openMagnetPanel());
    act(() => setMagnetParams({ sizeMm: 8, heightMm: 3 }));
    act(() => closeMagnetPanel());
    act(() => void openMagnetPanel());
    expect(useMagnetPanel.getState().params).toMatchObject({ sizeMm: 8, heightMm: 3 });
  });
});

describe('eliminar un preajuste propio', () => {
  it('si el almacenamiento falla al borrar, avisa y el preajuste sigue', async () => {
    const user = userEvent.setup();
    render(<MagnetPanel />);
    act(() => {
      openMagnetPanel();
      setMagnetParams({ sizeMm: 12, heightMm: 4 });
    });
    await user.type(screen.getByTestId('magnet-preset-name'), 'Tapa 12');
    await user.click(screen.getByTestId('magnet-preset-save'));
    // Al borrar el último, el almacenamiento se vacía con removeItem.
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('bloqueado'); });
    try {
      await user.click(screen.getByTestId('magnet-preset-delete'));
    } finally {
      spy.mockRestore();
    }
    expect(useMagnetPresets.getState().presets).toHaveLength(1);
    expect(store().toasts.some((x) => x.text === t('es', 'magnet.preset.storageFailed') && x.kind === 'error')).toBe(true);
  });

  it('devuelve el foco al selector y ofrece Deshacer', async () => {
    const user = userEvent.setup();
    render(<MagnetPanel />);
    act(() => {
      openMagnetPanel();
      setMagnetParams({ sizeMm: 12, heightMm: 4 });
    });
    await user.type(screen.getByTestId('magnet-preset-name'), 'Tapa 12');
    await user.click(screen.getByTestId('magnet-preset-save'));
    const [mine] = useMagnetPresets.getState().presets;
    await user.click(screen.getByTestId('magnet-preset-delete'));
    expect(document.activeElement).toBe(screen.getByTestId('magnet-preset'));
    const toast = store().toasts.find((x) => x.text === t('es', 'magnet.preset.deleted', { name: 'Tapa 12' }));
    expect(toast?.action?.label).toBe(t('es', 'topbar.undo'));
    act(() => toast?.action?.run());
    expect(useMagnetPresets.getState().presets).toEqual([mine]);
  });
});

describe('preajustes entre pestañas y mensajes', () => {
  it('watch recarga con el evento storage de su clave y se limpia', () => {
    const own = createUserPresetsStore(MAGNET_PRESET_KIND);
    const stop = own.getState().watch();
    const saved = { id: 'user-abc', name: 'Otra pestaña', values: { ...MAGNET_DEFAULTS, sizeMm: 9 } };
    localStorage.setItem(MAGNET_PRESET_STORAGE_KEY, JSON.stringify([saved]));
    window.dispatchEvent(new StorageEvent('storage', { key: 'otra-clave' }));
    expect(own.getState().presets).toEqual([]);
    window.dispatchEvent(new StorageEvent('storage', { key: MAGNET_PRESET_STORAGE_KEY }));
    expect(own.getState().presets.map((p) => p.name)).toEqual(['Otra pestaña']);
    stop();
    localStorage.setItem(MAGNET_PRESET_STORAGE_KEY, '[]');
    window.dispatchEvent(new StorageEvent('storage', { key: MAGNET_PRESET_STORAGE_KEY }));
    expect(own.getState().presets).toHaveLength(1);
  });

  it('guardar con valores inválidos usa un mensaje propio, no el de campos con {max}', async () => {
    const user = userEvent.setup();
    render(<MagnetPanel />);
    act(() => {
      openMagnetPanel();
      setMagnetParams({ sizeMm: Number.NaN });
    });
    await user.type(screen.getByTestId('magnet-preset-name'), 'Rota');
    await user.click(screen.getByTestId('magnet-preset-save'));
    expect(screen.getByRole('alert').textContent).toBe(t('es', 'magnet.preset.valuesInvalid'));
  });
});

describe('franja de la hoja plegada', () => {
  it('muestra el último aviso y un Volver que cierra el panel', async () => {
    const user = userEvent.setup();
    render(<MagnetPanel />);
    act(() => void openMagnetPanel());
    act(() => store().addToast('Hueco colocado', 'success'));
    expect(screen.getByTestId('magnet-fold-text').textContent).toBe('Hueco colocado');
    await user.click(screen.getByTestId('magnet-fold-done'));
    expect(useMagnetPanel.getState().open).toBe(false);
  });
});

describe('clic contra arrastre', () => {
  const tri = { positions: new Float32Array([0, 10, 0, 0, 10, 5, 5, 10, 0]), indices: new Uint32Array([0, 1, 2]) };
  const host = () => ({ ...fakeBox('b1', 'Caja', 10), mesh: tri });
  const event = (delta: number) => ({
    stopPropagation: () => undefined,
    button: 0,
    delta,
    faceIndex: 0,
    ray: new THREE.Ray(new THREE.Vector3(1, 50, 1), new THREE.Vector3(0, -1, 0)),
    point: new THREE.Vector3(1, 10, 1),
  });

  it('coloca con un movimiento dentro del umbral y no con uno mayor', async () => {
    const add = vi.fn().mockResolvedValue(null);
    useKuraStore.setState({ addMagnetPocket: add } as never);
    const { result } = renderHook(() => useMagnetPlacement(host()));
    result.current.onClick(event(MAGNET_CLICK_SLOP_PX + 1) as never);
    await Promise.resolve();
    expect(add).not.toHaveBeenCalled();
    result.current.onClick(event(MAGNET_CLICK_SLOP_PX) as never);
    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
  });
});

describe('contraste del texto de error', () => {
  it('no fija un rojo propio: usa el acento rojo del tema, que cumple AA en oscuro', () => {
    const fs = (globalThis as unknown as { process: { cwd: () => string; getBuiltinModule: (id: string) => { readFileSync: (p: string, e: 'utf8') => string } } }).process;
    const read = (name: string) => fs.getBuiltinModule('node:fs').readFileSync(`${fs.cwd()}/src/styles/${name}`, 'utf8');
    const precision = read('precisionInput.css');
    const tokens = read('studio-tokens.css');
    expect(precision).not.toMatch(/#b91c1c/i);
    expect(precision).toMatch(/color: var\(--danger-text, var\(--accent-red\)\)/);
    const hex = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens)![1];
    expect(contrastRatio(hex('accent-red-dark'), hex('bg-elevated-dark'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hex('accent-red-light'), hex('bg-elevated-light'))).toBeGreaterThanOrEqual(4.5);
  });
});
