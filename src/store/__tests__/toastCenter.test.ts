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

  describe('emergente con acción vigente', () => {
    const accion = (live = true) => ({ label: 'Convertir en placas', run: () => undefined, applicable: () => live });

    it('un informativo o de éxito sin acción no lo desplaza: va directo al histórico', () => {
      store().addToast('oferta', 'info', accion());
      expect(store().addToast('otro', 'info')).not.toBeNull();
      store().addToast('listo', 'success');
      expect(store().toasts.map((x) => x.text)).toEqual(['oferta']);
      expect(store().toastHistory.map((x) => x.text)).toEqual(['oferta', 'otro', 'listo']);
    });

    it('un error, una advertencia con acción u otro mensaje con acción sí lo desplazan', () => {
      store().addToast('oferta', 'info', accion());
      store().addToast('falló', 'error');
      expect(store().toasts.map((x) => x.text)).toEqual(['falló']);
      store().addToast('oferta 2', 'info', accion());
      store().addToast('aviso con botón', 'warning', { label: 'Reparar malla', run: () => undefined });
      expect(store().toasts.map((x) => x.text)).toEqual(['aviso con botón']);
      store().addToast('oferta 3', 'info', accion());
      store().addToast('oferta 4', 'info', accion());
      expect(store().toasts.map((x) => x.text)).toEqual(['oferta 4']);
    });

    it('una advertencia sin acción no lo desplaza: va al histórico y cuenta en el icono de advertencias', () => {
      store().addToast('oferta', 'info', accion());
      store().addToast('orientación mezclada', 'warning');
      expect(store().toasts.map((x) => x.text)).toEqual(['oferta']);
      expect(store().toastHistory.map((x) => [x.text, x.kind])).toEqual([['oferta', 'info'], ['orientación mezclada', 'warning']]);
      expect(store().toastHistory.filter((x) => toastBucket(x.kind) === 'warning')).toHaveLength(1);
    });

    it('con una acción transitoria («Ver detalles») la advertencia sin acción sí lo reemplaza', () => {
      store().addToast('Malla reparada', 'success', { label: 'Ver detalles', run: () => undefined, transient: true });
      store().addToast('Se cerró 1 agujero grande', 'warning');
      expect(store().toasts.map((x) => x.text)).toEqual(['Se cerró 1 agujero grande']);
    });

    it('si la acción ya no vale, un informativo sí lo reemplaza', () => {
      let live = true;
      store().addToast('oferta', 'info', { label: 'x', run: () => undefined, applicable: () => live });
      live = false;
      store().addToast('otro', 'info');
      expect(store().toasts.map((x) => x.text)).toEqual(['otro']);
    });
  });

  it('un informativo sin acción no desplaza a un error o advertencia a la vista: va al histórico', () => {
    store().addToast('falló', 'error');
    store().addToast('listo', 'success');
    store().addToast('dato', 'info');
    expect(store().toasts.map((x) => x.text)).toEqual(['falló']);
    store().addToast('cuidado', 'warning');
    store().addToast('otro dato', 'info');
    expect(store().toasts.map((x) => x.text)).toEqual(['cuidado']);
    expect(store().toastHistory.map((x) => x.text)).toEqual(['falló', 'listo', 'dato', 'cuidado', 'otro dato']);
    store().addToast('falló 2', 'error');
    expect(store().toasts.map((x) => x.text)).toEqual(['falló 2']);
  });

  it('el histórico distingue piezas: mismo texto y tipo en piezas distintas son mensajes distintos', () => {
    store().addToast('malla abierta', 'warning', undefined, { objectIds: ['a'] });
    store().addToast('malla abierta', 'warning', undefined, { objectIds: ['b'] });
    expect(store().toastHistory.map((x) => x.objectIds)).toEqual([['a'], ['b']]);
    store().addToast('malla abierta', 'warning', undefined, { objectIds: ['a'] });
    expect(store().toastHistory.map((x) => x.objectIds)).toEqual([['b'], ['a']]);
  });

  it('abrir o crear un proyecto vacía emergentes e histórico, y el aviso de la propia apertura sí queda', () => {
    store().addToast('viejo', 'error');
    store().addToast('viejo 2', 'info');
    useKuraStore.setState({ engineReady: true, busyOperation: null, aiBusy: false } as never);
    expect(store().newProject()).toBe(true);
    expect(store().toastHistory.map((x) => x.text)).not.toContain('viejo');
    expect(store().toasts.map((x) => x.text)).not.toContain('viejo');
    store().addToast('viejo', 'error');
    store().resetMessages();
    store().addToast('nuevo', 'success');
    expect(store().toastHistory.map((x) => x.text)).toEqual(['nuevo']);
    expect(store().toasts.map((x) => x.text)).toEqual(['nuevo']);
  });

  it('no guarda el histórico en el almacenamiento local', () => {
    store().addToast('secreto de sesión', 'error');
    const dump = JSON.stringify({ ...globalThis.localStorage });
    expect(dump).not.toContain('secreto de sesión');
  });
});
