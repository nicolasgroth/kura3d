/**
 * @file src/components/__tests__/MagnetPanel.test.tsx
 * @description Panel «Alojamiento de imán»: no abre sin pieza sólida (y dice por qué), valores por defecto y resumen
 * del hueco, cambiar a cuadrado o rectangular (tres medidas y giro), preajustes incluidos, guardar y eliminar uno propio, campo fuera de rango que
 * bloquea la colocación, exclusión con Texto 3D y el punto/normal calculados desde un evento del visor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAGNET_DEFAULTS } from '../../core/addons/magnetPocket';
import { t } from '../../i18n';
import { setText3DPanelOpen, startPanelExclusion, useText3DPanel } from '../../store/insertCatalog';
import { closeMagnetPanel, openMagnetPanel, placeMagnetAt, setMagnetParams, useMagnetPanel, useMagnetPresets } from '../../store/magnetPanel';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { MagnetPanel } from '../magnet/MagnetPanel';
import { magnetHitFromEvent } from '../viewport/useMagnetPlacement';

const store = () => useKuraStore.getState();

beforeEach(() => {
  localStorage.clear();
  useMagnetPresets.getState().reload();
  closeMagnetPanel();
  setMagnetParams({ ...MAGNET_DEFAULTS });
  setText3DPanelOpen(false);
  useKuraStore.setState({ objects: [fakeBox('b1', 'Caja', 20)], toasts: [] });
});

describe('panel del alojamiento de imán', () => {
  it('sin pieza sólida no abre y dice por qué', () => {
    useKuraStore.setState({ objects: [] });
    expect(openMagnetPanel()).toBe(false);
    expect(useMagnetPanel.getState().open).toBe(false);
    expect(store().toasts.some((x) => x.text === t('es', 'magnet.needSolid'))).toBe(true);
  });

  it('abre con 5 × 2 por defecto (hueco Ø 5,2 × 2,2) y cambia a cuadrado', async () => {
    const user = userEvent.setup();
    render(<MagnetPanel />);
    act(() => void openMagnetPanel());
    expect(screen.getByTestId('magnet-summary').textContent).toBe('Hueco: Ø 5,2 × 2,2 mm');
    expect((screen.getByTestId('magnet-preset') as HTMLSelectElement).value).toBe('builtin:round-5x2');
    await user.click(screen.getByTestId('magnet-shape-square'));
    expect(screen.getByTestId('magnet-summary').textContent).toBe('Hueco: 5,2 × 5,2 × 2,2 mm');
    expect(screen.getByLabelText(t('es', 'magnet.side'))).toBeTruthy();
    await user.selectOptions(screen.getByTestId('magnet-preset'), 'builtin:round-8x3');
    expect(useMagnetPanel.getState().params).toMatchObject({ shape: 'round', sizeMm: 8, heightMm: 3 });
  });

  it('rectangular: tres medidas, giro de 90° y preajuste incluido 10 × 5 × 2; al volver a redondo no hereda el ancho', async () => {
    const user = userEvent.setup();
    render(<MagnetPanel />);
    act(() => void openMagnetPanel());
    expect(screen.queryByTestId('magnet-turn90')).toBeNull();
    await user.click(screen.getByTestId('magnet-shape-rect'));
    expect(screen.getByLabelText(t('es', 'magnet.length'))).toBeTruthy();
    expect(screen.getByLabelText(t('es', 'magnet.width'))).toBeTruthy();
    expect(screen.getByLabelText(t('es', 'magnet.height'))).toBeTruthy();
    expect(useMagnetPanel.getState().params).toMatchObject({ shape: 'rect', sizeMm: 5, widthMm: 2.5 });
    expect(screen.getByTestId('magnet-summary').textContent).toBe('Hueco: 5,2 × 2,7 × 2,2 mm');
    await user.click(screen.getByTestId('magnet-turn90'));
    expect(useMagnetPanel.getState().params.turn90).toBe(true);
    await user.selectOptions(screen.getByTestId('magnet-preset'), 'builtin:rect-10x5x2');
    expect(useMagnetPanel.getState().params).toMatchObject({ shape: 'rect', sizeMm: 10, widthMm: 5, heightMm: 2 });
    expect(useMagnetPanel.getState().params.turn90).toBeUndefined();
    expect(screen.getByTestId('magnet-summary').textContent).toBe('Hueco: 10,2 × 5,2 × 2,2 mm');
    await user.selectOptions(screen.getByTestId('magnet-preset'), 'builtin:round-5x2');
    expect(useMagnetPanel.getState().params.widthMm).toBeUndefined();
  });

  it('guarda un preajuste propio con nombre y lo elimina', async () => {
    const user = userEvent.setup();
    render(<MagnetPanel />);
    act(() => {
      openMagnetPanel();
      setMagnetParams({ sizeMm: 12, heightMm: 4 });
    });
    expect((screen.getByTestId('magnet-preset') as HTMLSelectElement).value).toBe('');
    await user.click(screen.getByTestId('magnet-preset-save'));
    expect(screen.getByRole('alert').textContent).toBe(t('es', 'magnet.preset.nameInvalid'));
    await user.type(screen.getByTestId('magnet-preset-name'), 'Tapa 12');
    await user.click(screen.getByTestId('magnet-preset-save'));
    const [mine] = useMagnetPresets.getState().presets;
    expect(mine).toMatchObject({ name: 'Tapa 12', values: { sizeMm: 12, heightMm: 4 } });
    expect((screen.getByTestId('magnet-preset') as HTMLSelectElement).value).toBe(mine.id);
    await user.click(screen.getByTestId('magnet-preset-delete'));
    expect(useMagnetPresets.getState().presets).toEqual([]);
    expect(store().toasts.some((x) => x.text === t('es', 'magnet.preset.deleted', { name: 'Tapa 12' }))).toBe(true);
  });

  it('un campo fuera de rango bloquea la colocación y lo dice', async () => {
    const user = userEvent.setup();
    const add = vi.fn().mockResolvedValue(null);
    useKuraStore.setState({ addMagnetPocket: add } as never);
    render(<MagnetPanel />);
    act(() => void openMagnetPanel());
    const clearance = screen.getByLabelText(t('es', 'magnet.clearance'));
    await user.clear(clearance);
    await user.type(clearance, '0,9');
    await user.tab();
    await waitFor(() => expect(useMagnetPanel.getState().blocked).toBe(true));
    expect(screen.getByTestId('magnet-hint').textContent).toBe(t('es', 'magnet.invalid'));
    expect(await placeMagnetAt('b1', [0, 20, 0], [0, 1, 0])).toBe(false);
    expect(add).not.toHaveBeenCalled();
    await user.clear(clearance);
    await user.type(clearance, '0,3');
    await user.tab();
    await waitFor(() => expect(useMagnetPanel.getState().blocked).toBe(false));
    expect(useMagnetPanel.getState().params.clearanceMm).toBeCloseTo(0.3, 9);
  });

  it('abrir el imán cierra Texto 3D y viceversa', () => {
    const off = startPanelExclusion();
    act(() => setText3DPanelOpen(true));
    act(() => void openMagnetPanel());
    expect(useText3DPanel.getState().open).toBe(false);
    act(() => setText3DPanelOpen(true));
    expect(useMagnetPanel.getState().open).toBe(false);
    off();
  });
});

describe('cara bajo el cursor', () => {
  it('punto exacto sobre la cara y normal de mundo hacia la cámara en pieza rotada', () => {
    // Triángulo en el plano y = 10 local, pieza girada 90° en X: la cara queda en z = −10... mirando a −Z o +Z.
    const tri = { positions: new Float32Array([0, 10, 0, 0, 10, 5, 5, 10, 0]), indices: new Uint32Array([0, 1, 2]) };
    const obj = { ...fakeBox('t', 'T', 10), mesh: tri, position: [0, 0, 0] as [number, number, number], rotation: [Math.PI / 2, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] };
    const ray = new THREE.Ray(new THREE.Vector3(1, -1, 50), new THREE.Vector3(0, 0, -1));
    const hit = magnetHitFromEvent(obj, { faceIndex: 0, ray, point: new THREE.Vector3(1, -1, 10.03) } as never)!;
    expect(hit.point[2]).toBeCloseTo(10, 6);
    // La normal mira a la cámara (contraria al rayo).
    expect(hit.normal[2]).toBeCloseTo(1, 6);
  });
});
