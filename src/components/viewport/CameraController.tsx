/**
 * @file src/components/viewport/CameraController.tsx
 * @description Controlador de cámara del visor: presets de vista, encuadre exacto (campo de visión y
 * aspecto reales) y encuadre automático tras operaciones que crean, importan o mueven geometría,
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
import { boxForObjects, framePose, isBoxInView, type FrameBox, type Vec3 } from '../../core/scene/cameraFraming';
import { explodedSplitPositions, splitGroupOf } from '../../core/scene/splitGroups';
import type { SceneObject } from '../../types/kura';

const ISO_DIR: Vec3 = [0.72, 0.62, 0.85];
const TRANSITION_MS = 380;
const MIN_DISTANCE = 18;
/** Ventana en la que un encuadre explícito del store manda sobre el automático por objetos nuevos. */
const EXPLICIT_WINDOW_MS = 250;

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
  const { camera, size } = useThree();
  const cameraRequest = useKuraStore((s) => s.cameraRequest);
  const objects = useKuraStore((s) => s.objects);
  const splitExplode = useKuraStore((s) => s.splitExplode);
  const transition = useRef<Transition | null>(null);
  const lastExplicitAt = useRef(0);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const currentTarget = (): THREE.Vector3 =>
    orbitRef.current ? orbitRef.current.target.clone() : new THREE.Vector3(0, 15, 0);

  const moveTo = (position: Vec3, target: Vec3) => {
    const toPos = new THREE.Vector3(...position);
    const toTarget = new THREE.Vector3(...target);
    const distance = toPos.distanceTo(toTarget);
    const persp = camera as THREE.PerspectiveCamera;
    if (persp.isPerspectiveCamera && persp.far < distance * 4) {
      persp.far = distance * 4;
      persp.updateProjectionMatrix();
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

  /** Encuadra la caja. En modo `ensure` no hace nada si ya está entera a la vista. */
  const frameBox = (box: FrameBox, mode: 'fit' | 'ensure' | 'scene') => {
    const persp = camera as THREE.PerspectiveCamera;
    const aspect = sizeRef.current.height > 0 ? sizeRef.current.width / sizeRef.current.height : persp.aspect;
    if (mode === 'ensure') {
      camera.updateMatrixWorld();
      const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      if (isBoxInView(box, vp.elements)) return;
    }
    const dir = mode === 'scene'
      ? ISO_DIR
      : (camera.position.clone().sub(currentTarget()).toArray() as Vec3);
    const pose = framePose({
      box,
      viewDir: dir,
      fovDeg: persp.fov ?? 42,
      aspect,
      minDistance: Math.max(MIN_DISTANCE, orbitRef.current?.minDistance ?? 0),
      maxDistance: orbitRef.current?.maxDistance ?? Infinity,
    });
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

    if (preset === 'fit' || preset === 'scene' || preset === 'ensure') {
      const ids = cameraRequest.ids;
      const focus = preset === 'ensure' && ids
        ? cur.filter((o) => ids.includes(o.id))
        : preset === 'fit' && selectedIds.length > 0
          ? cur.filter((o) => selectedIds.includes(o.id))
          : cur;
      const box = boxForObjects(focus);
      if (box) {
        frameBox(box, preset);
        return;
      }
      if (preset === 'ensure') return;
    }

    const target: Vec3 = [0, 15, 0];
    const distance = Math.max(130, printerProfile.bedWidthMm * 0.65);
    let position: Vec3;
    switch (preset) {
      case 'top':
        position = [target[0], target[1] + distance * 1.3, target[2] + 0.01];
        break;
      case 'front':
        position = [target[0], target[1] + distance * 0.15, target[2] + distance * 1.25];
        break;
      case 'right':
        position = [target[0] + distance * 1.25, target[1] + distance * 0.15, target[2]];
        break;
      default:
        position = [target[0] + distance * 0.72, target[1] + distance * 0.62, target[2] + distance * 0.85];
    }
    moveTo(position, target);
    // frameBox/moveTo leen refs estables; solo la petición dispara el efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraRequest, camera, orbitRef]);

  // Encuadre automático: piezas nuevas (crear, importar, cortar, dividir, proyectar, molde, chat)
  // o con malla cambiada que hayan quedado fuera de cuadro.
  const prevRef = useRef<Map<string, SceneObject['mesh']> | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    const next = new Map(objects.map((o) => [o.id, o.mesh] as const));
    prevRef.current = next;
    if (!prev) return;
    const affected = objects.filter((o) => prev.get(o.id) !== o.mesh);
    if (affected.length === 0) return;
    const wasEmpty = prev.size === 0;
    const handle = requestAnimationFrame(() => {
      if (performance.now() - lastExplicitAt.current < EXPLICIT_WINDOW_MS) return;
      const box = boxForObjects(affected);
      if (box) frameBox(box, wasEmpty ? 'fit' : 'ensure');
    });
    return () => cancelAnimationFrame(handle);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explodeGroup]);

  return null;
};
