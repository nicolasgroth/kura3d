/**
 * @file src/core/scene/plateArrange.ts
 * @description «Repartir en placas» automático (lote P5, `docs/diseno/PLACAS_Y_ARMADO.md` §3): función pura que
 * devuelve un plan (placas a crear y pose de impresión final de cada pieza) sin tocar la escena.
 *
 * Algoritmo: cada pieza con sus acompañantes forma un bloque; su huella es la caja XZ de los vértices en la pose de
 * impresión. Los bloques se ordenan por área decreciente (desempate: lado mayor, orden de la escena) y se colocan
 * con MaxRects «Best Short Side Fit» (`plateArrangePack.ts`) en la primera placa abierta donde quepan; si no caben
 * en ninguna, se abre la siguiente (placas reutilizables primero, luego nuevas con `nextPlateOrigin`). La separación
 * se logra agrandando cada bloque y la cama útil en `spacingMm` (la cama útil ya descuenta el margen).
 *
 * Reglas:
 * - Se reparten sólidos asignables (no bloqueados), que no sean agregados, fuera de placas bloqueadas; con «todo»,
 *   solo los visibles. Referencias y negativos sueltos no se mueven ni ocupan lugar salvo como obstáculos.
 * - Acompañantes: agregados ligados (su `hostId`) y negativos de grupo que pisan a una pieza del mismo grupo (el de
 *   mayor solape) se mueven con su pieza; sus huellas cuentan para el bloque.
 * - Placas: las indicadas (`plateIds`, en ese orden; lo que ya tienen queda como obstáculo) o, si no se indican, las
 *   no bloqueadas que quedan vacías. Sin placas, la implícita del origen es la primera.
 * - `byColor`: cada color base abre sus propias placas. `byGroup`: cada grupo raíz abre las suyas (las piezas sin
 *   grupo forman un bloque propio); si un grupo no cabe en una, sigue en placas consecutivas y se informa.
 * - Determinista: mismo input, mismo plan.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import { addonHostId } from '../addons/addonFollow';
import type { MeshData, SceneGroup, SceneObject, Vec3 } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { isNegative, occupiesBed } from './objectRole';
import { MaxRectsBin } from './plateArrangePack';
import {
  ARRANGE_DEFAULTS, IMPLICIT_PLATE_KEY, NEW_PLATE_PREFIX,
  type ArrangeOptions, type ArrangePlacement, type ArrangePlan, type ArrangeReport,
} from './plateArrangeTypes';
import { assignable, MAX_PLATES, nextPlateOrigin, plateBed, type ProjectBed } from './plates';
import { rigidFollowPatches } from './rigidFollow';

type Pose = { position: Vec3; rotation: Vec3 };

export interface ArrangeInput {
  /** Objetos de la escena en pose de impresión. */
  objects: readonly SceneObject[];
  plates: readonly ScenePlate[];
  groups: readonly SceneGroup[];
  /** Cama de las placas sin cama propia (y de las nuevas). */
  projectBed: ProjectBed;
  options: ArrangeOptions;
  /** Con `orient: 'flatDown'`: pose apoyada en la cara plana más grande (null = sin base real, se conserva). */
  orientPose?: (obj: SceneObject) => Pose | null;
}

export interface Bounds3 { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }

/** Caja en mundo de los vértices transformados (ajustada, no la caja de la caja). null sin geometría. */
export function poseBounds(mesh: Pick<MeshData, 'positions'>, position: Vec3, rotation: Vec3, scale: Vec3): Bounds3 | null {
  const p = mesh.positions;
  if (p.length < 3) return null;
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ')), new THREE.Vector3(...scale),
  ).elements;
  const b: Bounds3 = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (let i = 0; i + 2 < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
    if (wx < b.minX) b.minX = wx;
    if (wx > b.maxX) b.maxX = wx;
    if (wy < b.minY) b.minY = wy;
    if (wy > b.maxY) b.maxY = wy;
    if (wz < b.minZ) b.minZ = wz;
    if (wz > b.maxZ) b.maxZ = wz;
  }
  return Number.isFinite(b.minX) ? b : null;
}

const union = (a: Bounds3, b: Bounds3): Bounds3 => ({
  minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX), minY: Math.min(a.minY, b.minY),
  maxY: Math.max(a.maxY, b.maxY), minZ: Math.min(a.minZ, b.minZ), maxZ: Math.max(a.maxZ, b.maxZ),
});
const overlapXZ = (a: Bounds3, b: Bounds3) =>
  Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)) * Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
