/**
 * @file src/store/__tests__/toolAvailability.test.ts
 * @description Regla de disponibilidad de las herramientas de la barra (`toolAvailability`), su activación
 * (`activateRailTool`) y el panel derecho según la herramienta (`panelContextOf`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject } from '../../types/kura';
import { panelContextOf } from '../panelContext';
import { activateRailTool } from '../toolActivation';
import { toolAvailability } from '../toolAvailability';
import { useKuraStore } from '../useKuraStore';
import { addBox, resetStore } from './storeTestUtils';

const box = (id: string, extra: Partial<SceneObject> = {}): SceneObject => ({ ...fakeBox(id, id), ...extra });

describe('toolAvailability', () => {
  it('Seleccionar siempre está disponible', () => {
    expect(toolAvailability({ objects: [], selectedIds: [] }, 'select').enabled).toBe(true);
  });

  it('Mover/Rotar/Escalar sin selección toman el único objeto o todos los visibles sin candado', () => {
    expect(toolAvailability({ objects: [box('a')], selectedIds: [] }, 'scale').autoSelect).toEqual(['a']);
    const objects = [box('a'), box('b'), box('c', { locked: true }), box('d', { visible: false })];
    for (const tool of ['move', 'rotate', 'scale'] as const) {
      const r = toolAvailability({ objects, selectedIds: [] }, tool);
      expect(r.enabled).toBe(true);
      expect(r.autoSelect).toEqual(['a', 'b']);
    }
  });

  it('con selección no cambia la selección', () => {
    expect(toolAvailability({ objects: [box('a'), box('b')], selectedIds: ['b'] }, 'move')).toEqual({ enabled: true, autoSelect: [] });
  });

  it('escena vacía apaga todo salvo Seleccionar, con motivo', () => {
    for (const tool of ['move', 'rotate', 'scale', 'paint', 'cut', 'erase', 'measure'] as const) {
      const r = toolAvailability({ objects: [], selectedIds: [] }, tool);
      expect(r.enabled).toBe(false);
      expect(r.reason).toBe('rediseno3b.reason.emptyScene');
    }
  });

  it('objetos que no sirven dan un motivo distinto de «escena vacía»', () => {
    const locked = [box('a', { locked: true })];
    expect(toolAvailability({ objects: locked, selectedIds: [] }, 'move').reason).toBe('rediseno3b.reason.noEditable');
    expect(toolAvailability({ objects: locked, selectedIds: [] }, 'paint').reason).toBe('rediseno3b.reason.noPaintable');
    expect(toolAvailability({ objects: [box('a', { visible: false })], selectedIds: [] }, 'measure').reason).toBe('rediseno3b.reason.noVisible');
    // Una referencia no se pinta, pero sí se mide.
    const ref = [box('r', { role: 'reference' } as Partial<SceneObject>)];
    expect(toolAvailability({ objects: ref, selectedIds: [] }, 'paint').enabled).toBe(false);
    expect(toolAvailability({ objects: ref, selectedIds: [] }, 'measure').enabled).toBe(true);
  });

  it('Pintar sin selección queda encendida y no selecciona nada (pinta lo que esté bajo el pincel)', () => {
    expect(toolAvailability({ objects: [box('a'), box('b')], selectedIds: [] }, 'paint')).toEqual({ enabled: true, autoSelect: [] });
  });

  it('Cortar, Esculpir y Medir toman el objeto si hay uno solo; con varios esperan el clic', () => {
    for (const tool of ['cut', 'erase', 'measure'] as const) {
      expect(toolAvailability({ objects: [box('a')], selectedIds: [] }, tool).autoSelect).toEqual(['a']);
      expect(toolAvailability({ objects: [box('a'), box('b')], selectedIds: [] }, tool)).toEqual({ enabled: true, autoSelect: [] });
    }
  });

  it('ignora ids seleccionados que ya no existen', () => {
    expect(toolAvailability({ objects: [box('a')], selectedIds: ['fantasma'] }, 'scale').autoSelect).toEqual(['a']);
  });
});

describe('activateRailTool', () => {
  beforeEach(() => {
    useKuraStore.setState({ language: 'es', objects: [box('a'), box('b')], selectedIds: [], activeTool: 'select', activeAction: null, transformMode: 'translate', transformFocus: null, toasts: [] } as never);
  });

  it('Escalar sin selección selecciona todo, deja el modo y el foco del panel', () => {
    activateRailTool('scale');
    const s = useKuraStore.getState();
    expect(s.selectedIds).toEqual(['a', 'b']);
    expect(s.transformMode).toBe('scale');
    expect(s.transformFocus).toBe('scale');
    expect(s.activeTool).toBe('select');
  });

  it('con la escena vacía no cambia nada y avisa el motivo', () => {
    useKuraStore.setState({ objects: [] } as never);
    const r = activateRailTool('rotate');
    const s = useKuraStore.getState();
    expect(r.enabled).toBe(false);
    expect(s.transformMode).toBe('translate');
    expect(s.toasts.at(-1)?.text).toBe('Rotar no disponible: la escena está vacía: agrega o importa un objeto');
  });

  it('Seleccionar u otra herramienta quitan el foco de transformación', () => {
    activateRailTool('move');
    expect(useKuraStore.getState().transformFocus).toBe('translate');
    activateRailTool('select');
    expect(useKuraStore.getState().transformFocus).toBeNull();
  });
});

describe('panelContextOf por herramienta', () => {
  const objects = [box('a'), box('b')];
  const base = { activeAction: null, activeTool: 'select' as const, selectedIds: ['a'], objects, transformFocus: null };

  it('Seleccionar: el resumen del objeto como antes', () => {
    expect(panelContextOf(base)).toEqual({ kind: 'object', id: 'a' });
  });

  it('Pintar: solo sus opciones, con o sin objeto', () => {
    expect(panelContextOf({ ...base, activeTool: 'paint' })).toEqual({ kind: 'tool', tool: 'paint', objectId: 'a' });
    expect(panelContextOf({ ...base, activeTool: 'paint', selectedIds: [] })).toEqual({ kind: 'tool', tool: 'paint', objectId: null });
  });

  it('Esculpir, Medir y Cortar: sus opciones', () => {
    for (const tool of ['erase', 'measure', 'cut'] as const) {
      expect(panelContextOf({ ...base, activeTool: tool })).toEqual({ kind: 'tool', tool, objectId: 'a' });
    }
  });

  it('Mover, Rotar y Escalar elegidos ponen arriba su transformación', () => {
    expect(panelContextOf({ ...base, transformFocus: 'translate' })).toEqual({ kind: 'tool', tool: 'move', objectId: 'a' });
    expect(panelContextOf({ ...base, transformFocus: 'rotate' })).toEqual({ kind: 'tool', tool: 'rotate', objectId: 'a' });
    expect(panelContextOf({ ...base, transformFocus: 'scale' })).toEqual({ kind: 'tool', tool: 'scale', objectId: 'a' });
  });

  it('con varios seleccionados y foco de transformación sigue la selección múltiple', () => {
    expect(panelContextOf({ ...base, selectedIds: ['a', 'b'], transformFocus: 'scale' })).toEqual({ kind: 'multi', count: 2 });
  });

  it('una acción con opciones manda sobre la herramienta', () => {
    expect(panelContextOf({ ...base, activeTool: 'paint', activeAction: 'hollow' })).toEqual({ kind: 'action', id: 'hollow', objectId: 'a' });
  });
});

describe('herramienta activa que deja de estar disponible', () => {
  beforeEach(() => {
    useKuraStore.setState({ language: 'es', objects: [box('a')], selectedIds: ['a'], activeTool: 'select', activeAction: null, toasts: [] } as never);
  });

  it.each(['paint', 'cut', 'erase', 'measure'] as const)('borrar el objeto con %s activo vuelve a Seleccionar', (tool) => {
    useKuraStore.getState().setActiveTool(tool);
    expect(useKuraStore.getState().activeTool).toBe(tool);
    useKuraStore.getState().deleteObjects();
    expect(useKuraStore.getState().activeTool).toBe('select');
  });

  it('ocultar el único objeto con Medir activo vuelve a Seleccionar; con otro disponible se queda', () => {
    useKuraStore.setState({ objects: [box('a'), box('b')], selectedIds: [] } as never);
    useKuraStore.getState().setActiveTool('measure');
    useKuraStore.setState({ objects: [box('a', { visible: false }), box('b')] } as never);
    expect(useKuraStore.getState().activeTool).toBe('measure');
    useKuraStore.setState({ objects: [box('a', { visible: false }), box('b', { visible: false })] } as never);
    expect(useKuraStore.getState().activeTool).toBe('select');
  });

  it('deshacer la creación del objeto también devuelve a Seleccionar', async () => {
    await resetStore();
    await addBox(10);
    useKuraStore.getState().setActiveTool('paint');
    useKuraStore.getState().undo();
    expect(useKuraStore.getState().objects).toHaveLength(0);
    expect(useKuraStore.getState().activeTool).toBe('select');
  });
});
