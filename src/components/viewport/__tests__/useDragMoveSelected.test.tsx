/**
 * @file src/components/viewport/__tests__/useDragMoveSelected.test.tsx
 * @description Pruebas del gesto de arrastrar para mover: umbral, clic sin arrastre, Escape, pointercancel,
 * segundo puntero, blur, desmontaje, cursor, Ctrl con rejilla libre, gesto de solo clic y que la cámara
 * (OrbitControls) vuelva a quedar activa al soltar. Cámara y lienzo simulados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneObject } from '../../../types/kura';
import { useGizmoDragStore } from '../../../store/gizmoDragStore';
import { useKuraStore } from '../../../store/useKuraStore';

const canvas = document.createElement('canvas');
const camera = new THREE.PerspectiveCamera(50, 1, 1, 10000);
vi.mock('@react-three/fiber', () => ({
  useThree: (sel: (s: unknown) => unknown) => sel({ camera, gl: { domElement: canvas } }),
}));

import { useDragMoveSelected } from '../useDragMoveSelected';

const obj = (id: string, locked = false) =>
  ({ id, name: id, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], locked, visible: true }) as unknown as SceneObject;

function pointer(type: string, init: { id?: number; x?: number; y?: number; ctrl?: boolean } = {}) {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>;
  Object.assign(ev, { pointerId: init.id ?? 1, clientX: init.x ?? 0, clientY: init.y ?? 0, ctrlKey: !!init.ctrl, metaKey: false });
  window.dispatchEvent(ev);
}

const downEvent = (x = 100, y = 100) =>
  ({ pointerId: 1, point: new THREE.Vector3(0, 0, 0), nativeEvent: { clientX: x, clientY: y } }) as never;

let rafQueue: Array<() => void>;
let orbit: { current: { enabled: boolean } };
let spies: {
  rigid: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
};

function flushFrames() {
  const q = rafQueue;
  rafQueue = [];
  q.forEach((fn) => fn());
}

beforeEach(() => {
  rafQueue = [];
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => rafQueue.push(fn));
  vi.stubGlobal('cancelAnimationFrame', () => {
    rafQueue = [];
  });
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0 }) as DOMRect;
  canvas.style.cursor = 'grab';
  camera.position.set(0, 500, 500);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  orbit = { current: { enabled: true } };
  spies = { rigid: vi.fn(), commit: vi.fn(), cancel: vi.fn() };
  useKuraStore.setState({
    objects: [obj('a')],
    selectedIds: ['a'],
    activeTool: 'select',
    snapGridMm: 0,
    transformSelectionRigid: spies.rigid,
    commitTransformSnapshot: spies.commit,
    cancelTransformSnapshot: spies.cancel,
  } as never);
  useGizmoDragStore.setState({ start: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  const hook = renderHook(() => useDragMoveSelected(orbit as never));
  const onClick = vi.fn();
  return { ...hook, onClick, start: (opts?: { moveEnabled?: boolean }) => hook.result.current.startDragMove(downEvent(), onClick, opts) };
}

describe('useDragMoveSelected', () => {
  it('apaga la cámara al empezar y no mueve bajo el umbral: soltar es un clic', () => {
    const { start, onClick } = setup();
    start();
    expect(orbit.current.enabled).toBe(false);
    pointer('pointermove', { x: 102, y: 101 });
    flushFrames();
    expect(spies.rigid).not.toHaveBeenCalled();
    expect(useGizmoDragStore.getState().start).toBeNull();
    pointer('pointerup', { x: 102, y: 101 });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(spies.commit).not.toHaveBeenCalled();
    expect(orbit.current.enabled).toBe(true);
  });

  it('pasado el umbral mueve agrupando por cuadro, pone cursor grabbing y al soltar confirma y restaura la cámara y el cursor', () => {
    const { start, onClick } = setup();
    start();
    pointer('pointermove', { x: 110, y: 100 });
    pointer('pointermove', { x: 120, y: 100 });
    pointer('pointermove', { x: 130, y: 100 });
    expect(canvas.style.cursor).toBe('grabbing');
    expect(useGizmoDragStore.getState().start).not.toBeNull();
    expect(spies.rigid).not.toHaveBeenCalled();
    expect(rafQueue).toHaveLength(1);
    flushFrames();
    expect(spies.rigid).toHaveBeenCalledTimes(1);
    pointer('pointerup', { x: 130, y: 100 });
    expect(spies.commit).toHaveBeenCalledTimes(1);
    expect(spies.cancel).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    expect(useGizmoDragStore.getState().start).toBeNull();
    expect(orbit.current.enabled).toBe(true);
    expect(canvas.style.cursor).toBe('grab');
  });

  it('al soltar aplica la última posición aunque el cuadro no haya corrido', () => {
    const { start } = setup();
    start();
    pointer('pointermove', { x: 150, y: 100 });
    pointer('pointerup', { x: 150, y: 100 });
    expect(spies.rigid).toHaveBeenCalledTimes(1);
    expect(spies.commit).toHaveBeenCalledTimes(1);
  });

  it('Escape cancela: descarta el snapshot, cierra el gizmo y la cámara vuelve al soltar', () => {
    const { start, onClick } = setup();
    start();
    pointer('pointermove', { x: 150, y: 100 });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(spies.cancel).toHaveBeenCalledTimes(1);
    expect(spies.commit).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    expect(useGizmoDragStore.getState().start).toBeNull();
    expect(orbit.current.enabled).toBe(false);
    pointer('pointerup');
    expect(orbit.current.enabled).toBe(true);
  });

  it('pointercancel cancela sin confirmar', () => {
    const { start } = setup();
    start();
    pointer('pointermove', { x: 150, y: 100 });
    pointer('pointercancel');
    expect(spies.cancel).toHaveBeenCalledTimes(1);
    expect(spies.commit).not.toHaveBeenCalled();
    expect(orbit.current.enabled).toBe(true);
  });

  it('un segundo puntero abandona el movimiento', () => {
    const { start } = setup();
    start();
    pointer('pointermove', { x: 150, y: 100 });
    pointer('pointerdown', { id: 2 });
    expect(spies.cancel).toHaveBeenCalledTimes(1);
    expect(useGizmoDragStore.getState().start).toBeNull();
    pointer('pointerup', { id: 1 });
    expect(spies.commit).not.toHaveBeenCalled();
    expect(orbit.current.enabled).toBe(true);
  });

  it('ignora movimientos de otro puntero', () => {
    const { start } = setup();
    start();
    pointer('pointermove', { id: 2, x: 300, y: 300 });
    expect(useGizmoDragStore.getState().start).toBeNull();
    pointer('pointerup', { id: 1 });
  });

  it('perder el foco de la ventana cancela el gesto', () => {
    const { start } = setup();
    start();
    pointer('pointermove', { x: 150, y: 100 });
    window.dispatchEvent(new Event('blur'));
    expect(spies.cancel).toHaveBeenCalledTimes(1);
    expect(useGizmoDragStore.getState().start).toBeNull();
    expect(canvas.style.cursor).toBe('grab');
  });

  it('perder la captura del puntero cancela el gesto', () => {
    const { start } = setup();
    start();
    pointer('pointermove', { x: 150, y: 100 });
    const ev = new Event('lostpointercapture');
    Object.assign(ev, { pointerId: 1 });
    canvas.dispatchEvent(ev);
    expect(spies.cancel).toHaveBeenCalledTimes(1);
  });

  it('desmontar a mitad del gesto cancela, cierra el gizmo y reactiva la cámara', () => {
    const { start, unmount } = setup();
    start();
    pointer('pointermove', { x: 150, y: 100 });
    expect(useGizmoDragStore.getState().start).not.toBeNull();
    unmount();
    expect(spies.cancel).toHaveBeenCalledTimes(1);
    expect(spies.commit).not.toHaveBeenCalled();
    expect(useGizmoDragStore.getState().start).toBeNull();
    expect(orbit.current.enabled).toBe(true);
    expect(rafQueue).toHaveLength(0);
  });

  it('si el objeto se borra a mitad del gesto, el siguiente cuadro lo cancela', () => {
    const { start } = setup();
    start();
    pointer('pointermove', { x: 150, y: 100 });
    useKuraStore.setState({ objects: [] } as never);
    flushFrames();
    expect(spies.rigid).not.toHaveBeenCalled();
    expect(spies.cancel).toHaveBeenCalledTimes(1);
  });

  it('con todo bloqueado avisa y no mueve', () => {
    useKuraStore.setState({ objects: [obj('a', true)] } as never);
    const addToast = vi.fn();
    useKuraStore.setState({ addToast } as never);
    const { start } = setup();
    start();
    pointer('pointermove', { x: 150, y: 100 });
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(spies.rigid).not.toHaveBeenCalled();
    expect(useGizmoDragStore.getState().start).toBeNull();
  });

  it('Ctrl con rejilla libre ajusta a 1 mm; sin Ctrl no', () => {
    const { start } = setup();
    start();
    pointer('pointermove', { x: 123, y: 100, ctrl: true });
    flushFrames();
    const withCtrl = (spies.rigid.mock.calls[0][0] as { translate: number[] }).translate;
    expect(Number.isInteger(withCtrl[0])).toBe(true);
    pointer('pointermove', { x: 123, y: 100, ctrl: false });
    flushFrames();
    const free = (spies.rigid.mock.calls[1][0] as { translate: number[] }).translate;
    expect(Number.isInteger(free[0])).toBe(false);
    pointer('pointerup');
  });

  it('gesto de solo clic: un clic cambia la selección; un arrastre no y deja la cámara en paz', () => {
    const { start, onClick } = setup();
    start({ moveEnabled: false });
    expect(orbit.current.enabled).toBe(true);
    pointer('pointermove', { x: 150, y: 100 });
    pointer('pointerup', { x: 150, y: 100 });
    expect(onClick).not.toHaveBeenCalled();
    expect(spies.rigid).not.toHaveBeenCalled();
    expect(orbit.current.enabled).toBe(true);

    start({ moveEnabled: false });
    pointer('pointermove', { x: 101, y: 100 });
    pointer('pointerup', { x: 101, y: 100 });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
