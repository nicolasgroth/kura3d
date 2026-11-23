/**
 * @file src/components/viewport/CameraController.tsx
 * @description Controlador de cámara del visor: presets de vista, encuadre exacto (campo de visión y
 * aspecto reales). La cámara solo se mueve por: crear o importar (encuadre con margen), cambiar de vista,
 * Encuadrar (F), enfocar una unión o pieza nueva, y cuando lo nuevo o editado queda fuera de vista. Abrir
 * paneles no la mueve. Incluye el encuadre automático tras operaciones que crean, importan o mueven geometría,
 * con una transición corta que respeta `prefers-reduced-motion`. La política vive en
 * `core/scene/cameraFraming.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { type CameraPresetType, useKuraStore } from '../../store/useKuraStore';
import {
  boxForObjects,
  candidateViewDirs,
  chooseUnoccludedViewDir,
  framePose,
  isBoxInView,
  needsReframeAfterEdit,
  type FrameBox,
  type Vec3,
} from '../../core/scene/cameraFraming';
import { measureViewportInsets } from './viewportInsets';
import { clipPlanesFor, isViewPreset, VIEW_PRESET_DIRS } from '../../core/scene/viewPresets';
import { explodedSplitPositions, splitGroupOf } from '../../core/scene/splitGroups';
import type { SceneObject } from '../../types/kura';

const ISO_DIR: Vec3 = VIEW_PRESET_DIRS.iso;
const TRANSITION_MS = 380;
const MIN_DISTANCE = 18;
/** Ventana en la que un encuadre explícito del store manda sobre el automático por objetos nuevos. */
const EXPLICIT_WINDOW_MS = 250;
/** Con el área libre medida, el margen extra para las barras flotantes ya no hace falta entero. */
const INSET_MARGIN = 1.4;
/** Al crear o importar, el objeto nuevo ocupa ~45 % del visor (margen generoso en vez de pegarlo a los bordes). */
const NEW_OBJECT_MARGIN = 2.2;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

interface Transition {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  start: number;
}

