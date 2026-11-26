/**
 * @file src/components/__tests__/MeasurePanel.test.tsx
 * @description Herramienta Medir: flujo de dos clics con imán a esquinas (diagonal de cara de un cubo
 * de 40 = 56,57 mm), lista con borrar una y borrar todas, cambio de unidad, área de una cara
 * (1600 mm²) con suma por Mayús, Esc que cancela el punto en curso, y que nada toca la escena ni el
 * historial.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { faceNormal } from '../../engine/measure';
import { useMeasureStore, worldMeshCached } from '../../store/measureStore';
import { computeMeshStats } from '../../engine/primitives';
import { fakeBox } from '../../test/fakeObjects';
import { useKuraStore } from '../../store/useKuraStore';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { MeasurePanel } from '../measure/MeasurePanel';

/** Una cara de mundo con esa normal y una esquina cercana al punto dado. */
function faceWith(obj: SceneObject, n: Vec3): number {
  const mesh = worldMeshCached(obj);
  for (let f = 0; f < mesh.indices.length / 3; f++) {
    const fn = faceNormal(mesh, f);
    if (fn[0] * n[0] + fn[1] * n[1] + fn[2] * n[2] > 0.999) return f;
  }
  throw new Error('no face');
}

/** Esquinas de la caja de mundo del objeto. */
function corners(obj: SceneObject) {
  const p = worldMeshCached(obj).positions;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[i + k]); max[k] = Math.max(max[k], p[i + k]); }
  return { min, max };
}

const store = () => useKuraStore.getState();

/** Cubo de lado `s` apoyado en la cama (Y 0..s), sin WASM (jsdom). */
function cubeMesh(s: number): MeshData {
  const h = s / 2;
  const v = [[-h, 0, -h], [h, 0, -h], [h, s, -h], [-h, s, -h], [-h, 0, h], [h, 0, h], [h, s, h], [-h, s, h]].flat();
  const f = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2];
  return { positions: new Float32Array(v), indices: new Uint32Array(f) };
}

