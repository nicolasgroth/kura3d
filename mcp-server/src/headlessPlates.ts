/**
 * @file mcp-server/src/headlessPlates.ts
 * @description Placas de impresión en el modo sin interfaz del servidor MCP (lote P8): lista de placas, placa activa
 * y modo de vista (imprimir / armado) de la escena en memoria. Mismos esquemas, mismas funciones puras y misma
 * respuesta que el Command Bus de la app (`core/bus/plateCommandSchemas`, `core/scene/plates*`, `plateActions`,
 * `plateSpread`, `plateArrange` + `arrangeApply`, `layoutPoses`, `plateAdopt`, `plateFollow`, `plateExport`), con los
 * nombres por defecto en inglés. Sin historial: el modo sin interfaz no tiene deshacer. «Cara plana abajo» de
 * Repartir corre en el proceso del servidor (la app lo hace en su Worker), con la misma función.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import {
  assignmentsOf, nothingToMove, parseCreatePlate, parseDeletePlate, parseMoveToPlate, parseRenamePlate, parseSetActivePlate,
  parseSetLayout, parseSetPlateBed, parseSpreadOnePlatePerObject, plateBedNoRoom, plateListToUser, plateNotCreated, plateToUser,
  type PlateListState,
} from '../../src/core/bus/plateCommandSchemas';
import { samePlateBed, setPlateBed } from '../../src/core/scene/plateBedChange';
import { DEFAULT_PRINTER_PROFILES } from '../../src/types/kura';
import { CommandError } from '../../src/core/bus/commandErrors';
import type { RawParams } from '../../src/core/bus/commandValidation';
import { arrangeOnPlatesTask } from '../../src/core/operations/plateArrangeOperations';
import { activePlateBed, projectBed, type PlateBedSource } from '../../src/core/scene/activePlateBed';
import { applyArrangePlan, firstUsedPlate, reportWithPlateIds } from '../../src/core/scene/arrangeApply';
import type { BedSize } from '../../src/core/scene/freeSpot';
import { applyLayoutPatches, switchLayoutPatches } from '../../src/core/scene/layoutPoses';
import { isPrintable } from '../../src/core/scene/objectRole';
import { adoptNewPieces } from '../../src/core/scene/plateAdopt';
import { moveToPlateOrNew, removePlateMoving, type PlateActionContext } from '../../src/core/scene/plateActions';
import { reassignMovedPieces } from '../../src/core/scene/plateFollow';
import { spreadOnePlatePerObject } from '../../src/core/scene/plateSpread';
import { createPlate, findPlate, nextPlateName, renamePlate, resolveActivePlate, type PlateScene } from '../../src/core/scene/plates';
import { t } from '../../src/i18n/index';
import { arrangeReportToUser, parseArrangeOnPlates } from '../../src/core/bus/plateArrangeSchema';
import { onlyPlate, singleFilePlan, type SingleFilePlan } from '../../src/store/plateExportFlow';
import { layoutContextOf, printPosedObjects } from '../../src/store/sceneLayout';
import type { SceneLayout, ScenePlate } from '../../src/types/plates';
import type { HeadlessSceneObject } from './headlessSupport.js';
import type { PrinterProfile } from './types.js';

/** Lo que las placas necesitan de la escena sin interfaz. */
export interface PlateHost {
  /** Objetos vivos en orden de escena. */
  objects(): HeadlessSceneObject[];
  /** Reemplaza todos los objetos (mismo orden; los que no cambian son las mismas referencias). */
  replaceObjects(next: HeadlessSceneObject[]): void;
  profile(): PrinterProfile;
}

/** Copia de la escena antes de una herramienta, para que lo nuevo y lo movido sigan a su placa (como en la app). */
export interface PlateSnapshot {
  plates: ScenePlate[];
  layout: SceneLayout;
  objects: HeadlessSceneObject[];
}

const nameFor = (n: number) => t('en', 'plates.defaultName', { n });

export class HeadlessPlates {
  plates: ScenePlate[] = [];
  activePlateId: string | null = null;
  layout: SceneLayout = 'print';
  private counter = 0;

  constructor(private readonly host: PlateHost) {}

  private readonly makeId = () => `kura_plate_${++this.counter}`;

  private source(): PlateBedSource {
    const p = this.host.profile();
    return { printerProfile: p, customBedDimensions: null, plates: this.plates, activePlateId: this.activePlateId };
  }

  private scene(): PlateScene {
    return { objects: this.host.objects(), plates: this.plates };
  }

  private actionContext(): PlateActionContext {
    const src = this.source();
    return { layout: this.layout, ctx: layoutContextOf(src), projectBed: projectBed(src) };
  }

  /** Objetos en pose de impresión (exportar y medir fuera de volumen siempre miran ahí). */
  private printObjects(): HeadlessSceneObject[] {
    const state = { ...this.source(), objects: this.host.objects(), layout: this.layout };
    return printPosedObjects(state);
  }

