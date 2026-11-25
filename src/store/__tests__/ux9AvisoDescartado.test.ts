/**
 * @file src/store/__tests__/ux9AvisoDescartado.test.ts
 * @description Lote ux9: un aviso con acción sobre objetos concretos que el usuario descartó no vuelve a emerger
 * por la misma causa; queda en el historial de «Avisos».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useKuraStore } from '../useKuraStore';

const action = (ids: string[]) => ({ label: 'Separar cuerpos', run: () => undefined, targetIds: ids });

beforeEach(() => useKuraStore.setState({ toasts: [], toastHistory: [] } as never));

describe('aviso descartado', () => {
  it('«Cerrar todos» no deja que el mismo aviso vuelva a emerger', () => {
    const s = useKuraStore.getState();
    s.addToast('Llavero: trae 4 cuerpos', 'info', action(['a']));
    s.addToast('Otro aviso', 'info');
    useKuraStore.getState().dismissAllToasts();
    useKuraStore.getState().addToast('Llavero: trae 4 cuerpos', 'info', action(['a']));
    expect(useKuraStore.getState().toasts).toHaveLength(0);
    expect(useKuraStore.getState().toastHistory.some((h) => h.text === 'Llavero: trae 4 cuerpos')).toBe(true);
  });

  it('cerrar uno con la X tampoco lo deja reaparecer, pero un objeto distinto sí avisa', () => {
    useKuraStore.getState().addToast('Aviso', 'info', action(['a']));
    useKuraStore.getState().dismissToast(useKuraStore.getState().toasts[0].id);
    useKuraStore.getState().addToast('Aviso', 'info', action(['a']));
    expect(useKuraStore.getState().toasts).toHaveLength(0);
    useKuraStore.getState().addToast('Aviso', 'info', action(['b']));
    expect(useKuraStore.getState().toasts).toHaveLength(1);
  });

  it('los avisos sin objetos asociados se pueden repetir', () => {
    useKuraStore.getState().addToast('Guardado', 'success');
    useKuraStore.getState().dismissAllToasts();
    useKuraStore.getState().addToast('Guardado', 'success');
    expect(useKuraStore.getState().toasts).toHaveLength(1);
  });
});
