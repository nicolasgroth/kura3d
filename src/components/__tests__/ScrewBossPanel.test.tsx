/**
 * @file src/components/__tests__/ScrewBossPanel.test.tsx
 * @description Panel «Torreta para tornillo»: no abre sin pieza sólida (y dice por qué), M3 directo por defecto con
 * su resumen y la nota de valores por verificar, cambiar a inserto carga la medida equivalente, preajustes propios
 * (guardar con nombre, eliminar con Deshacer, saneo al leer y tope), campo fuera de rango o poste más angosto que el
 * agujero que bloquea la colocación, un solo aviso por colocación que reemplaza al anterior sin cambiar la
 * selección, exclusión con el imán y entradas en Insertar y en la paleta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCREW_BOSS_DEFAULTS, SCREW_BOSS_PRESET_KIND, SCREW_BOSS_PRESET_STORAGE_KEY } from '../../core/addons/screwBossPresets';
import { t } from '../../i18n';
import { GENERATORS, insertLabelKey, runInsert, startPanelExclusion } from '../../store/insertCatalog';
import { closeMagnetPanel, openMagnetPanel, useMagnetPanel } from '../../store/magnetPanel';
import {
  closeScrewBossPanel, openScrewBossPanel, placeScrewBossAt, setScrewBossParams, useScrewBossPanel, useScrewBossPresets,
} from '../../store/screwBossPanel';
import { loadUserPresets, MAX_USER_PRESETS } from '../../store/userPresets';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { rankPaletteItems } from '../../utils/paletteRank';
import { ScrewBossPanel } from '../screwBoss/ScrewBossPanel';
import { screwBossPaletteItems } from '../screwBoss/screwBossPaletteItems';

const store = () => useKuraStore.getState();
const report = { wallMm: 2.5, intoHostMm: 0, exits: false, collides: false, seatMm: 0.3 };

beforeEach(() => {
  localStorage.clear();
  useScrewBossPresets.getState().reload();
  closeScrewBossPanel();
  closeMagnetPanel();
  setScrewBossParams({ ...SCREW_BOSS_DEFAULTS });
  useKuraStore.setState({ objects: [fakeBox('b1', 'Caja', 20)], toasts: [], selectedIds: [] });
});

describe('panel de la torreta', () => {
  it('sin pieza sólida no abre y dice por qué', () => {
    useKuraStore.setState({ objects: [] });
    expect(openScrewBossPanel()).toBe(false);
    expect(useScrewBossPanel.getState().open).toBe(false);
    expect(store().toasts.some((x) => x.text === t('es', 'turret.needSolid'))).toBe(true);
  });

  it('abre con M3 directo, resumen y nota de valores de partida; inserto carga M3 Ø 4', async () => {
    const user = userEvent.setup();
    render(<ScrewBossPanel />);
    act(() => void openScrewBossPanel());
    expect(screen.getByTestId('turret-summary').textContent).toBe('Poste Ø 7,5 × 10 mm, agujero Ø 2,5 × 8 mm');
    expect(screen.getByTestId('turret-start-note').textContent).toMatch(/imprimir una torreta de prueba/);
    expect((screen.getByTestId('turret-preset') as HTMLSelectElement).value).toBe('builtin:screw-m3');
    await user.click(screen.getByTestId('turret-type-insert'));
    expect(useScrewBossPanel.getState().params).toMatchObject({ type: 'insert', nominalMm: 3, holeDiameterMm: 4 });
    expect((screen.getByTestId('turret-preset') as HTMLSelectElement).value).toBe('builtin:insert-m3');
    await user.selectOptions(screen.getByTestId('turret-preset'), 'builtin:insert-m5');
    expect(useScrewBossPanel.getState().params).toMatchObject({ nominalMm: 5, holeDiameterMm: 6.4, holeDepthMm: 10.5 });
  });

  it('guarda un preajuste propio, lo elimina y Deshacer lo devuelve', async () => {
    const user = userEvent.setup();
    render(<ScrewBossPanel />);
    act(() => {
      openScrewBossPanel();
      setScrewBossParams({ heightMm: 14, outerDiameterMm: 9 });
    });
    expect((screen.getByTestId('turret-preset') as HTMLSelectElement).value).toBe('');
    await user.click(screen.getByTestId('turret-preset-save'));
    expect(screen.getByRole('alert').textContent).toBe(t('es', 'turret.preset.nameInvalid'));
    await user.type(screen.getByTestId('turret-preset-name'), 'Tapa caja');
    await user.click(screen.getByTestId('turret-preset-save'));
    const [mine] = useScrewBossPresets.getState().presets;
    expect(mine).toMatchObject({ name: 'Tapa caja', values: { heightMm: 14, outerDiameterMm: 9 } });
    expect((screen.getByTestId('turret-preset') as HTMLSelectElement).value).toBe(mine.id);
    expect(loadUserPresets(SCREW_BOSS_PRESET_KIND)).toHaveLength(1);
    await user.click(screen.getByTestId('turret-preset-delete'));
    expect(useScrewBossPresets.getState().presets).toEqual([]);
    const toast = store().toasts.find((x) => x.text === t('es', 'turret.preset.deleted', { name: 'Tapa caja' }))!;
    expect(toast).toBeTruthy();
    act(() => toast.action!.run());
    expect(useScrewBossPresets.getState().presets.map((p) => p.name)).toEqual(['Tapa caja']);
  });

  it('al leer descarta lo corrupto y respeta el tope', () => {
    const good = { id: 'user-a1', name: 'Buena', values: SCREW_BOSS_DEFAULTS };
    const bad = [
      { id: 'user-a2', name: 'Mala', values: { ...SCREW_BOSS_DEFAULTS, outerDiameterMm: 1 } },
      { id: 'otro', name: 'Id malo', values: SCREW_BOSS_DEFAULTS },
      'basura',
    ];
    localStorage.setItem(SCREW_BOSS_PRESET_STORAGE_KEY, JSON.stringify([good, ...bad]));
    expect(loadUserPresets(SCREW_BOSS_PRESET_KIND).map((p) => p.name)).toEqual(['Buena']);
    const many = Array.from({ length: MAX_USER_PRESETS + 5 }, (_, i) => ({ id: `user-n${i}`, name: `N${i}`, values: SCREW_BOSS_DEFAULTS }));
    localStorage.setItem(SCREW_BOSS_PRESET_STORAGE_KEY, JSON.stringify(many));
    expect(loadUserPresets(SCREW_BOSS_PRESET_KIND)).toHaveLength(MAX_USER_PRESETS);
  });

  it('un poste más angosto que el agujero bloquea la colocación y lo dice', async () => {
    const add = vi.fn().mockResolvedValue(null);
    useKuraStore.setState({ addScrewBoss: add } as never);
    render(<ScrewBossPanel />);
    act(() => {
      openScrewBossPanel();
      setScrewBossParams({ outerDiameterMm: 2.5 });
    });
    await waitFor(() => expect(useScrewBossPanel.getState().blocked).toBe(true));
    expect(screen.getByTestId('turret-hint').textContent).toBe(t('es', 'turret.invalid'));
    expect(screen.getByTestId('turret-summary').textContent).toBe(t('es', 'turret.summaryInvalid'));
    expect(await placeScrewBossAt('b1', [0, 20, 0], [0, 1, 0])).toBe(false);
    expect(add).not.toHaveBeenCalled();
    act(() => setScrewBossParams({ outerDiameterMm: 7.5 }));
    await waitFor(() => expect(useScrewBossPanel.getState().blocked).toBe(false));
  });

  it('cada colocación deja un solo aviso corto que reemplaza al anterior y no cambia la selección', async () => {
    let n = 0;
    const add = vi.fn().mockImplementation(async () => {
      n += 1;
      return { post: { id: `p${n}`, name: `Torreta M3 (${n})` }, hole: { id: `h${n}` }, report: n === 2 ? { ...report, wallMm: 0.8 } : report };
    });
    useKuraStore.setState({ addScrewBoss: add, selectedIds: ['b1'] } as never);
    act(() => void openScrewBossPanel());
    await placeScrewBossAt('b1', [0, 20, 0], [0, 1, 0]);
    await placeScrewBossAt('b1', [5, 20, 0], [0, 1, 0]);
    const texts = store().toasts.map((x) => x.text);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe(`${t('es', 'turret.placed', { name: 'Torreta M3 (2)' })} ${t('es', 'turret.short.wall')}`);
    expect(store().selectedIds).toEqual(['b1']);
    expect(add.mock.calls[0][0]).toMatchObject({ hostId: 'b1', silent: true, params: SCREW_BOSS_DEFAULTS });
  });

  it('abrir la torreta cierra el imán y viceversa', () => {
    const off = startPanelExclusion();
    act(() => void openMagnetPanel());
    act(() => void openScrewBossPanel());
    expect(useMagnetPanel.getState().open).toBe(false);
    act(() => void openMagnetPanel());
    expect(useScrewBossPanel.getState().open).toBe(false);
    off();
  });

  it('está en Insertar y en la paleta («torreta», «inserto», «boss» en inglés)', async () => {
    expect(GENERATORS).toContain('screwBoss');
    expect(t('es', insertLabelKey('screwBoss'))).toBe('Torreta para tornillo');
    await runInsert('screwBoss');
    expect(useScrewBossPanel.getState().open).toBe(true);
    expect(rankPaletteItems(screwBossPaletteItems('es', 'Crear'), 'torreta')).toHaveLength(1);
    expect(rankPaletteItems(screwBossPaletteItems('es', 'Crear'), 'inserto')).toHaveLength(1);
    expect(rankPaletteItems(screwBossPaletteItems('en', 'Create'), 'boss')).toHaveLength(1);
  });
});
