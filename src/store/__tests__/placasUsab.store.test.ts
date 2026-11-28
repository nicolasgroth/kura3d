/**
 * @file src/store/__tests__/placasUsab.store.test.ts
 * @description Usabilidad de placas: «Solo esta» y el cambio Imprimir/Armado piden encuadrar (la cama activa, todas las
 * camas o la figura) en vez de dejar la cámara pegada a la pieza; borrar una placa deja un solo paso que «Deshacer»
 * restaura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { KuraCommandRequest } from '../../types/kura';
import { framingAfterLayoutChange } from '../slices/viewModeSlice';
import { resetStore, store } from './storeTestUtils';

const make = async (name: string) => {
  await store().executeCommand({ id: name, command: 'create_primitive' as KuraCommandRequest['command'], params: { type: 'box', width: 20, depth: 20, height: 20, name } }, 'mcp');
};

describe('encuadre de placas al cambiar de vista', () => {
  beforeEach(() => resetStore());

  it('«Solo esta» encuadra la cama activa y quitarlo vuelve a todas las camas', async () => {
    await make('A');
    store().createPlate();
    store().setPlateSolo(true);
    expect(store().cameraRequest?.preset).toBe('activePlateFit');
    store().setPlateSolo(false);
    expect(store().cameraRequest?.preset).toBe('plates');
    const nonce = store().cameraRequest!.nonce;
    store().setPlateSolo(false);
    expect(store().cameraRequest!.nonce).toBe(nonce);
  });

  it('entrar a Armado encuadra la figura; volver a Imprimir encuadra las camas', async () => {
    await make('A');
    store().createPlate();
    expect(store().setViewMode('assembly')).toBe('changed');
    expect(store().cameraRequest?.preset).toBe('scene');
    store().setViewMode('print');
    expect(store().cameraRequest?.preset).toBe('plates');
    store().setPlateSolo(true);
    store().setViewMode('assembly');
    store().setViewMode('print');
    expect(store().cameraRequest?.preset).toBe('activePlateFit');
  });

  it('Armado → Libre no mueve la cámara (la disposición no cambia)', async () => {
    await make('A');
    store().setViewMode('assembly');
    const nonce = store().cameraRequest!.nonce;
    store().setViewMode('free');
    expect(store().cameraRequest!.nonce).toBe(nonce);
  });

  it('sin placas, volver a Imprimir encuadra la escena', () => {
    expect(framingAfterLayoutChange({ plateSolo: true, plates: [] }, 'print')).toBe('scene');
  });
});
