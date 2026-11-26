/**
 * @file src/engine/split/splitConnectorRoom.ts
 * @description Registro global de los conectores ya colocados en una división ("dividir para
 * imprimir"). Cada unión se arma por separado, pero sus alojamientos atraviesan la pieza en
 * profundidad y pueden cruzarse con los de las uniones vecinas (p. ej. las uniones X, Y y Z que se
 * juntan en el centro de un cubo). Antes de aceptar un conector (o de agrandarlo por firmeza) se
 * comprueba, con el MISMO modelo que la validación de armado (`assemblyConnectors.ts`: cápsulas y
 * pared hasta la superficie), que deje la pared mínima contra el exterior de sus dos piezas y contra
 * todos los conectores de las DEMÁS uniones. `keepOut` da la zona prohibida (cápsulas infladas) que se
 * resta de la cara de unión para que la ubicación mueva los centros lejos de lo ya puesto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { MeshData, Vec3 } from '../../types/kura';
import { manifoldToMeshData } from '../manifoldKernel';
import { ASSEMBLY_LIMITS } from '../operationLimits';
import { capsules, exteriorWall, segmentDistance, type Capsule } from './assemblyConnectors';
import { worldPositions } from './assemblyVoxels';
import type { SplitBody } from './splitBodies';
import { orientedToWorld } from './splitLabels';
import { orientForAxis } from './splitSections';
import type { SplitAxis, SplitConnectorOptions } from './splitTypes';

/** Holgura sobre la pared mínima para no quedar justo en el borde de la validación (mm). */
const SAFETY_MM = 0.02;
const BIG = 1e5;

export class ConnectorRoom {
  private placed: Capsule[] = [];
  private world: Float64Array[] = [];
  private meshes: MeshData[] = [];

  constructor(readonly wallMm: number = ASSEMBLY_LIMITS.minWallMm) {}

  /** Malla lisa (sin conectores) de un cuerpo, indexada por su id, como la usa `exteriorWall`. */
  private ensure(b: SplitBody): void {
    if (this.meshes[b.id]) return;
    const mesh = manifoldToMeshData(b.m);
    this.meshes[b.id] = mesh;
    this.world[b.id] = worldPositions(mesh, [0, 0, 0], [0, 0, 0]);
  }

  /** Cápsulas que tendrían los conectores `c` en `centers` de una unión entre `low` y `high`. */
  capsulesFor(label: string, axis: SplitAxis, coord: number, c: SplitConnectorOptions, centers: Vec3[], low: SplitBody, high: SplitBody): Capsule[] {
    return capsules([{
      label, axis, position: coord, kind: 'connector', connector: c, connectorCenters: centers, contactAreaMm2: 0,
      a: { part: low.id, code: low.code }, b: { part: high.id, code: high.code },
    }]);
  }

  /** Por cápsula: `true` si deja la pared mínima hasta la superficie y hasta los conectores de otras uniones. */
  check(caps: Capsule[], low: SplitBody, high: SplitBody): boolean[] {
    this.ensure(low);
    this.ensure(high);
    const need = this.wallMm + SAFETY_MM;
    return caps.map((cap) => {
      for (const o of this.placed) {
        if (o.joint === cap.joint) continue;
        if (segmentDistance(cap.p, cap.q, o.p, o.q) - cap.r - o.r < need) return false;
      }
      return exteriorWall(cap, this.world, this.meshes, this.wallMm) >= need;
    });
  }

  /** Registra los conectores aceptados de una unión. */
  add(caps: Capsule[]): void {
    this.placed.push(...caps);
  }

  /** Quita los conectores de una unión (pasó a pegar o se rehízo). */
  remove(label: string): void {
    this.placed = this.placed.filter((c) => c.joint !== label);
  }

  /**
   * Zona prohibida para los ejes de un conector nuevo de radio `radius` (con holgura) que la ubicación
   * aleja `margin` del borde: las cápsulas ya puestas infladas a `r + radius + pared − margin`, solo las
   * que alcanzan el tramo `[from, to]` del eje de la unión. `null` si no hay ninguna cerca.
   */
  keepOut(wasm: ManifoldToplevel, axis: SplitAxis, from: number, to: number, radius: number, margin: number): Manifold | null {
    const a = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const solids: Manifold[] = [];
    for (const o of this.placed) {
      const grow = Math.max(0.05, o.r + radius + this.wallMm - margin) + 0.15;
      if (Math.min(o.p[a], o.q[a]) - grow > to || Math.max(o.p[a], o.q[a]) + grow < from) continue;
      const s = wasm.Manifold.sphere(grow, 24);
      const sp = s.translate(o.p);
      const sq = s.translate(o.q);
      solids.push(wasm.Manifold.hull([sp, sq]));
      [s, sp, sq].forEach((m) => m.delete());
    }
    if (solids.length === 0) return null;
    const hulls = wasm.Manifold.union(solids);
    solids.forEach((m) => m.delete());
    // Proyección a lo largo del eje del tramo [from, to]: un centro prohibido lo es a cualquier profundidad
    const lo: Vec3 = [-BIG, -BIG, -BIG];
    const size: Vec3 = [2 * BIG, 2 * BIG, 2 * BIG];
    lo[a] = from;
    size[a] = Math.max(1e-3, to - from);
    const slab = wasm.Manifold.cube(size, false).translate(lo);
    const inSlab = hulls.intersect(slab);
    const { oriented, owned } = orientForAxis(inSlab, axis);
    const shadow = oriented.project();
    const extruded = shadow.extrude(2 * BIG);
    const prismLocal = extruded.translate([0, 0, -BIG]);
    const out = orientedToWorld(prismLocal, axis);
    if (owned) oriented.delete();
    [hulls, slab, inSlab, shadow, extruded, prismLocal].forEach((m) => m.delete());
    if (out.isEmpty()) {
      out.delete();
      return null;
    }
    return out;
  }
}