  private commit(next: PlateScene, activePlateId?: string | null): void {
    const before = this.host.objects();
    if (next.objects !== before) this.host.replaceObjects(next.objects);
    this.plates = next.plates;
    if (activePlateId !== undefined) this.activePlateId = activePlateId;
  }

  private activeId(): string | null {
    return resolveActivePlate(this.plates, this.activePlateId)?.id ?? null;
  }

  private listState(): PlateListState {
    return {
      objects: this.host.objects(), plates: this.plates, activePlateId: this.activePlateId, layout: this.layout,
      projectBed: projectBed(this.source()), printObjects: this.printObjects(),
    };
  }

  private plateOut(id: string) {
    const plate = findPlate(this.plates, id);
    return plate ? plateToUser(plate, this.listState()) : null;
  }

  /** Cama donde cae lo nuevo: la de la placa activa con su centro (misma regla que `placementBedSize` en la app). */
  placementBed(): BedSize {
    const { bed, origin } = activePlateBed(this.source());
    return { width: bed.widthMm, depth: bed.depthMm, ...(origin[0] !== 0 || origin[1] !== 0 ? { origin } : {}) };
  }

  /** Resumen para `get_scene_state`. */
  sceneSummary() {
    return { layout: this.layout, plateCount: this.plates.length, activePlateId: this.activeId() };
  }

  list() {
    return plateListToUser(this.listState());
  }

  create(p: RawParams) {
    const { name } = parseCreatePlate(this.scene(), p);
    const current = this.scene();
    const result = createPlate(current, {
      id: this.makeId(), name: name || nextPlateName(current.plates, nameFor), projectBed: projectBed(this.source()),
      implicit: { id: this.makeId(), name: nameFor(1) },
    });
    if (!result) throw plateNotCreated();
    this.commit(result.scene, result.plate.id);
    return { plate: this.plateOut(result.plate.id), activePlateId: this.activeId(), plateCount: this.plates.length };
  }

  rename(p: RawParams) {
    const { plate, name } = parseRenamePlate(this.scene(), p);
    const next = renamePlate(this.scene(), plate.id, name);
    if (next) this.commit(next);
    return { plate: this.plateOut(plate.id), changed: next !== null };
  }

  remove(p: RawParams) {
    const { plate, targetId } = parseDeletePlate(this.scene(), p);
    const reassigned = this.host.objects().filter((o) => o.plateRef === plate.id).map((o) => o.id);
    const wasActive = this.activeId() === plate.id;
    const done = removePlateMoving(this.scene(), plate.id, this.actionContext(), targetId);
    if (!done) throw new CommandError('failed', 'bus.error.failed', { command: 'delete_plate' });
    this.commit(done.scene, wasActive ? done.targetId : undefined);
    return {
      deletedId: plate.id, targetPlateId: done.targetId, reassigned: assignmentsOf(this.host.objects(), reassigned),
      activePlateId: this.activeId(), plateCount: this.plates.length,
    };
  }

  setActive(p: RawParams) {
    const plate = parseSetActivePlate(this.scene(), p);
    const changed = this.activeId() !== plate.id;
    this.activePlateId = plate.id;
    return { activePlateId: plate.id, changed };
  }

  moveTo(p: RawParams) {
    const { ids, plateId } = parseMoveToPlate(this.scene(), p);
    const result = moveToPlateOrNew(this.scene(), ids, plateId, { ...this.actionContext(), makeId: this.makeId, nameFor });
    if (!result) throw nothingToMove();
    this.commit(result.scene, result.created ?? undefined);
    return {
      plateId: plateId ?? result.created, created: plateId === null, moved: result.moved.length,
      assignments: assignmentsOf(this.host.objects(), ids), activePlateId: this.activeId(), plateCount: this.plates.length,
    };
  }

  spread(p: RawParams) {
    const ids = parseSpreadOnePlatePerObject(this.scene(), p);
    const ac = this.actionContext();
    const result = spreadOnePlatePerObject(this.scene(), ids, { projectBed: ac.projectBed, layout: ac.layout, ctx: ac.ctx, makeId: this.makeId, nameFor });
    if (!result) throw new CommandError('precondition', 'bus.error.plateSpreadNeedsTwo');
    const first = result.scene.objects.find((o) => o.id === result.pieces[0])?.plateRef;
    this.commit(result.scene, first ?? this.activePlateId);
    return {
      pieces: result.pieces.length, created: result.created, assignments: assignmentsOf(this.host.objects(), ids),
      activePlateId: this.activeId(), plateCount: this.plates.length,
    };
  }