const clean = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n);

interface Member { obj: SceneObject; pose: Pose; bounds: Bounds3; assignPlate: boolean }
interface Unit { lead: SceneObject; index: number; members: Member[]; bounds: Bounds3; bucket: string }
interface Bin { plate: string; bed: ProjectBed; x0: number; z0: number; w: number; d: number; rects: MaxRectsBin }

/** Grupo raíz (sube por `parentId`, con guarda de ciclos). */
function rootGroup(groupRef: string | undefined, groups: ReadonlyMap<string, SceneGroup>): string | undefined {
  let id = groupRef;
  for (let i = 0; id && i < 64; i++) {
    const parent = groups.get(id)?.parentId;
    if (!parent || !groups.has(parent)) return id;
    id = parent;
  }
  return id;
}

/** Plan de reparto (no toca la escena). */
export function arrangeOnPlates(input: ArrangeInput): ArrangePlan {
  const { objects, plates, projectBed } = input;
  const criterion = input.options.criterion ?? ARRANGE_DEFAULTS.criterion;
  const gap = Math.max(0, input.options.spacingMm ?? ARRANGE_DEFAULTS.spacingMm);
  const margin = Math.max(0, input.options.marginMm ?? ARRANGE_DEFAULTS.marginMm);
  const flatDown = (input.options.orient ?? ARRANGE_DEFAULTS.orient) === 'flatDown';
  const groupsById = new Map(input.groups.map((g) => [g.id, g]));
  const platesById = new Map(plates.map((p) => [p.id, p]));
  const scoped = input.options.ids?.length ? new Set(input.options.ids) : null;

  const report: ArrangeReport = { platesUsed: [], platesCreated: 0, placed: [], moved: 0, unplaced: [], skipped: [], splitGroups: [], keptOrientation: [] };

  // 1. Piezas a repartir.
  const leads: SceneObject[] = [];
  for (const o of objects) {
    if (o.role !== 'solid' || o.metadata?.addon) continue;
    if (scoped ? !scoped.has(o.id) : !o.visible) continue;
    if (!assignable(o)) {
      if (scoped) report.skipped.push({ id: o.id, reason: 'locked' });
      continue;
    }
    if (o.plateRef && platesById.get(o.plateRef)?.locked) {
      report.skipped.push({ id: o.id, reason: 'lockedPlate' });
      continue;
    }
    leads.push(o);
  }
  const leadIds = new Set(leads.map((o) => o.id));

  // 2. Poses de impresión finales de orientación (antes de trasladar) y acompañantes.
  const leadPose = new Map<string, Pose>();
  for (const o of leads) {
    const oriented = flatDown && input.orientPose ? input.orientPose(o) : null;
    if (flatDown && !oriented) report.keptOrientation.push(o.id);
    leadPose.set(o.id, oriented ?? { position: o.position, rotation: o.rotation });
  }
  const followerOf = new Map<string, string>();
  for (const o of objects) {
    const host = addonHostId(o);
    if (host && leadIds.has(host) && !leadIds.has(o.id)) followerOf.set(o.id, host);
  }
  const boundsOf = (o: SceneObject, pose: Pose) => poseBounds(o.mesh, pose.position, pose.rotation, o.scale);
  const currentBounds = new Map<string, Bounds3 | null>();
  const curBounds = (o: SceneObject) => {
    if (!currentBounds.has(o.id)) currentBounds.set(o.id, boundsOf(o, o));
    return currentBounds.get(o.id)!;
  };
  for (const o of objects) {
    if (!isNegative(o) || !o.groupRef || o.metadata?.addon || o.locked || followerOf.has(o.id)) continue;
    const nb = curBounds(o);
    if (!nb) continue;
    let best: string | null = null, bestArea = 0;
    for (const h of leads) {
      if (h.groupRef !== o.groupRef) continue;
      const hb = curBounds(h);
      const a = hb ? overlapXZ(nb, hb) : 0;
      if (a > bestArea) { best = h.id; bestArea = a; }
    }
    if (best) followerOf.set(o.id, best);
  }

  // 3. Bloques.
  const followersByLead = new Map<string, SceneObject[]>();
  for (const o of objects) {
    const host = followerOf.get(o.id);
    if (!host) continue;
    const list = followersByLead.get(host);
    if (list) list.push(o);
    else followersByLead.set(host, [o]);
  }
  const indexById = new Map(objects.map((o, i) => [o.id, i]));
  const units: Unit[] = [];
  const moving = new Set<string>();
  leads.forEach((lead) => {
    const pose = leadPose.get(lead.id)!;
    const lb = boundsOf(lead, pose);
    if (!lb) {
      report.unplaced.push({ id: lead.id, reason: 'empty' });
      return;
    }
    const members: Member[] = [{ obj: lead, pose, bounds: lb, assignPlate: true }];
    const followers = followersByLead.get(lead.id) ?? [];
    const changed = pose.position !== lead.position || pose.rotation !== lead.rotation;
    const followed = changed ? rigidFollowPatches(followers, lead, { ...pose, scale: lead.scale }) : [];
    for (const f of followers) {
      const fp = followed.find((x) => x.id === f.id)?.patch ?? { position: f.position, rotation: f.rotation };
      const fb = boundsOf(f, fp);
      if (fb) members.push({ obj: f, pose: fp, bounds: fb, assignPlate: f.plateRef !== undefined });
    }
    const bounds = members.slice(1).reduce((acc, m) => (occupiesBed(m.obj) && !isNegative(m.obj) ? union(acc, m.bounds) : acc), lb);
    const bucket = criterion === 'byColor' ? lead.color.trim().toLowerCase() : criterion === 'byGroup' ? rootGroup(lead.groupRef, groupsById) ?? '' : '';
    units.push({ lead, index: indexById.get(lead.id)!, members, bounds, bucket });
    for (const m of members) moving.add(m.obj.id);
  });

  // 4. Placas disponibles.
  const obstacles = objects.filter((o) => !moving.has(o.id) && occupiesBed(o)).map(curBounds).filter((b): b is Bounds3 => b !== null);
  const makeBin = (key: string, origin: readonly [number, number], bed: ProjectBed, withObstacles: boolean): Bin | null => {
    const m = Math.max(margin, bed.marginMm ?? 0);
    const w = bed.widthMm - 2 * m, d = bed.depthMm - 2 * m;
    if (w <= 0 || d <= 0) return null;
    const x0 = origin[0] - bed.widthMm / 2 + m, z0 = origin[1] - bed.depthMm / 2 + m;
    const rects = new MaxRectsBin(w + gap, d + gap);
    const bin: Bin = { plate: key, bed, x0, z0, w, d, rects };
    if (withObstacles) for (const b of obstacles) rects.occupy({ x: b.minX - x0, z: b.minZ - z0, w: b.maxX - b.minX + gap, d: b.maxZ - b.minZ + gap });
    return bin;
  };
  const hitsBed = (b: Bounds3, origin: readonly [number, number], bed: ProjectBed) =>
    b.maxX > origin[0] - bed.widthMm / 2 && b.minX < origin[0] + bed.widthMm / 2 && b.maxZ > origin[1] - bed.depthMm / 2 && b.minZ < origin[1] + bed.depthMm / 2;

  const supply: Bin[] = [];
  if (plates.length === 0) {
    const bin = makeBin(IMPLICIT_PLATE_KEY, [0, 0], projectBed, true);
    if (bin) supply.push(bin);
  } else if (input.options.plateIds?.length) {
    const seen = new Set<string>();
    for (const id of input.options.plateIds) {
      const p = platesById.get(id);
      if (!p || p.locked || seen.has(id)) continue;
      seen.add(id);
      const bin = makeBin(p.id, p.origin, plateBed(p, projectBed), true);
      if (bin) supply.push(bin);
    }
  } else {
    for (const p of plates) {
      const bed = plateBed(p, projectBed);
      if (p.locked || obstacles.some((b) => hitsBed(b, p.origin, bed))) continue;
      const bin = makeBin(p.id, p.origin, bed, false);
      if (bin) supply.push(bin);
    }
  }
  // Placas que van existiendo (para el origen libre de las nuevas).
  const layout: ScenePlate[] = plates.length ? [...plates] : [{ id: IMPLICIT_PLATE_KEY, name: '', origin: [0, 0] }];
  let created = 0;
  const newBin = (): Bin | null => {
    if (layout.length >= MAX_PLATES) return null;
    const origin = nextPlateOrigin(layout, projectBed);
    if (!origin) return null;
    const key = `${NEW_PLATE_PREFIX}${created++}`;
    layout.push({ id: key, name: '', origin });
    return makeBin(key, origin, projectBed, false);
  };
  const fitsSize = (bin: Pick<Bin, 'w' | 'd'>, u: Unit) => MaxRectsBin.fitsEmpty(bin.w, bin.d, u.bounds.maxX - u.bounds.minX, u.bounds.maxZ - u.bounds.minZ);
  const fitsHeight = (bin: Pick<Bin, 'bed'>, u: Unit) => u.bounds.maxY - u.bounds.minY <= bin.bed.heightMm + 1e-9;
  const newPlateBin = (() => {
    const m = Math.max(margin, projectBed.marginMm ?? 0);
    return { bed: projectBed, w: projectBed.widthMm - 2 * m, d: projectBed.depthMm - 2 * m };
  })();

  // 5. Empaquetado por cubetas (una para compacto).
  const buckets = new Map<string, Unit[]>();
  for (const u of units) {
    const list = buckets.get(u.bucket);
    if (list) list.push(u);
    else buckets.set(u.bucket, [u]);
  }
  const placements: ArrangePlacement[] = [];
  const used: string[] = [];
  for (const [bucket, list] of buckets) {
    const sorted = [...list].sort((a, b) => {
      const wa = a.bounds.maxX - a.bounds.minX, da = a.bounds.maxZ - a.bounds.minZ;
      const wb = b.bounds.maxX - b.bounds.minX, db = b.bounds.maxZ - b.bounds.minZ;
      return wb * db - wa * da || Math.max(wb, db) - Math.max(wa, da) || a.index - b.index;
    });
    const open: Bin[] = [];
    for (const u of sorted) {
      const w = u.bounds.maxX - u.bounds.minX + gap, d = u.bounds.maxZ - u.bounds.minZ + gap;
      // Cada placa con SU cama (P7): las abiertas también cuentan, porque una cama propia más grande puede
      // recibir una pieza que no cabe en la del proyecto.
      const candidates = [...open, ...supply, newPlateBin];
      if (!candidates.some((b) => fitsSize(b, u))) {
        report.unplaced.push({ id: u.lead.id, reason: 'tooLarge' });
        continue;
      }
      if (!candidates.some((b) => fitsSize(b, u) && fitsHeight(b, u))) {
        report.unplaced.push({ id: u.lead.id, reason: 'tooTall' });
        continue;
      }
      let bin: Bin | null = null;
      let at: { x: number; z: number } | null = null;
      for (const b of open) {
        if (!fitsHeight(b, u)) continue;
        at = b.rects.find(w, d);
        if (at) { bin = b; break; }
      }
      if (!bin) {
        const i = supply.findIndex((b) => fitsHeight(b, u) && b.rects.find(w, d) !== null);
        if (i >= 0) bin = supply.splice(i, 1)[0];
        else if (fitsSize(newPlateBin, u) && fitsHeight(newPlateBin, u)) bin = newBin();
        at = bin ? bin.rects.find(w, d) : null;
        if (bin && at) {
          open.push(bin);
          used.push(bin.plate);
        }
      }
      if (!bin || !at) {
        report.unplaced.push({ id: u.lead.id, reason: 'noRoom' });
        continue;
      }
      bin.rects.occupy({ x: at.x, z: at.z, w, d });
      const dx = bin.x0 + at.x - u.bounds.minX, dz = bin.z0 + at.z - u.bounds.minZ;
      for (const m of u.members) {
        placements.push({
          id: m.obj.id, plate: bin.plate, assignPlate: m.assignPlate,
          position: [clean(m.pose.position[0] + dx), m.pose.position[1], clean(m.pose.position[2] + dz)],
          rotation: [m.pose.rotation[0], m.pose.rotation[1], m.pose.rotation[2]],
        });
      }
      report.placed.push(u.lead.id);
    }
    if (criterion === 'byGroup' && bucket && open.length > 1) report.splitGroups.push({ groupId: bucket, plates: open.map((b) => b.plate) });
  }

  const createdPlates = layout.filter((p) => p.id.startsWith(NEW_PLATE_PREFIX)).map((p) => ({ key: p.id, origin: [p.origin[0], p.origin[1]] as [number, number] }));
  // La implícita se vuelve explícita («Placa 1») solo si hacen falta otras.
  if (plates.length === 0 && createdPlates.length) createdPlates.unshift({ key: IMPLICIT_PLATE_KEY, origin: [0, 0] });
  // Sin placas en la escena, todo lo colocado recibe placa si se crean placas (como al crear la segunda a mano).
  if (plates.length === 0 && createdPlates.length) for (const p of placements) if (!p.assignPlate) p.assignPlate = objects.find((o) => o.id === p.id)?.role === 'solid';
  report.platesUsed = used;
  report.platesCreated = createdPlates.length;
  report.moved = placements.length;
  return { createdPlates, placements, report };
}
