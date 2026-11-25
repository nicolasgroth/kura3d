/**
 * @file src/core/operations/keyholeRetention.ts
 * @description ¿El labio del ojo de cerradura retiene la cabeza? Con el material real de la pieza: el volumen del
 * disco de la cabeza (diámetro declarado) en el extremo de la ranura, a la altura del labio, que queda de la pieza
 * tras restar el negativo (lo que la cabeza tendría que atravesar para salir hacia afuera), comparado con el mismo
 * volumen en una pared infinita. Es la sonda del evaluador hecha regla. Usa Manifold: corre en el Worker.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../engine';
import type { MeshData, Vec3 } from '../../types/kura';
import type { KeyholeParams } from '../addons/keyhole';
import { stadiumLoftMesh } from '../addons/stadiumMesh';

/**
 * Fracción mínima del labio ideal que debe quedar para que la cabeza no salga. Cada lado del cuello aporta la mitad
 * del labio: con 0,5 o menos falta un lado entero y la cabeza se inclina y sale; 0,6 admite recortar parte de un lado
 * (ojo cerca de un borde, que ya se avisa) pero no perderlo.
 */
export const KEYHOLE_MIN_RETENTION_RATIO = 0.6;

export interface KeyholeRetention {
  /** Material del labio que sujeta la cabeza en el extremo de la ranura (mm³). */
  retentionMm3: number;
  /** El mismo volumen en una pared infinita (mm³). */
  idealMm3: number;
  /** true si `retentionMm3 ≥ KEYHOLE_MIN_RETENTION_RATIO · idealMm3`. */
  retained: boolean;
}

/**
 * @param hostWorld Malla de mundo de la pieza.
 * @param negativeLocal Negativo unido (coordenadas locales del ojo).
 * @param pose Posición y rotación del ojo (escala 1).
 */
export async function keyholeRetention(
  hostWorld: MeshData,
  negativeLocal: MeshData,
  params: KeyholeParams,
  pose: { position: Vec3; rotation: Vec3 },
): Promise<KeyholeRetention> {
  const wasm = await engine.initManifoldEngine();
  const disc = stadiumLoftMesh({ straightMm: 0, rings: [{ y: -params.lipMm, radius: params.headDiameterMm / 2 }, { y: 0, radius: params.headDiameterMm / 2 }] });
  const discLocal = { positions: disc.positions.slice(), indices: disc.indices };
  for (let i = 0; i < discLocal.positions.length; i += 3) discLocal.positions[i] += params.slotLengthMm;
  const toWorld = (m: MeshData) => engine.applyTransformToMesh(m, pose.position, pose.rotation, [1, 1, 1]);
  const live: Array<{ delete: () => void }> = [];
  const keep = <T extends { delete: () => void }>(m: T): T => { live.push(m); return m; };
  try {
    const host = keep(engine.meshDataToManifold(wasm, hostWorld));
    const neg = keep(engine.meshDataToManifold(wasm, toWorld(negativeLocal)));
    const discW = keep(engine.meshDataToManifold(wasm, toWorld(discLocal)));
    const ideal = keep(discW.subtract(neg));
    const real = keep(keep(host.intersect(discW)).subtract(neg));
    const idealMm3 = ideal.volume();
    const retentionMm3 = real.volume();
    return { retentionMm3, idealMm3, retained: retentionMm3 >= KEYHOLE_MIN_RETENTION_RATIO * idealMm3 };
  } finally {
    for (const m of live) m.delete();
  }
}
