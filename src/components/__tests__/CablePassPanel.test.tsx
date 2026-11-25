/**
 * @file src/components/__tests__/CablePassPanel.test.tsx
 * @description Panel «Paso de cable»: no abre sin pieza sólida, redondo Ø 5 por defecto con resumen y nota por
 * verificar, cambiar a ranura carga 8 × 4 y el preajuste USB-C carga 9,5 × 4, profundidad a mano en el resumen,
 * ranura con el largo menor que el alto que bloquea la colocación, aviso corto por colocación sin cambiar la
 * selección, exclusión con el ojo de cerradura, entradas en Insertar y en la paleta, y los textos en los 6 idiomas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CABLE_PASS_DEFAULTS } from '../../core/addons/cablePassPresets';
import { t } from '../../i18n';
import { TRANSLATIONS } from '../../i18n/translations';
import { cablePassPanel, useCablePassPanel, useCablePassPresets } from '../../store/cablePassPanel';
import { GENERATORS, runInsert, startPanelExclusion } from '../../store/insertCatalog';
import { keyholePanel, useKeyholePanel } from '../../store/keyholePanel';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject } from '../../types/kura';
import { rankPaletteItems } from '../../utils/paletteRank';
import { CablePassPanel } from '../cablePass/CablePassPanel';
import { cablePassPaletteItems } from '../cablePass/cablePassPaletteItems';

const store = () => useKuraStore.getState();

beforeEach(() => {
  localStorage.clear();
  useCablePassPresets.getState().reload();
  cablePassPanel.close();
  keyholePanel.close();
  cablePassPanel.setParams({ ...CABLE_PASS_DEFAULTS });
  useKuraStore.setState({ objects: [fakeBox('b1', 'Caja', 20)], toasts: [], selectedIds: [] });
});

describe('panel del paso de cable', () => {
  it('sin pieza sólida no abre y dice por qué', () => {
    useKuraStore.setState({ objects: [] });
    expect(cablePassPanel.open()).toBe(false);
    expect(store().toasts.some((x) => x.text === t('es', 'cable.needSolid'))).toBe(true);
  });

  it('redondo Ø 5 por defecto; ranura carga 8 × 4; USB-C carga 9,5 × 4; profundidad a mano en el resumen', async () => {
    const user = userEvent.setup();
    render(<CablePassPanel />);
    act(() => void cablePassPanel.open());
    expect(screen.getByTestId('cable-summary').textContent).toBe('Agujero Ø 5 mm con chaflán de 0,5 mm; atraviesa la pared.');
    expect(screen.getByTestId('cable-start-note').textContent).toMatch(/por verificar/);
    expect((screen.getByTestId('cable-preset') as HTMLSelectElement).value).toBe('builtin:round-5');
    await user.click(screen.getByTestId('cable-shape-slot'));
    expect(useCablePassPanel.getState().params).toMatchObject({ shape: 'slot', lengthMm: 8, widthMm: 4 });
    await user.selectOptions(screen.getByTestId('cable-preset'), 'builtin:usbc');
    expect(useCablePassPanel.getState().params).toMatchObject({ shape: 'slot', lengthMm: 9.5, widthMm: 4 });
    await user.click(screen.getByTestId('cable-auto-depth'));
    expect(screen.getByTestId('cable-summary').textContent).toBe('Ranura de 9,5 × 4 mm con chaflán de 0,5 mm; 10 mm de profundidad.');
  });

  it('ranura con el largo menor que el alto: bloquea y no coloca', async () => {
    render(<CablePassPanel />);
    act(() => {
      cablePassPanel.open();
      cablePassPanel.setParams({ shape: 'slot', widthMm: 6, lengthMm: 4 });
    });
    expect(useCablePassPanel.getState().blocked).toBe(true);
    expect(screen.getByTestId('cable-summary').textContent).toBe(t('es', 'cable.summaryInvalid'));
    const add = vi.spyOn(store(), 'addCablePass');
    expect(await cablePassPanel.placeAt('b1', [0, 10, 10], [0, 0, 1])).toBe(false);
    expect(add).not.toHaveBeenCalled();
    add.mockRestore();
  });

  it('cada clic deja un solo aviso corto, sin cambiar la selección', async () => {
    useKuraStore.setState({ selectedIds: ['b1'] });
    const object = { ...fakeBox('c1', 'Paso de cable Ø 5', 5) } as SceneObject;
    const report = { thicknessMm: 3, boreMm: 3, through: true, noExit: false, nearEdge: true, nearAddon: false };
    const add = vi.spyOn(store(), 'addCablePass').mockImplementation(async () => {
      // La colocación selecciona la pieza nueva: placeAt vuelve a la selección previa.
      useKuraStore.setState({ selectedIds: [object.id] });
      return { object, report };
    });
    act(() => void cablePassPanel.open());
    await cablePassPanel.placeAt('b1', [0, 10, 10], [0, 0, 1]);
    await cablePassPanel.placeAt('b1', [0, 10, 10], [0, 0, 1]);
    expect(store().selectedIds).toEqual(['b1']);
    const placed = store().toasts.filter((x) => x.text.startsWith('Paso de cable Ø 5 agregado.'));
    expect(placed).toHaveLength(1);
    expect(placed[0].text).toMatch(/Cerca del borde/);
    add.mockRestore();
  });

  it('abrir el ojo de cerradura cierra el paso de cable', () => {
    const off = startPanelExclusion();
    act(() => void cablePassPanel.open());
    act(() => void keyholePanel.open());
    expect(useKeyholePanel.getState().open).toBe(true);
    expect(useCablePassPanel.getState().open).toBe(false);
    off();
  });

  it('está en Insertar y en la paleta (también en inglés)', async () => {
    expect(GENERATORS).toContain('cablePass');
    await runInsert('cablePass');
    expect(useCablePassPanel.getState().open).toBe(true);
    expect(rankPaletteItems(cablePassPaletteItems('es', 'Crear'), 'cable')).toHaveLength(1);
    expect(rankPaletteItems(cablePassPaletteItems('en', 'Create'), 'usb')).toHaveLength(1);
  });

  it('textos en los 6 idiomas, sin vacíos', () => {
    const keys = Object.keys(TRANSLATIONS.es).filter((k) => k.startsWith('cable.'));
    expect(keys.length).toBeGreaterThan(40);
    for (const lang of Object.keys(TRANSLATIONS) as (keyof typeof TRANSLATIONS)[]) {
      for (const k of keys) expect((TRANSLATIONS[lang] as Record<string, string>)[k], `${lang} ${k}`).toBeTruthy();
    }
  });
});
