/**
 * @file src/components/viewport/viewCameraRegistry.ts
 * @description Registro de la posición actual de la cámara del visor, para que los paneles (p. ej.
 * proyección de texto) elijan por defecto la cara que el usuario está viendo sin acceder a three.js.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type CameraPositionGetter = () => [number, number, number];

let getter: CameraPositionGetter | null = null;

/** Registra (o quita con `null`) el lector de la posición de la cámara en mundo. */
export function registerViewCamera(next: CameraPositionGetter | null): void {
  getter = next;
}

/** Posición actual de la cámara en mundo (mm) o `undefined` si el visor no está montado. */
export function currentCameraPosition(): [number, number, number] | undefined {
  return getter?.();
}
