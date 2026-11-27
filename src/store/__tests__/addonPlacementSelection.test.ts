/**
 * @file src/store/__tests__/addonPlacementSelection.test.ts
 * @description Colocar un agregado mientras corre el Worker: la selección previa se restaura solo si la tocó la
 * colocación (nadie más la cambió), nunca devuelve ids de piezas que se borraron entre medio, y el aviso de la
 * colocación anterior se reemplaza por id (lo devuelve `addToast`), sin deducirlo comparando listas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneObject } from '../../types/kura';
import { createAddonPanel } from '../addonPanelStore';
import { useKuraStore } from '../useKuraStore';

const store = () => useKuraStore.getState();
const fake = (id: string) => ({ id, name: id }) as unknown as SceneObject;

/** Un agregado de prueba cuyo `add` espera a que el test lo suelte (el «Worker»). */
function panelWithGate(selectOnAdd: boolean) {
  // Cada colocación espera su propio turno; `release` suelta la que está esperando.
  const pending: Array<() => void> = [];
  const release = () => pending.shift()?.();
  const panel = createAddonPanel<{ size: number }, { ok: true }>({
    defaults: { size: 1 },
    needSolidKey: 'keyhole.needSolid',
    placedKey: 'keyhole.placed',
    add: async () => {
      await new Promise<void>((resolve) => pending.push(resolve));
      const object = fake(`new-${Math.random()}`);
      useKuraStore.setState((s) => ({ objects: [...s.objects, object], ...(selectOnAdd ? { selectedIds: [object.id] } : {}) }));
      return { object, report: { ok: true } };
    },
    shortWarning: () => null,
  });
  return { panel, release };
}

beforeEach(() => {
  useKuraStore.setState({ objects: [fake('host'), fake('a'), fake('b')], selectedIds: ['a'], toasts: [], toastHistory: [] });
});

describe('colocar un agregado: selección', () => {
  it('si el usuario cambia la selección mientras corre el Worker, se respeta su cambio', async () => {
    const { panel, release } = panelWithGate(false);
    const placing = panel.placeAt('host', [0, 0, 0], [0, 1, 0]);
    useKuraStore.setState({ selectedIds: ['b'] });
    release();
    expect(await placing).toBe(true);
    expect(store().selectedIds).toEqual(['b']);
  });

  it('si la colocación seleccionó la pieza nueva, se vuelve a la selección previa', async () => {
    const { panel, release } = panelWithGate(true);
    const placing = panel.placeAt('host', [0, 0, 0], [0, 1, 0]);
    release();
    expect(await placing).toBe(true);
    expect(store().selectedIds).toEqual(['a']);
  });

  it('al restaurar no devuelve ids de piezas borradas entre medio', async () => {
    useKuraStore.setState({ selectedIds: ['a', 'b'] });
    const { panel, release } = panelWithGate(true);
    const placing = panel.placeAt('host', [0, 0, 0], [0, 1, 0]);
    useKuraStore.setState((s) => ({ objects: s.objects.filter((o) => o.id !== 'b') }));
    release();
    await placing;
    expect(store().selectedIds).toEqual(['a']);
  });
});

describe('colocar un agregado: aviso', () => {
  it('addToast devuelve el id del aviso que muestra', () => {
    const id = store().addToast('hola', 'info');
    expect(id).toBeTruthy();
    expect(store().toasts.find((x) => x.id === id)?.text).toBe('hola');
  });

  it('cada colocación reemplaza a la anterior a la vista y no toca otros avisos del histórico', async () => {
    const other = store().addToast('otro aviso', 'error');
    const { panel, release } = panelWithGate(false);
    for (let i = 0; i < 3; i += 1) {
      const placing = panel.placeAt('host', [0, 0, 0], [0, 1, 0]);
      release();
      await placing;
      // A la vista queda un solo emergente y el histórico conserva una sola colocación (la más reciente) y el aviso ajeno.
      expect(store().toasts).toHaveLength(1);
      expect(store().toastHistory.filter((x) => x.id !== other)).toHaveLength(1);
      expect(store().toastHistory.some((x) => x.id === other)).toBe(true);
    }
  });
});