describe('MeasurePanel', () => {
  let cube: SceneObject;
  beforeEach(() => {
    const mesh = cubeMesh(40);
    cube = { ...fakeBox('cubo', 'Cubo', 40), mesh, stats: computeMeshStats(mesh) };
    useKuraStore.setState({ language: 'es', objects: [cube], selectedIds: [] } as never);
    useMeasureStore.getState().reset();
    useKuraStore.setState({ activeTool: 'measure', unitSystem: 'mm' } as never);
  });

  it('dos clics con imán dan la diagonal de la cara y no tocan escena ni historial', () => {
    const before = { objects: store().objects, past: store().past.length, future: store().future.length, saved: store().savedProject };
    render(<MeasurePanel />);
    expect(screen.getByText(t('es', 'measure.hint.distance0'))).toBeTruthy();
    const { min, max } = corners(cube);
    const top = faceWith(cube, [0, 1, 0]);
    const opts = { snapRadiusMm: 3, noSnap: false, additive: false };
    // Cerca (no exactamente) de dos esquinas opuestas de la cara superior.
    act(() => useMeasureStore.getState().pick(cube, [min[0] + 1, max[1], min[2] + 1], top, opts));
    expect(screen.getByText(t('es', 'measure.hint.distance1'))).toBeTruthy();
    act(() => useMeasureStore.getState().pick(cube, [max[0] - 1, max[1], max[2] - 1], top, opts));
    const list = screen.getByTestId('measure-list');
    expect(list.textContent).toContain('56,57 mm');
    // ΔX = 40, ΔY (fondo) = 40, ΔZ (altura) = 0 en ejes del usuario.
    expect(list.textContent).toContain('ΔX 40 mm');
    expect(list.textContent).toContain('ΔZ 0 mm');
    expect(store().objects).toBe(before.objects);
    expect(store().past.length).toBe(before.past);
    expect(store().future.length).toBe(before.future);
    expect(store().savedProject).toBe(before.saved);

    act(() => useKuraStore.setState({ unitSystem: 'cm' } as never));
    expect(screen.getByTestId('measure-list').textContent).toContain('5,66 cm');
  });

  it('sin puntos marcados un solo Esc sale de Medir; con puntos, el primero los limpia y el segundo sale', () => {
    render(<MeasurePanel />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(store().activeTool).toBe('select');

    useKuraStore.setState({ activeTool: 'measure' } as never);
    const top = faceWith(cube, [0, 1, 0]);
    const { min, max } = corners(cube);
    act(() => useMeasureStore.getState().pick(cube, [min[0], max[1], 0], top, { snapRadiusMm: 0, noSnap: true, additive: false }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useMeasureStore.getState().pending).toHaveLength(0);
    expect(store().activeTool).toBe('measure');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(store().activeTool).toBe('select');
  });

  it('Esc cancela el punto en curso; borrar una y borrar todas', () => {
    render(<MeasurePanel />);
    const top = faceWith(cube, [0, 1, 0]);
    const { min, max } = corners(cube);
    const opts = { snapRadiusMm: 0, noSnap: true, additive: false };
    act(() => useMeasureStore.getState().pick(cube, [min[0], max[1], 0], top, opts));
    expect(useMeasureStore.getState().pending).toHaveLength(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useMeasureStore.getState().pending).toHaveLength(0);

    for (let i = 0; i < 2; i++) {
      act(() => useMeasureStore.getState().pick(cube, [min[0], max[1], 0], top, opts));
      act(() => useMeasureStore.getState().pick(cube, [min[0] + 10 * (i + 1), max[1], 0], top, opts));
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: t('es', 'measure.remove', { label: `${t('es', 'measure.item.distance')} 10 mm` }) }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: t('es', 'measure.clearAll') }));
    expect(screen.queryByTestId('measure-list')).toBeNull();
  });

  it('área: una cara 1600 mm², Mayús+clic suma otra', () => {
    render(<MeasurePanel />);
    fireEvent.click(screen.getByRole('button', { name: t('es', 'measure.mode.area') }));
    const top = faceWith(cube, [0, 1, 0]);
    const side = faceWith(cube, [1, 0, 0]);
    act(() => useMeasureStore.getState().pick(cube, [0, 40, 0], top, { snapRadiusMm: 0, noSnap: false, additive: false }));
    expect(screen.getByTestId('measure-list').textContent).toContain('1.600 mm²');
    act(() => useMeasureStore.getState().pick(cube, [20, 20, 0], side, { snapRadiusMm: 0, noSnap: false, additive: true }));
    const text = screen.getByTestId('measure-list').textContent ?? '';
    expect(text).toContain('3.200 mm²');
    expect(text).toContain(t('es', 'measure.item.areaRegions', { n: 2 }));
  });

  it('ángulo por tres puntos y entre dos caras del cubo', () => {
    render(<MeasurePanel />);
    fireEvent.click(screen.getByRole('button', { name: t('es', 'measure.mode.angle') }));
    const top = faceWith(cube, [0, 1, 0]);
    const side = faceWith(cube, [1, 0, 0]);
    const o = { snapRadiusMm: 0, noSnap: true, additive: false };
    act(() => useMeasureStore.getState().pick(cube, [10, 40, 0], top, o));
    act(() => useMeasureStore.getState().pick(cube, [0, 40, 0], top, o));
    act(() => useMeasureStore.getState().pick(cube, [0, 40, -10], top, o));
    expect(screen.getByTestId('measure-list').textContent).toContain('90°');
    fireEvent.click(screen.getByRole('button', { name: t('es', 'measure.angle.faces') }));
    act(() => useMeasureStore.getState().pick(cube, [0, 40, 0], top, o));
    act(() => useMeasureStore.getState().pick(cube, [20, 20, 0], side, o));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByTestId('measure-list').textContent).toContain(`${t('es', 'measure.item.faceAngle')}: 90°`);
  });

  it('si su objeto se borra, la medición queda desactualizada (sin valor) y vuelve al deshacer', () => {
    render(<MeasurePanel />);
    const top = faceWith(cube, [0, 1, 0]);
    const o = { snapRadiusMm: 0, noSnap: true, additive: false };
    act(() => useMeasureStore.getState().pick(cube, [0, 40, 0], top, o));
    act(() => useMeasureStore.getState().pick(cube, [10, 40, 0], top, o));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByTestId('measure-list').textContent).toContain('10 mm');
    act(() => useKuraStore.setState({ objects: [] } as never));
    const row = screen.getByRole('listitem');
    expect(row.getAttribute('data-stale')).toBe('true');
    expect(row.textContent).toContain(t('es', 'measure.item.stale'));
    expect(row.textContent).not.toContain('10 mm');
    // Se puede borrar desde su fila.
    const label = t('es', 'measure.item.staleTitle', { title: t('es', 'measure.item.distance') });
    expect(screen.getByRole('button', { name: t('es', 'measure.remove', { label }) })).toBeTruthy();
    // Deshacer devuelve el objeto idéntico: la medición vuelve a ser válida.
    act(() => useKuraStore.setState({ objects: [cube] } as never));
    expect(screen.getByRole('listitem').getAttribute('data-stale')).toBeNull();
    expect(screen.getByTestId('measure-list').textContent).toContain('10 mm');
  });

  it('muestra los totales del objeto seleccionado (superficie y volumen en mL)', () => {
    act(() => store().selectObject(cube.id, false));
    render(<MeasurePanel />);
    const totals = screen.getByTestId('measure-object-totals').textContent ?? '';
    expect(totals).toContain('9.600 mm²');
    // Sin decimales sobrantes y con el separador de miles del idioma.
    expect(totals).toContain('64.000 mm³ (64 mL)');
  });
});
