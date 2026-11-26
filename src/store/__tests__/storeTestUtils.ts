/**
 * @file src/store/__tests__/storeTestUtils.ts
 * @description Utilidades compartidas por las pruebas del store: escena limpia con el motor real
 * y creación rápida de cubos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { initManifoldEngine } from '../../engine';
import type { LanguageCode, ObjectRole, SceneObject, Vec3 } from '../../types/kura';
import { useKuraStore } from '../useKuraStore';

export const store = () => useKuraStore.getState();

/** Reinicia el store a una escena vacía con el motor Manifold listo. */
export async function resetStore(language: LanguageCode = 'es'): Promise<void> {
  await initManifoldEngine();
  // Cierra cualquier arrastre pendiente de una prueba anterior.
  useKuraStore.getState().commitTransformSnapshot();
  useKuraStore.setState({
    engineReady: true,
    engineError: null,
    busyOperation: null,
    objects: [],
    selectedIds: [],
    past: [],
    future: [],
    unitSystem: 'mm',
    language,
    toasts: [],
    activeSegmentation: null,
  });
}

/** Crea un cubo de `size` mm en `position` (base en Y=0) y lo devuelve. */
export async function addBox(
  size: number,
  position: Vec3 = [0, 0, 0],
  options: { role?: ObjectRole; name?: string } = {},
): Promise<SceneObject> {
  const box = await store().createPrimitive(
    'box',
    { width: size, height: size, depth: size },
    { position, role: options.role, name: options.name },
  );
  if (!box) throw new Error('No se pudo crear el cubo de prueba');
  return box;
}

/** Busca un objeto por ID en el estado actual. */
export const byId = (id: string) => store().objects.find((o) => o.id === id);
