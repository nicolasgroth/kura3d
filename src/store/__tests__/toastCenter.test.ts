/**
 * @file src/store/__tests__/toastCenter.test.ts
 * @description Centro de mensajes: un solo emergente (el más reciente), todo el resto queda en el histórico de su
 * tipo, «Vaciar» por tipo y quitar uno a uno, y los mensajes ligados a una pieza salen del histórico al borrarla o al
 * reparar su malla. El histórico no se guarda en el almacenamiento local.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBox } from '../../test/fakeObjects';
import { toastBucket } from '../toastCenter';
import { useKuraStore } from '../useKuraStore';

const store = () => useKuraStore.getState();

beforeEach(() => {
  useKuraStore.setState({ toasts: [], toastHistory: [], objects: [], selectedIds: [] } as never);
});

describe('centro de mensajes: store', () => {
  it('deja un solo emergente (el último) y todos en el histórico', () => {
    store().addToast('uno', 'info');
    store().addToast('dos', 'error');
    store().addToast('tres', 'warning');
    expect(store().toasts.map((x) => x.text)).toEqual(['tres']);
    expect(store().toastHistory.map((x) => x.text)).toEqual(['uno', 'dos', 'tres']);
  });

  it('cerrar el emergente no toca el histórico; un mensaje repetido sube sin duplicarse', () => {
    const id = store().addToast('uno', 'info')!;
    store().dismissToast(id);
    expect(store().toasts).toHaveLength(0);
    expect(store().toastHistory).toHaveLength(1);
    store().addToast('dos', 'info');
    store().addToast('uno', 'info');
    expect(store().toastHistory.map((x) => x.text)).toEqual(['dos', 'uno']);
  });

  it('agrupa éxito con información y separa errores y advertencias', () => {
    expect(['info', 'success', 'warning', 'error'].map((k) => toastBucket(k as never))).toEqual(['info', 'info', 'warning', 'error']);
  });

  it('quita uno a uno y vacía por tipo', () => {
    const a = store().addToast('a', 'error')!;
    store().addToast('b', 'error');
    store().addToast('c', 'info');
    store().removeToastHistoryEntry(a);
    expect(store().toastHistory.map((x) => x.text)).toEqual(['b', 'c']);
    store().clearToastHistory('error');
    expect(store().toastHistory.map((x) => x.text)).toEqual(['c']);
    store().clearToastHistory();
    expect(store().toastHistory).toHaveLength(0);
  });

  it('un mensaje ligado a una pieza sale del histórico al borrarla', () => {
    const box = fakeBox('p1', 'Pieza');
    useKuraStore.setState({ objects: [box] } as never);
    store().addToast('de la pieza', 'warning', undefined, { objectIds: ['p1'] });
    store().addToast('libre', 'warning');
    useKuraStore.setState({ objects: [] } as never);
    expect(store().toastHistory.map((x) => x.text)).toEqual(['libre']);
  });

  it('un mensaje con la acción de reparar sale al cambiar la malla de su pieza', () => {
    const box = fakeBox('p1', 'Pieza');
    useKuraStore.setState({ objects: [box] } as never);
    store().addToast('malla abierta', 'warning', { label: 'Reparar malla', run: () => undefined, targetIds: ['p1'], watch: 'mesh' });
    expect(store().toastHistory).toHaveLength(1);
    useKuraStore.setState({ objects: [{ ...box, mesh: { ...box.mesh } }] } as never);
    expect(store().toastHistory).toHaveLength(0);
  });

  it('no guarda el histórico en el almacenamiento local', () => {
    store().addToast('secreto de sesión', 'error');
    const dump = JSON.stringify({ ...globalThis.localStorage });
    expect(dump).not.toContain('secreto de sesión');
  });
});
