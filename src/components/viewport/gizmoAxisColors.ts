/**
 * @file src/components/viewport/gizmoAxisColors.ts
 * @description Recolorea el gizmo de transformación para los ejes del usuario (Z arriba, como los slicers):
 * el eje vertical interno (Y de three.js) se pinta azul, como la Z del usuario, y el eje frente/fondo
 * (Z interno) verde, como la Y del usuario. X sigue rojo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { useCallback } from 'react';
import * as THREE from 'three';
import { orientGizmoToUserAxes } from './gizmoUserAxes';

const GREEN = 0x00ff00;
const BLUE = 0x0000ff;

type GizmoMaterial = THREE.Material & { color?: THREE.Color; tempColor?: THREE.Color; userData: Record<string, unknown> };

/** Intercambia verde y azul en los materiales del gizmo (una sola vez por material). */
export function swapGizmoAxisColors(root: THREE.Object3D | null | undefined): number {
  if (!root) return 0;
  let swapped = 0;
  const seen = new Set<THREE.Material>();
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    for (const raw of materials) {
      const material = raw as GizmoMaterial;
      if (seen.has(material) || material.userData.kuraUserAxes || !material.color) continue;
      seen.add(material);
      const hex = (material.tempColor ?? material.color).getHex();
      const next = hex === GREEN ? BLUE : hex === BLUE ? GREEN : null;
      material.userData.kuraUserAxes = true;
      if (next === null) continue;
      material.color.setHex(next);
      material.tempColor?.setHex(next);
      swapped += 1;
    }
  });
  return swapped;
}

/** Ref de callback para `<TransformControls>`: aplica los colores y el sentido de los ejes del usuario al montar. */
export function useUserAxisGizmoColors() {
  return useCallback((controls: THREE.Object3D | null) => {
    // `gizmo` es privado en los tipos de three-stdlib, pero es el contenedor de las manijas.
    if (!controls) return;
    swapGizmoAxisColors((controls as unknown as { gizmo?: THREE.Object3D }).gizmo ?? controls);
    // Flechas hacia el lado positivo de los ejes del usuario (Y+ = fondo), no hacia la cámara.
    orientGizmoToUserAxes(controls);
  }, []);
}
