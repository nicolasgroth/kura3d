/**
 * @file src/components/viewport/FloatingBarTracker.tsx
 * @description Seguidor de la barra flotante, dentro del Canvas: en cada cuadro, solo si hay barra y algo cambió (cámara,
 * selección, objetos, tamaño del visor o de la barra), proyecta la caja de la selección y escribe la posición en
 * `style.transform` de la barra (sin renderizar React por cuadro). También la oculta (`data-busy`) mientras se arrastra un
 * objeto, el manipulador o la cámara, y la devuelve tras un retardo corto al soltar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { extentIntersectsViewport, placeFloatingBar, screenExtent, type Obstacle, type ScreenPoint } from '../../core/scene/floatingBarPlacement';
import { FLOATING_BAR_REVEAL_DELAY_MS } from '../../store/floatingBarState';
import { useGizmoDragStore } from '../../store/gizmoDragStore';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { floatingBarBridge } from './floatingBarBridge';
import { useTopInsetCache } from './topInsetCache';

const localBoxes = new WeakMap<object, THREE.Box3 | null>();

/** Caja local de la malla, calculada una vez por arreglo de posiciones. */
function localBox(obj: SceneObject): THREE.Box3 | null {
  const positions = obj.mesh.positions;
  if (localBoxes.has(positions)) return localBoxes.get(positions) ?? null;
  const box = positions.length >= 3 ? new THREE.Box3().setFromArray(positions) : null;
  localBoxes.set(positions, box);
  return box;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Vector3();

/** Caja en mundo que envuelve a los objetos seleccionados (null si ninguno tiene malla). */
export function selectionWorldBox(objects: readonly SceneObject[], selectedIds: readonly string[], out = new THREE.Box3()): THREE.Box3 | null {
  out.makeEmpty();
  const ids = new Set(selectedIds);
  for (const obj of objects) {
    if (!ids.has(obj.id)) continue;
    const box = localBox(obj);
    if (!box) continue;
    _e.set(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ');
    _m.compose(_p.set(obj.position[0], obj.position[1], obj.position[2]), _q.setFromEuler(_e), _s.set(obj.scale[0], obj.scale[1], obj.scale[2]));
    for (let i = 0; i < 8; i += 1) {
      _c.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(_m);
      out.expandByPoint(_c);
    }
  }
  return out.isEmpty() ? null : out;
}

/** Selectores de la interfaz fija sobre el visor que la barra flotante no debe tapar. */
const OBSTACLE_SELECTORS: string[] = [];

/** Rectángulos (relativos al visor) de las zonas fijas visibles. */
function fixedObstacles(wrap: HTMLElement | null): Obstacle[] {
  if (!wrap) return [];
  const origin = wrap.getBoundingClientRect();
  const out: Obstacle[] = [];
  for (const sel of OBSTACLE_SELECTORS) {
    const node = document.querySelector(sel);
    if (!node) continue;
    const r = node.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    out.push({ left: r.left - origin.left, right: r.right - origin.left, top: r.top - origin.top, bottom: r.bottom - origin.top });
  }
  return out;
}

export const FloatingBarTracker = () => {
  const gl = useThree((s) => s.gl);
  const scratch = useMemo(
    () => ({ box: new THREE.Box3(), v: new THREE.Vector3(), view: new THREE.Vector3(), points: Array.from({ length: 8 }, (): ScreenPoint => ({ x: 0, y: 0, inFront: true })) }),
    [],
  );
  const last = useRef({ objects: null as unknown, selected: null as unknown, w: 0, h: 0, version: -1, matrix: new Float32Array(16), proj: new Float32Array(16), obstacle: '', busy: null as boolean | null, el: null as HTMLElement | null });
  const busy = useRef({ pointer: false, drag: false, hidden: false, timer: 0 as unknown as ReturnType<typeof setTimeout> });

  // Ocultar mientras se arrastra (puntero sobre el lienzo o arrastre del manipulador / del objeto); reaparece con retardo.
  useEffect(() => {
    const state = busy.current;
    const sync = () => {
      clearTimeout(state.timer);
      if (state.pointer || state.drag) {
        state.hidden = true;
        return;
      }
      state.timer = setTimeout(() => {
        state.hidden = false;
      }, FLOATING_BAR_REVEAL_DELAY_MS);
    };
    const down = () => {
      state.pointer = true;
      state.hidden = true;
      sync();
    };
    const up = () => {
      if (!state.pointer) return;
      state.pointer = false;
      sync();
    };
    const canvas = gl.domElement;
    canvas.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    window.addEventListener('blur', up);
    const unsub = useGizmoDragStore.subscribe((s) => {
      const dragging = s.start !== null;
      if (dragging === state.drag) return;
      state.drag = dragging;
      if (dragging) state.hidden = true;
      sync();
    });
    return () => {
      clearTimeout(state.timer);
      canvas.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      window.removeEventListener('blur', up);
      unsub();
    };
  }, [gl]);

  // Inset superior cacheado: se mide solo cuando cambia el tamaño del HUD o del visor, no en cada cuadro.
  const insetCache = useTopInsetCache();

  useFrame(({ camera, size }) => {
    const el = floatingBarBridge.el;
    if (!el) return;
    const b = busy.current;
    // Barra nueva (remontada): vuelve a escribir su estado de ocultación.
    if (last.current.el !== el) {
      last.current.el = el;
      last.current.busy = null;
    }
    const hidden = b.hidden;
    if (last.current.busy !== hidden) {
      last.current.busy = hidden;
      el.dataset.busy = hidden ? 'true' : 'false';
    }
    // Sin cambios (o durante un arrastre, que la deja oculta) no se proyecta nada.
    if (hidden && el.dataset.placed === 'true') return;

    const { objects, selectedIds } = useKuraStore.getState();
    const l = last.current;
    camera.updateMatrixWorld();
    const mw = camera.matrixWorld.elements;
    const pm = camera.projectionMatrix.elements;
    // Zonas fijas que la barra evita: el rótulo de la vista (Armado / Libre) con su deslizador «Separación».
    const obstacles = fixedObstacles(el.parentElement);
    const obstacleKey = obstacles.map((o) => `${Math.round(o.left)},${Math.round(o.top)},${Math.round(o.right)},${Math.round(o.bottom)}`).join('|');
    let same = l.obstacle === obstacleKey && l.objects === objects && l.selected === selectedIds && l.w === size.width && l.h === size.height && l.version === floatingBarBridge.version;
    for (let i = 0; same && i < 16; i += 1) if (l.matrix[i] !== mw[i] || l.proj[i] !== pm[i]) same = false;
    if (same && el.dataset.placed === 'true') return;
    l.obstacle = obstacleKey;
    l.objects = objects;
    l.selected = selectedIds;
    l.w = size.width;
    l.h = size.height;
    l.version = floatingBarBridge.version;
    for (let i = 0; i < 16; i += 1) {
      l.matrix[i] = mw[i];
      l.proj[i] = pm[i];
    }

    const box = selectionWorldBox(objects, selectedIds, scratch.box);
    if (!box) {
      el.dataset.offscreen = 'true';
      return;
    }
    const { v, view, points } = scratch;
    for (let i = 0; i < 8; i += 1) {
      v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      const pt = points[i];
      pt.inFront = view.copy(v).applyMatrix4(camera.matrixWorldInverse).z < 0;
      v.project(camera);
      pt.x = (v.x * 0.5 + 0.5) * size.width;
      pt.y = (-v.y * 0.5 + 0.5) * size.height;
    }
    const extent = screenExtent(points);
    const viewport = { width: size.width, height: size.height };
    if (!extent || !extentIntersectsViewport(extent, viewport)) {
      el.dataset.offscreen = 'true';
      return;
    }
    // Franja fija de la interfaz en el borde superior del visor (barra de vista): la barra no se coloca debajo de ella.
    const topInset = insetCache.current?.get(el.parentElement) ?? 0;
    const placed = placeFloatingBar({ extent, bar: { width: floatingBarBridge.width, height: floatingBarBridge.height }, viewport, topInset, obstacles });
    el.style.transform = `translate3d(${Math.round(placed.x)}px, ${Math.round(placed.y)}px, 0)`;
    el.dataset.side = placed.side;
    el.dataset.offscreen = 'false';
    el.dataset.placed = 'true';
  });

  return null;
};