  arrange(p: RawParams) {
    const request = parseArrangeOnPlates({ objects: this.host.objects(), selectedIds: [], plates: this.plates }, p);
    const plan = arrangeOnPlatesTask({
      objects: this.printObjects(), plates: this.plates, groups: [], projectBed: projectBed(this.source()), options: request.options,
    });
    if (request.dryRun) {
      return { dryRun: true, ...arrangeReportToUser(plan.report), assignments: plan.placements.map((pl) => ({ id: pl.id, plate: pl.plate })) };
    }
    let report = plan.report;
    if (plan.placements.length > 0) {
      const { scene, keyToId } = applyArrangePlan({ ...this.scene(), layout: this.layout }, plan, { makeId: this.makeId, nameFor });
      this.commit(scene, firstUsedPlate(plan.report, keyToId) ?? undefined);
      report = reportWithPlateIds(plan.report, keyToId);
    }
    const placed = new Set(report.placed);
    return {
      dryRun: false, ...arrangeReportToUser(report),
      assignments: this.host.objects().filter((o) => placed.has(o.id)).map((o) => ({ id: o.id, plate: o.plateRef ?? null })),
    };
  }

  /** `set_plate_bed`: perfiles de fábrica por id (sin interfaz no hay «Mis camas») o medidas; mismo esquema y regla que la app. */
  setBed(p: RawParams) {
    const { plate, bed } = parseSetPlateBed(this.scene(), p, (id) => DEFAULT_PRINTER_PROFILES.find((x) => x.id === id));
    if (samePlateBed(plate.bed, bed ?? undefined)) return { plate: this.plateOut(plate.id), changed: false, relocated: [] };
    const ac = this.actionContext();
    const done = setPlateBed(this.scene(), plate.id, bed, { projectBed: ac.projectBed, layout: ac.layout, ctx: ac.ctx });
    if (!done) throw plateBedNoRoom();
    this.commit(done.scene);
    return { plate: this.plateOut(plate.id), changed: true, relocated: done.relocated, keptLocked: done.keptLocked };
  }

  setLayout(p: RawParams) {
    const to = parseSetLayout(p);
    if (this.layout === to) return { layout: to, changed: false };
    const objects = this.host.objects();
    const patches = switchLayoutPatches(objects, this.layout, to, layoutContextOf(this.source()));
    this.layout = to;
    if (patches.length) this.host.replaceObjects(applyLayoutPatches(objects, patches));
    return { layout: to, changed: true };
  }

  /** Copia de la escena antes de una herramienta (null sin placas: nada que mantener). */
  snapshot(): PlateSnapshot | null {
    if (this.plates.length === 0) return null;
    const objects = this.host.objects().map((o) => ({ ...o, position: [...o.position], rotation: [...o.rotation], scale: [...o.scale] }) as HeadlessSceneObject);
    return { plates: this.plates, layout: this.layout, objects };
  }

  /**
   * Tras una herramienta, como el store de la app: lo nuevo cae en la placa de lo que reemplaza, en la que está debajo
   * o en la activa, y lo movido pasa a la placa sobre la que quedó. No corre si las placas cambiaron en el mismo paso
   * (las herramientas de placas ya dejan cada pieza en la suya) ni en armado.
   */
  sync(before: PlateSnapshot | null): void {
    if (!before || this.plates !== before.plates || this.plates.length === 0 || this.layout === 'assembly') return;
    const bed = projectBed(this.source());
    const adopted = adoptNewPieces(before.objects, this.host.objects(), this.plates, this.activePlateId, bed);
    if (adopted) this.host.replaceObjects(adopted);
    const moved = this.layout === before.layout ? reassignMovedPieces(before.objects, this.host.objects(), this.plates, bed) : null;
    if (moved) this.host.replaceObjects(moved);
  }

  /**
   * Piezas a exportar con placas o en armado (misma regla que el bus de la app): pose de impresión, solo imprimibles,
   * reducidas a `plateId` y cada una respecto de la cama de su placa. null = la escena tal cual (sin placas ni armado).
   */
  exportPlan(targets: readonly HeadlessSceneObject[], format: 'stl' | '3mf', plateId?: string): SingleFilePlan | null {
    if (plateId && !findPlate(this.plates, plateId)) throw new CommandError('not-found', 'bus.error.plateNotFound', { id: plateId.slice(0, 64) });
    if (this.plates.length === 0 && this.layout === 'print') return null;
    const wanted = new Set(targets.map((o) => o.id));
    const posed = this.printObjects().filter((o) => wanted.has(o.id) && isPrintable(o));
    const scoped = plateId ? onlyPlate(posed, this.plates, plateId) : posed;
    const plan = scoped.length ? singleFilePlan(scoped, this.plates) : null;
    if (!plan || plan.targets.length === 0) throw new CommandError('precondition', 'toast.nothingToExport');
    if (format === 'stl' && plan.plateCount >= 2) throw new CommandError('precondition', 'bus.error.exportPlatesNeedPlateId', { count: plan.plateCount });
    return plan;
  }
}
