/**
 * @file src/components/__tests__/KeyholePanel.test.tsx
 * @description Panel «Colgar en el muro»: no abre sin pieza sólida (y dice por qué), tornillo de 4 mm por defecto con
 * su resumen y la nota por verificar, elegir el de 5 mm carga sus medidas, guardar un preajuste propio, cuello más
 * ancho que la cabeza que bloquea la colocación, un solo aviso por colocación sin cambiar la selección, exclusión con
 * la torreta, entradas en Insertar y en la paleta, y los textos en los 6 idiomas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYHOLE_DEFAULTS } from '../../core/addons/keyholePresets';
import { t } from '../../i18n';
import { TRANSLATIONS } from '../../i18n/translations';
import { GENERATORS, insertLabelKey, runInsert, startPanelExclusion } from '../../store/insertCatalog';
import { keyholePanel, useKeyholePanel, useKeyholePresets } from '../../store/keyholePanel';
import { closeScrewBossPanel, openScrewBossPanel, useScrewBossPanel } from '../../store/screwBossPanel';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject } from '../../types/kura';
import { rankPaletteItems } from '../../utils/paletteRank';
import { KeyholePanel } from '../keyhole/KeyholePanel';
import { keyholePaletteItems } from '../keyhole/keyholePaletteItems';

const store = () => useKuraStore.getState();
const okReport = { wallBehindMm: 5.5, through: false, edge: false, vertical: true, levelOffsetMm: null };

beforeEach(() => {
  localStorage.clear();
  useKeyholePresets.getState().reload();
  keyholePanel.close();
  closeScrewBossPanel();
  keyholePanel.setParams({ ...KEYHOLE_DEFAULTS });
  useKuraStore.setState({ objects: [fakeBox('b1', 'Caja', 20)], toasts: [], selectedIds: [] });
});

describe('panel del ojo de cerradura', () => {
  it('sin pieza sólida no abre y dice por qué', () => {
    useKuraStore.setState({ objects: [] });
    expect(keyholePanel.open()).toBe(false);
    expect(store().toasts.some((x) => x.text === t('es', 'keyhole.needSolid'))).toBe(true);
  });

  it('abre con el tornillo de 4 mm, resumen y nota; el de 5 mm carga sus medidas', async () => {
    const user = userEvent.setup();
    render(<KeyholePanel />);
    act(() => void keyholePanel.open());
    expect(screen.getByTestId('keyhole-summary').textContent).toBe(
      'Entrada Ø 8,5 mm, cuello 4,5 × 10 mm, cámara 3 mm bajo un labio de 1,5 mm (fondo total 4,5 mm).',
    );
    expect(screen.getByTestId('keyhole-start-note').textContent).toMatch(/por verificar/);
    expect((screen.getByTestId('keyhole-preset') as HTMLSelectElement).value).toBe('builtin:screw-4');
    await user.selectOptions(screen.getByTestId('keyhole-preset'), 'builtin:screw-5');
    expect(useKeyholePanel.getState().params).toMatchObject({ screwMm: 5, headDiameterMm: 10.5, neckWidthMm: 5.5 });
  });

  it('guarda un preajuste propio con nombre', async () => {
    const user = userEvent.setup();
    render(<KeyholePanel />);
    act(() => {
      keyholePanel.open();
      keyholePanel.setParams({ slotLengthMm: 14 });
    });
    expect((screen.getByTestId('keyhole-preset') as HTMLSelectElement).value).toBe('');
    await user.type(screen.getByTestId('keyhole-preset-name'), 'Cuadro grande');
    await user.click(screen.getByTestId('keyhole-preset-save'));
    expect(useKeyholePresets.getState().presets[0]).toMatchObject({ name: 'Cuadro grande', values: { slotLengthMm: 14 } });
  });

  it('cuello más ancho que la cabeza: marca el campo, avisa y no coloca', async () => {
    render(<KeyholePanel />);
    act(() => {
      keyholePanel.open();
      keyholePanel.setParams({ neckWidthMm: 8.4 });
    });
    expect(useKeyholePanel.getState().blocked).toBe(true);
    expect(screen.getByTestId('keyhole-hint').textContent).toBe(t('es', 'keyhole.invalid'));
    const add = vi.spyOn(store(), 'addKeyhole');
    expect(await keyholePanel.placeAt('b1', [0, 10, 10], [0, 0, 1])).toBe(false);
    expect(add).not.toHaveBeenCalled();
    add.mockRestore();
  });

  it('cada clic deja un solo aviso que reemplaza al anterior, sin cambiar la selección', async () => {
    useKuraStore.setState({ selectedIds: ['b1'] });
    const object = { ...fakeBox('k1', 'Ojo de cerradura 4 mm', 5) } as SceneObject;
    const add = vi.spyOn(store(), 'addKeyhole').mockImplementation(async () => {
      useKuraStore.setState({ selectedIds: [] });
      return { object, report: { ...okReport, vertical: false } };
    });
    act(() => void keyholePanel.open());
    await keyholePanel.placeAt('b1', [0, 10, 10], [0, 1, 0]);
    await keyholePanel.placeAt('b1', [0, 10, 10], [0, 1, 0]);
    expect(store().selectedIds).toEqual(['b1']);
    const placed = store().toasts.filter((x) => x.text.startsWith('Ojo de cerradura 4 mm agregado.'));
    expect(placed).toHaveLength(1);
    expect(placed[0].text).toMatch(/Cara no vertical/);
    add.mockRestore();
  });

  it('abrir la torreta cierra el ojo (mismo hueco de panel)', () => {
    const off = startPanelExclusion();
    act(() => void keyholePanel.open());
    act(() => void openScrewBossPanel());
    expect(useScrewBossPanel.getState().open).toBe(true);
    expect(useKeyholePanel.getState().open).toBe(false);
    off();
  });

  it('está en Insertar y en la paleta (también buscando en inglés)', async () => {
    expect(GENERATORS).toContain('keyhole');
    expect(insertLabelKey('keyhole')).toBe('keyhole.title');
    await runInsert('keyhole');
    expect(useKeyholePanel.getState().open).toBe(true);
    expect(rankPaletteItems(keyholePaletteItems('es', 'Crear'), 'colgar')).toHaveLength(1);
    expect(rankPaletteItems(keyholePaletteItems('en', 'Create'), 'keyhole')).toHaveLength(1);
  });

  it('textos en los 6 idiomas, sin vacíos', () => {
    const keys = Object.keys(TRANSLATIONS.es).filter((k) => k.startsWith('keyhole.'));
    expect(keys.length).toBeGreaterThan(40);
    for (const lang of Object.keys(TRANSLATIONS) as (keyof typeof TRANSLATIONS)[]) {
      for (const k of keys) expect((TRANSLATIONS[lang] as Record<string, string>)[k], `${lang} ${k}`).toBeTruthy();
    }
  });
});
