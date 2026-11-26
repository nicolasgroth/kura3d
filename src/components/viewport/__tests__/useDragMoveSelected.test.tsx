/**
 * @file src/components/viewport/__tests__/useDragMoveSelected.test.tsx
 * @description Pruebas del gesto de arrastrar para mover: umbral, clic sin arrastre, Escape, pointercancel,
 * segundo puntero, blur, desmontaje, cursor, Ctrl con rejilla libre, gesto de solo clic y que la cámara
 * (OrbitControls) vuelva a quedar activa al soltar. Cámara y lienzo simulados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
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

function pointer(type: string, init: { id?: number; x?: number; y?: number; ctrl?: boolean; shiftKey?: boolean } = {}) {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>;
  Object.assign(ev, { pointerId: init.id ?? 1, clientX: init.x ?? 0, clientY: init.y ?? 0, ctrlKey: !!init.ctrl, metaKey: false, shiftKey: !!init.shiftKey, altKey: false });
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
    // El cursor de «agarrar» es del objeto: al soltar no queda pegado (el objeto lo repone si el puntero sigue encima).
    expect(canvas.style.cursor).toBe('');
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
    expect(canvas.style.cursor).toBe('');
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

  describe('sentido y magnitud (cámara conocida: en (0,500,500) mirando al origen, fov 50, lienzo 200x200)', () => {
    const lastTranslate = () => {
      const calls = spies.rigid.mock.calls;
      return (calls[calls.length - 1][0] as { translate: number[] }).translate;
    };
    const tanHalf = Math.tan((25 * Math.PI) / 180);
    const f = Math.SQRT1_2;

    it('50 px a la derecha mueven +X exactamente lo que predice la geometría y nada en Z', () => {
      const { start } = setup();
      start();
      pointer('pointermove', { x: 150, y: 100 });
      flushFrames();
      // rayo = adelante + 0,5·tan(25°)·derecha, desde y=500: corta y=0 en t = 500/f.
      const expectedX = 0.5 * tanHalf * (500 / f);
      const [dx, dy, dz] = lastTranslate();
      expect(dx).toBeCloseTo(expectedX, 4);
      expect(dx).toBeGreaterThan(0);
      expect(dy).toBe(0);
      expect(Math.abs(dz)).toBeLessThan(1e-6);
    });

    it('50 px hacia abajo (hacia la cámara) mueven +Z; hacia arriba, -Z', () => {
      const { start } = setup();
      start();
      pointer('pointermove', { x: 100, y: 150 });
      flushFrames();
      // ndcY = -0,5; arriba de cámara = (0, f, -f): dir = adelante - 0,5·tan·arriba.
      const dirY = -f - 0.5 * tanHalf * f;
      const dirZ = -f + 0.5 * tanHalf * f;
      const t = 500 / -dirY;
      const expectedZ = 500 + dirZ * t;
      const down = lastTranslate();
      expect(down[2]).toBeCloseTo(expectedZ, 4);
      expect(down[2]).toBeGreaterThan(0);
      expect(Math.abs(down[0])).toBeLessThan(1e-6);
      pointer('pointermove', { x: 100, y: 50 });
      flushFrames();
      expect(lastTranslate()[2]).toBeLessThan(0);
    });
  });

  it('soltar sin desplazamiento neto (vuelta al punto de partida) cancela el paso de deshacer', () => {
    const { start } = setup();
    start();
    pointer('pointermove', { x: 150, y: 100 });
    flushFrames();
    pointer('pointermove', { x: 100, y: 100 });
    pointer('pointerup', { x: 100, y: 100 });
    expect(spies.commit).not.toHaveBeenCalled();
    expect(spies.cancel).toHaveBeenCalledTimes(1);
    expect(useGizmoDragStore.getState().start).toBeNull();
  });

  it('vista frontal (casi rasante al suelo): se mueve en el plano vertical, sin profundidad', () => {
    camera.position.set(0, 5, 1000);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const { start } = setup();
    start();
    pointer('pointermove', { x: 150, y: 50 });
    flushFrames();
    const [dx, , dz] = (spies.rigid.mock.calls.at(-1)?.[0] as { translate: [number, number, number] }).translate;
    expect(dx).not.toBe(0);
    expect(dz).toBe(0);
    expect(useGizmoDragStore.getState().plane).toBe('XZ');
    pointer('pointerup', { x: 150, y: 50 });
    expect(spies.commit).toHaveBeenCalledTimes(1);
    expect(useGizmoDragStore.getState().plane).toBeNull();
  });

  it('Mayús restringe al eje dominante del gesto', () => {
    camera.position.set(0, 5, 1000);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const { start } = setup();
    start();
    pointer('pointermove', { x: 160, y: 90, shiftKey: true });
    flushFrames();
    const [dx, dy, dz] = (spies.rigid.mock.calls.at(-1)?.[0] as { translate: [number, number, number] }).translate;
    expect(dx).not.toBe(0);
    expect(dy).toBe(0);
    expect(dz).toBe(0);
  });

  it('Esc cancela el arrastre vertical sin dejar paso de deshacer', () => {
    camera.position.set(0, 5, 1000);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const { start } = setup();
    start();
    pointer('pointermove', { x: 150, y: 50 });
    flushFrames();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(spies.commit).not.toHaveBeenCalled();
    expect(spies.cancel).toHaveBeenCalledTimes(1);
    expect(useGizmoDragStore.getState().plane).toBeNull();
  });

  it('con el motor ocupado no inicia el arrastre: la cámara sigue libre y el cursor no cambia', () => {
    useKuraStore.setState({ busyOperation: 'dividir' } as never);
    const { start, onClick } = setup();
    start();
    expect(orbit.current.enabled).toBe(true);
    pointer('pointermove', { x: 150, y: 100 });
    flushFrames();
    expect(canvas.style.cursor).toBe('grab');
    expect(spies.rigid).not.toHaveBeenCalled();
    pointer('pointerup', { x: 150, y: 100 });
    expect(onClick).not.toHaveBeenCalled();
    useKuraStore.setState({ busyOperation: null } as never);
  });

  it('la posición final queda dentro de la cama más un margen igual a su lado mayor', () => {
    useKuraStore.setState({ customBedDimensions: { width: 100, depth: 100, height: 100 } } as never);
    const { start } = setup();
    start();
    pointer('pointermove', { x: 200, y: 100 });
    flushFrames();
    const [dx] = (spies.rigid.mock.calls[0][0] as { translate: number[] }).translate;
    expect(dx).toBeCloseTo(50 + 100, 6);
    useKuraStore.setState({ customBedDimensions: null } as never);
  });

  it('pulsar o soltar Ctrl recalcula el ajuste a 1 mm sin mover el ratón', () => {
    const { start } = setup();
    start();
    pointer('pointermove', { x: 123, y: 100 });
    flushFrames();
    const free = (spies.rigid.mock.calls[0][0] as { translate: number[] }).translate[0];
    expect(Number.isInteger(free)).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', bubbles: true }));
    flushFrames();
    const snapped = (spies.rigid.mock.calls[1][0] as { translate: number[] }).translate[0];
    expect(Number.isInteger(snapped)).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', bubbles: true }));
    flushFrames();
    expect((spies.rigid.mock.calls[2][0] as { translate: number[] }).translate[0]).toBeCloseTo(free, 9);
    pointer('pointerup');
  });
});
