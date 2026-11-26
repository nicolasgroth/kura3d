/**
 * @file src/engine/orient/orientPatches.ts
 * @description Candidatos de apoyo desde la propia malla para piezas orgánicas: agrupa los triángulos por normal
 * cuantizada (parches casi coplanares, celdas de ~1,1°), y para cada parche con área suficiente estima el
 * contacto real que tendría apoyado en la cama con esa normal hacia abajo (caras a menos de 1° de la vertical
 * cuyos tres vértices quedan en el plano de apoyo, el mismo criterio que `measureOrientation`). Devuelve las
 * direcciones de mayor contacto. Las caras del casco convexo no bastan en estas piezas: un fondo casi plano
 * de una figura queda partido en grupos chicos del casco o tapado por caras que puentean huecos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Vec3 } from '../../types/kura';
import type { OrientWorld } from './orientWorld';

/** Celda de cuantización de normales (por componente), como el agrupamiento del casco. */
const NORMAL_QUANTUM = 0.02;
/** Desplazamiento y paso de la clave numérica de una celda de normal. */
const KEY_HALF = 512;
const KEY_SPAN = 2 * KEY_HALF + 1;
/** Igual que el contacto medido: normal a menos de 1° de la vertical hacia abajo. */
const CONTACT_COS = Math.cos((1 * Math.PI) / 180);
/** Dos parches a menos de 2° se consideran la misma dirección. */
const SAME_COS = Math.cos((2 * Math.PI) / 180);
/** Parches que se evalúan a fondo (los de más área); acota el costo en mallas grandes. */
const MAX_EVALUATED = 32;

export interface PatchDirection {
  /** Normal promedio (por área) del parche: la dirección que iría hacia la cama. */
  down: Vec3;
  /** Contacto estimado (mm²) apoyando en esa dirección. */
  contactMm2: number;
}

/** Contacto estimado (mm²) apoyando la pieza con `n` hacia la cama. */
function contactAlong(world: OrientWorld, n: Vec3, tol: number): number {
  const hp = world.hullPoints;
  let top = -Infinity;
  for (let i = 0; i < hp.length; i += 3) top = Math.max(top, hp[i] * n[0] + hp[i + 1] * n[1] + hp[i + 2] * n[2]);
  const plane = top - tol;
  const p = world.positions, idx = world.indices, nr = world.normals, ar = world.areas;
  let area = 0;
  for (let t = 0; t < ar.length; t++) {
    if (nr[t * 3] * n[0] + nr[t * 3 + 1] * n[1] + nr[t * 3 + 2] * n[2] < CONTACT_COS) continue;
    let ok = true;
    for (let k = 0; k < 3 && ok; k++) {
      const v = idx[t * 3 + k] * 3;
      ok = p[v] * n[0] + p[v + 1] * n[1] + p[v + 2] * n[2] >= plane;
    }
    if (ok) area += ar[t];
  }
  return area;
}

/**
 * Hasta `maxCount` direcciones de apoyo con contacto real ≥ `minAreaMm2`, de mayor a menor contacto y
 * separadas al menos 2° entre sí.
 */
export function planarPatchDirections(world: OrientWorld, minAreaMm2: number, maxCount: number): PatchDirection[] {
  if (maxCount <= 0) return [];
  // Clave numérica por celda de normal (sin armar un texto por triángulo). Con normales unitarias cada índice queda
  // en ±1/NORMAL_QUANTUM (±50), muy dentro de ±KEY_HALF.
  const bins = new Map<number, { sx: number; sy: number; sz: number; area: number }>();
  const nr = world.normals, ar = world.areas;
  for (let t = 0; t < ar.length; t++) {
    const a = ar[t];
    if (!(a > 1e-12)) continue;
    const x = nr[t * 3], y = nr[t * 3 + 1], z = nr[t * 3 + 2];
    const key = ((Math.round(x / NORMAL_QUANTUM) + KEY_HALF) * KEY_SPAN + Math.round(y / NORMAL_QUANTUM) + KEY_HALF) * KEY_SPAN
      + Math.round(z / NORMAL_QUANTUM) + KEY_HALF;
    let b = bins.get(key);
    if (!b) bins.set(key, (b = { sx: 0, sy: 0, sz: 0, area: 0 }));
    b.sx += x * a; b.sy += y * a; b.sz += z * a; b.area += a;
  }
  const big = [...bins.values()].filter((b) => b.area >= minAreaMm2).sort((a, b) => b.area - a.area).slice(0, MAX_EVALUATED);
  const tol = Math.max(0.02, world.diag * 1e-4);
  const scored: PatchDirection[] = [];
  for (const b of big) {
    const len = Math.hypot(b.sx, b.sy, b.sz);
    if (!(len > 0)) continue;
    const down: Vec3 = [b.sx / len, b.sy / len, b.sz / len];
    const contactMm2 = contactAlong(world, down, tol);
    if (contactMm2 >= minAreaMm2) scored.push({ down, contactMm2 });
  }
  scored.sort((a, b) => b.contactMm2 - a.contactMm2);
  const out: PatchDirection[] = [];
  for (const s of scored) {
    if (out.length >= maxCount) break;
    if (out.some((o) => o.down[0] * s.down[0] + o.down[1] * s.down[1] + o.down[2] * s.down[2] > SAME_COS)) continue;
    out.push(s);
  }
  return out;
}
