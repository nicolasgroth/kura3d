/**
 * @file src/store/__tests__/undoReframe.store.test.ts
 * @description Deshacer/rehacer piden a la cámara asegurar (modo `ensure`) la selección restaurada:
 * así, al deshacer una división, el objeto original vuelve a quedar entero a la vista si quedó fuera.
 * Un deshacer sin selección restaurada no mueve la cámara.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBox } from '../../test/fakeObjects';
import { cloneSnapshot } from '../projectDocument';
import { resetStore, store } from './storeTestUtils';
import { useKuraStore } from '../useKuraStore';

beforeEach(() => resetStore());

describe('encuadre tras deshacer/rehacer', () => {
  it('deshacer y rehacer piden ensure con la selección restaurada', () => {
    const original = fakeBox('orig', 'Cubo 1', 400);
    useKuraStore.setState({ objects: [original], selectedIds: ['orig'], future: [] } as never);
    useKuraStore.setState({ past: [cloneSnapshot([original], ['orig'])] } as never);
    // Simula la división: el original sale y entran dos piezas seleccionadas.
    useKuraStore.setState({ objects: [fakeBox('p1', 'Cubo 1 · A1'), fakeBox('p2', 'Cubo 1 · A2')], selectedIds: ['p1', 'p2'] } as never);

    store().undo();
    expect(store().objects.map((o) => o.id)).toEqual(['orig']);
    expect(store().cameraRequest).toMatchObject({ preset: 'ensure', ids: ['orig'] });

    store().redo();
    expect(store().cameraRequest).toMatchObject({ preset: 'ensure', ids: ['p1', 'p2'] });
  });

  it('sin selección restaurada no se pide encuadre', () => {
    useKuraStore.setState({ objects: [], selectedIds: [], future: [], cameraRequest: null } as never);
    useKuraStore.setState({ past: [cloneSnapshot([fakeBox('a', 'A')], [])] } as never);
    store().undo();
    expect(store().cameraRequest).toBeNull();
  });
});
