/**
 * @file src/__tests__/cancelTransform.test.ts
 * @description Cancelar un arrastre del gizmo (Escape o cambio de herramienta) restaura la
 * transformación previa y no deja ningún paso en el historial.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../engine';
import { useKuraStore } from '../store/useKuraStore';

describe('cancelTransformSnapshot', () => {
  beforeEach(async () => {
    await initManifoldEngine();
    useKuraStore.setState({ objects: [], selectedIds: [], past: [], future: [], toasts: [] });
  });

  it('restaura la posición previa y no agrega historial', async () => {
    const obj = await useKuraStore.getState().createPrimitive('box', { width: 10, height: 10, depth: 10 });
    expect(obj).not.toBeNull();
    const pastBefore = useKuraStore.getState().past.length;
    const before = [...useKuraStore.getState().objects[0].position];

    useKuraStore.getState().setObjectTransform(obj!.id, { position: [40, 5, 12] });
    expect(useKuraStore.getState().objects[0].position).toEqual([40, 5, 12]);

    useKuraStore.getState().cancelTransformSnapshot();
    expect(useKuraStore.getState().objects[0].position).toEqual(before);
    expect(useKuraStore.getState().past.length).toBe(pastBefore);

    // Un commit posterior no registra nada: el arrastre ya terminó.
    useKuraStore.getState().commitTransformSnapshot();
    expect(useKuraStore.getState().past.length).toBe(pastBefore);
  });

  it('sin arrastre en curso no hace nada', () => {
    const state = useKuraStore.getState();
    state.cancelTransformSnapshot();
    expect(useKuraStore.getState().past.length).toBe(0);
  });
});