export const CameraController: React.FC<{
  orbitRef: React.RefObject<OrbitControlsImpl | null>;
}> = ({ orbitRef }) => {
  const { camera, size, gl } = useThree();
  const cameraRequest = useKuraStore((s) => s.cameraRequest);
  const objects = useKuraStore((s) => s.objects);
  const splitExplode = useKuraStore((s) => s.splitExplode);
  const transition = useRef<Transition | null>(null);
  const lastExplicitAt = useRef(0);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  /** Radio de la escena visible (con la cama) para ajustar los planos de recorte. */
  const sceneRadius = (): number => {
    const { objects: cur, printerProfile } = useKuraStore.getState();
    const box = boxForObjects(cur);
    const bed = Math.hypot(printerProfile.bedWidthMm, printerProfile.bedDepthMm) / 2;
    if (!box) return bed;
    return Math.max(bed, ...box.min.map(Math.abs), ...box.max.map(Math.abs));
  };

  const currentTarget = (): THREE.Vector3 =>
    orbitRef.current ? orbitRef.current.target.clone() : new THREE.Vector3(0, 15, 0);

  const moveTo = (position: Vec3, target: Vec3) => {
    const toPos = new THREE.Vector3(...position);
    const toTarget = new THREE.Vector3(...target);
    const persp = camera as THREE.PerspectiveCamera;
    if (persp.isPerspectiveCamera) {
      const clip = clipPlanesFor(toPos.distanceTo(toTarget), sceneRadius());
      if (Math.abs(persp.near - clip.near) > 1e-6 || Math.abs(persp.far - clip.far) > 1e-6) {
        persp.near = clip.near;
        persp.far = clip.far;
        persp.updateProjectionMatrix();
      }
    }
    if (prefersReducedMotion()) {
      transition.current = null;
      camera.position.copy(toPos);
      if (orbitRef.current) {
        orbitRef.current.target.copy(toTarget);
        orbitRef.current.update();
      } else camera.lookAt(toTarget);
      return;
    }
    transition.current = {
      fromPos: camera.position.clone(),
      toPos,
      fromTarget: currentTarget(),
      toTarget,
      start: performance.now(),
    };
  };

  /**
   * Encuadra la caja dentro del área libre del visor. `ensure`: no hace nada si ya está entera a la
   * vista. `focus`: encuadra siempre y busca una dirección desde la que `blockers` no la tapen.
   */
  const frameBox = (box: FrameBox, mode: 'fit' | 'ensure' | 'scene' | 'focus', blockers: FrameBox[] = [], margin = INSET_MARGIN) => {
    const persp = camera as THREE.PerspectiveCamera;
    const aspect = sizeRef.current.height > 0 ? sizeRef.current.width / sizeRef.current.height : persp.aspect;
    if (mode === 'ensure') {
      camera.updateMatrixWorld();
      const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      // Visible = entera en el área que no tapan los paneles (no basta con estar en el lienzo).
      // `measureViewportInsets` devuelve fracciones del lienzo; `isBoxInView` las espera en píxeles.
      const { width, height } = sizeRef.current;
      const frac = measureViewportInsets(gl.domElement);
      const free = {
        insets: { top: frac.top * height, bottom: frac.bottom * height, left: frac.left * width, right: frac.right * width },
        width,
        height,
      };
      if (isBoxInView(box, vp.elements, undefined, free)) return;
    }
    const fit = {
      box,
      fovDeg: persp.fov ?? 42,
      aspect,
      insets: measureViewportInsets(gl.domElement),
      margin,
      minDistance: Math.max(MIN_DISTANCE, orbitRef.current?.minDistance ?? 0),
      maxDistance: orbitRef.current?.maxDistance ?? Infinity,
    };
    const current = camera.position.clone().sub(currentTarget()).toArray() as Vec3;
    const dir = mode === 'scene'
      ? ISO_DIR
      : mode === 'focus'
        ? chooseUnoccludedViewDir({ ...fit, candidates: candidateViewDirs(current), blockers })
        : current;
    const pose = framePose({ ...fit, viewDir: dir });
    moveTo(pose.position, pose.target);
  };

  useFrame(() => {
    const tr = transition.current;
    if (!tr) return;
    const k = Math.min(1, (performance.now() - tr.start) / TRANSITION_MS);
    const e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(tr.fromPos, tr.toPos, e);
    const target = new THREE.Vector3().lerpVectors(tr.fromTarget, tr.toTarget, e);
    if (orbitRef.current) {
      orbitRef.current.target.copy(target);
      orbitRef.current.update();
    } else camera.lookAt(target);
    if (k >= 1) transition.current = null;
  });

  // El usuario toma el control: cualquier giro o zoom cancela la transición en curso.
  useEffect(() => {
    const controls = orbitRef.current;
    if (!controls) return;
    const cancel = () => {
      transition.current = null;
    };
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [orbitRef]);

  // Peticiones explícitas (botones de vista, F, abrir/recuperar, operaciones que mueven piezas).
  useEffect(() => {
    if (!cameraRequest) return;
    lastExplicitAt.current = performance.now();
    const { objects: cur, selectedIds, printerProfile } = useKuraStore.getState();
    const preset: CameraPresetType = cameraRequest.preset;

    if (preset === 'focus') {
      const ids = new Set(cameraRequest.ids ?? []);
      const box = boxForObjects(cur.filter((o) => ids.has(o.id)));
      if (!box) return;
      const blockers = cur
        .filter((o) => !ids.has(o.id) && o.visible !== false)
        .map((o) => boxForObjects([o]))
        .filter((b): b is FrameBox => b !== null);
      frameBox(box, 'focus', blockers);
      return;
    }

    if (preset === 'fit' || preset === 'scene' || preset === 'ensure') {
      const ids = cameraRequest.ids;
      // `fit` con ids = objeto recién creado o importado: se encuadra con margen generoso.
      const fitNew = preset === 'fit' && Boolean(ids && ids.length > 0);
      const focus = (preset === 'ensure' || fitNew) && ids
        ? cur.filter((o) => ids.includes(o.id))
        : preset === 'fit' && selectedIds.length > 0
          ? cur.filter((o) => selectedIds.includes(o.id))
          : cur;
      const box = boxForObjects(focus);
      if (box) {
        frameBox(box, preset, [], fitNew ? NEW_OBJECT_MARGIN : INSET_MARGIN);
        return;
      }
      if (preset === 'ensure') return;
    }

    if (!isViewPreset(preset)) return;
    const dir = VIEW_PRESET_DIRS[preset];
    // Cambiar de vista encuadra la selección (o toda la escena) desde esa dirección, con margen.
    const selected = cur.filter((o) => selectedIds.includes(o.id) && o.visible !== false);
    const content = boxForObjects(selected.length > 0 ? selected : cur.filter((o) => o.visible !== false));
    const halfW = printerProfile.bedWidthMm / 2;
    const halfD = printerProfile.bedDepthMm / 2;
    // Sin objetos: la cama entera.
    const box: FrameBox = content ?? { min: [-halfW, 0, -halfD], max: [halfW, 30, halfD] };
    const persp = camera as THREE.PerspectiveCamera;
    const aspect = sizeRef.current.height > 0 ? sizeRef.current.width / sizeRef.current.height : persp.aspect;
    const pose = framePose({
      box,
      viewDir: dir,
      fovDeg: persp.fov ?? 42,
      aspect,
      insets: measureViewportInsets(gl.domElement),
      margin: INSET_MARGIN,
      minDistance: Math.max(MIN_DISTANCE, orbitRef.current?.minDistance ?? 0),
      maxDistance: orbitRef.current?.maxDistance ?? Infinity,
    });
    moveTo(pose.position, pose.target);
    // frameBox/moveTo leen refs estables; solo la petición dispara el efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraRequest, camera, orbitRef]);

  // Encuadre automático. Piezas nuevas (crear, importar, cortar, proyectar, molde, chat): se
  // aseguran a la vista. Objetos editados (malla, escala o giro): la cámara no salta salvo que el
  // objeto quede fuera de proporción (cámara dentro de su caja, > 150 % o < 3 % del encuadre).
  const prevRef = useRef<Map<string, Pick<SceneObject, 'mesh' | 'scale' | 'rotation'>> | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = new Map(objects.map((o) => [o.id, { mesh: o.mesh, scale: o.scale, rotation: o.rotation }] as const));
    if (!prev) return;
    const added = objects.filter((o) => !prev.has(o.id));
    const edited = objects.filter((o) => {
      const p = prev.get(o.id);
      return p !== undefined && (p.mesh !== o.mesh || p.scale !== o.scale || p.rotation !== o.rotation);
    });
    if (added.length === 0 && edited.length === 0) return;
    const wasEmpty = prev.size === 0;
    const handle = requestAnimationFrame(() => {
      if (performance.now() - lastExplicitAt.current < EXPLICIT_WINDOW_MS) return;
      if (added.length > 0) {
        const box = boxForObjects(added);
        if (box) frameBox(box, wasEmpty ? 'fit' : 'ensure', [], NEW_OBJECT_MARGIN);
        return;
      }
      const box = boxForObjects(edited);
      if (!box) return;
      camera.updateMatrixWorld();
      const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      if (needsReframeAfterEdit(box, camera.position.toArray() as Vec3, vp.elements)) frameBox(box, 'fit');
    });
    return () => cancelAnimationFrame(handle);
    // Solo cuando cambian los objetos; `frameBox` y la cámara se leen vigentes dentro del frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects]);

  // Vista explosionada: al empezar, se asegura que el grupo totalmente separado quepa en cuadro,
  // así el encuadre sigue a las piezas durante toda la animación.
  const explodeGroup = splitExplode?.groupId ?? null;
  useEffect(() => {
    if (!explodeGroup) return;
    const cur = useKuraStore.getState().objects;
    const member = cur.find((o) => o.metadata?.split?.groupId === explodeGroup);
    const group = member ? splitGroupOf(cur, member.id) : null;
    if (!group) return;
    const positions = explodedSplitPositions(group, 1);
    const exploded = group.parts.map((p) => ({ ...p, position: positions.get(p.id) ?? p.position }));
    const box = boxForObjects([...group.parts, ...exploded]);
    if (box) frameBox(box, 'ensure');
    // Solo al empezar la vista explosionada de un grupo; el estado se lee con `getState()`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explodeGroup]);

  return null;
};
