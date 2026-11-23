/**
 * @file src/store/commandBus.ts
 * @description Command Bus unificado de Kura3D (UI, Servidor MCP y Chat IA). Aplica la política
 * lectura/escritura compartida, bloquea comandos que mutan la escena durante una operación o un
 * arrastre, valida cada comando con `commandSchemas` y traduce los errores tipados al idioma activo.
 * Se instancia desde el store con sus dependencias, sin cambiar `executeCommand`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isReadCommand } from '../core/commands/commandPolicy';
import { BRAND } from '../brand';
import * as engine from '../engine';
import { isEngineError, type EngineErrorCode } from '../engine/engineErrors';
import { edgeReport } from '../engine/primitiveEdges';
import { localizeEngineErrorForUser } from './userEngineMessages';
import type { TranslationKey } from '../i18n';
import type { KuraCommandRequest, KuraCommandResponse, SceneObject } from '../types/kura';
import { captureViewportPng, isMcpCommandAllowed } from '../utils/mcpBridgeClient';
import { CommandError, type CommandErrorCode } from './commandErrors';
import { selectExportTargets } from './exportTargets';
import * as schema from './commandSchemas';
import * as groupSchema from './groupCommandSchemas';
import { parseUpdatePrimitiveParams } from './parametricCommandSchemas';
import { parseSplitForBed, parseValidateAssembly } from './splitCommandSchemas';
import { fitAnalysisToUser, parseFitToBed } from './fitCommandSchemas';
import { MEASURE_HANDLERS } from './measureCommands';
import { REPAIR_HANDLERS } from './repairCommands';
import { ROLE_HANDLERS } from './roleCommands';
import { FIT_CHECK_HANDLERS } from './fitCheckCommands';
import { userWarning } from '../core/scene/userEngineMessages';
import { localizeEngineWarning, type EngineWarning } from '../engine/engineErrors';
import type { OperationErrorTracker } from './operationErrors';
import type { RawParams } from './commandValidation';
import type { CommandSourceType, KuraStoreState } from './useKuraStore';
import {
  alignModeFromUser,
  assemblyResponseToUser,
  axisFromUser,
  splitJointToUser,
  splitPlanToUser,
  structureRegionToUser,
  keepModeFromUser,
  planeFromUser,
  projectionAxisFromUser,
  rotationFromUser,
  scaleFromUser,
  statsToUser,
  toUserVector,
  transformToUser,
  vecFromUser,
} from './commandAxes';
import { fromUserVector } from '../core/scene/displayAxes';

export interface CommandBusDeps {
  get: () => KuraStoreState;
  setSelectedIds: (ids: string[]) => void;
  /** true mientras hay una operación asíncrona o un arrastre de transformación sin confirmar. */
  isInteractionLocked: () => boolean;
  tr: (key: TranslationKey, params?: Record<string, string | number>) => string;
  toBase64: (bytes: Uint8Array) => string;
  /** Último error de operación del store: aporta el código del `EngineError` a `errorCode`. */
  operationErrors?: OperationErrorTracker;
  /** Avisos del motor que mostraron las acciones del store: viajan en la respuesta (`warnings`). */
  engineWarnings?: { clear: () => void; take: () => EngineWarning[] };
}

/** Avisos en ejes del usuario con mensaje en inglés (misma forma que el MCP sin interfaz). */
function responseWarnings(warnings: readonly EngineWarning[]): KuraCommandResponse['warnings'] {
  return warnings.map((w) => {
    const u = userWarning(w);
    return { code: u.code, params: u.params, message: localizeEngineWarning('en', u) };
  });
}

type Handler = (p: RawParams, deps: CommandBusDeps, command: string) => Promise<unknown> | unknown;

/** Comandos de escritura que no modifican la escena (ajustes y exportaciones): no se bloquean. */
const NON_SCENE_WRITES = new Set(['set_printer_profile', 'set_unit_system', 'export_stl', 'export_3mf']);

const brief = (o: SceneObject) => ({ id: o.id, name: o.name });
/**
 * `stats` del bus en dimensiones de mundo (rotación y escala aplicadas), igual que el MCP headless.
 * El contrato del bus usa los ejes del usuario (Z arriba): ver `commandAxes.ts`.
 */
const worldStats = (o: SceneObject) => statsToUser(engine.computeWorldStats(o.mesh, o.rotation, o.scale));
const withStats = (o: SceneObject) => ({ id: o.id, name: o.name, stats: worldStats(o) });

/** Convierte un resultado vacío de una acción del store en un error tipado. */
function required<T>(value: T, command: string): NonNullable<T> {
  const empty = value === null || value === undefined || value === false || (Array.isArray(value) && value.length === 0);
  if (empty) throw new CommandError('failed', 'bus.error.failed', { command });
  return value as NonNullable<T>;
}

function exportTargets(deps: CommandBusDeps, onlySelected: boolean): { targets: SceneObject[]; skippedHoles: number; skippedReferences: number } {
  const { objects, selectedIds } = deps.get();
  const selection = selectExportTargets(objects, selectedIds, onlySelected);
  if (selection.targets.length === 0) throw new CommandError('precondition', 'toast.nothingToExport');
  return selection;
}

const triangles = (objs: SceneObject[]) => objs.reduce((acc, o) => acc + o.stats.triangles, 0);
const headless = () => typeof document === 'undefined';

const HANDLERS: Record<KuraCommandRequest['command'], Handler> = {
  ...MEASURE_HANDLERS,
  ...REPAIR_HANDLERS,
  ...ROLE_HANDLERS,
  ...FIT_CHECK_HANDLERS,
  get_scene_state: (_p, { get }) => {
    const s = get();
    return {
      engineReady: s.engineReady,
      uiDensity: s.uiDensity,
      unitSystem: s.unitSystem,
      language: s.language,
      printerProfile: s.printerProfile,
      selectedIds: s.selectedIds,
      objects: s.objects.map((o) => ({
        id: o.id, name: o.name, source: o.source, primitiveType: o.primitiveType,
        ...transformToUser(o), color: o.color,
        materialPreset: o.materialPreset ?? 'pla_matte', role: o.role, isHole: o.role === 'negative', visible: o.visible,
        locked: o.locked, stats: worldStats(o), groupId: o.groupRef ?? null,
      })),
      groups: groupSchema.groupHierarchy(s),
    };
  },

  create_primitive: async (p, { get }, command) => {
    const { type, params, ...options } = schema.parseCreatePrimitive(p);
    // `position`, `rotation` y `scale` llegan en ejes del usuario (Z arriba), como en el modo sin interfaz
    const obj = required(await get().createPrimitive(type, params, {
      ...options,
      position: vecFromUser(options.position),
      rotation: rotationFromUser(options.rotation),
      scale: scaleFromUser(options.scale),
    }), command);
    // Bordes: tamaño aplicado y si se acotó al tope de las medidas (nunca en silencio).
    return { ...withStats(obj), ...transformToUser(obj), ...edgeReport(obj.primitiveType, obj.primitiveParams) };
  },

  update_primitive_params: async (p, { get }, command) => {
    const { target, edit } = parseUpdatePrimitiveParams(get(), p);
    const obj = required(await get().updatePrimitiveParams(target.id, edit), command);
    return {
      ...withStats(obj),
      primitiveType: obj.primitiveType,
      ...(edit.kind === 'primitive' ? { primitiveParams: obj.primitiveParams, ...edgeReport(obj.primitiveType, obj.primitiveParams) } : { thread: obj.parametric?.thread }),
    };
  },

  create_thread: async (p, { get }, command) =>
    withStats(required(await get().createThreadObject(schema.parseThread(p), { targetId: schema.readThreadTarget(p) }), command)),

  import_svg: async (p, { get }, command) =>
    brief(required(await get().importSvgModel(schema.parseImportSvg(p)), command)),

  transform_object: (p, { get }, command) => {
    const input = schema.parseTransform(get(), p);
    const id = input.target.id;
    if (input.dropToBed) get().dropObjectToBed(id);
    else if (input.centerOnBed) get().centerObjectOnBed(id);
    else {
      get().setObjectTransform(id, {
        position: vecFromUser(input.position),
        rotation: rotationFromUser(input.rotation),
        scale: scaleFromUser(input.scale),
      }, true);
    }
    const updated = required(get().objects.find((o) => o.id === id), command);
    return { id, ...transformToUser(updated) };
  },

  delete_object: (p, { get }) => {
    const ids = schema.parseDelete(get(), p).map((o) => o.id);
    get().deleteObjects(ids);
    return { deleted: ids };
  },

  duplicate_object: (p, { get }, command) =>
    required(get().duplicateObjects(schema.parseDuplicate(get(), p).map((o) => o.id)), command).map(brief),

  boolean_operation: async (p, { get }, command) => {
    const { op, target, tools } = schema.parseBoolean(get(), p);
    const result = required(await get().runBooleanOnSelection(op, target.id, tools.map((o) => o.id)), command);
    // Mismo contrato que el MCP headless: ids consumidos e id resultante explícitos.
    return { ...withStats(result), resultId: result.id, consumedIds: [target.id, ...tools.map((o) => o.id)] };
  },

  hollow_object: async (p, { get }, command) => {
    const { target, ...opts } = schema.parseHollow(get(), p);
    required(await get().hollowObject(target.id, { enabled: true, ...opts }), command);
    return { id: target.id };
  },

  plane_cut: async (p, { get }, command) => {
    const { target, options: userOptions } = schema.parsePlaneCut(get(), p);
    const options = {
      ...userOptions,
      ...planeFromUser(userOptions.axis, userOptions.offset),
      keepMode: keepModeFromUser(userOptions.axis, userOptions.keepMode),
    };
    return required(await get().planeCutObject(target.id, options), command).map(brief);
  },

  split_for_bed: async (p, { get }, command) => {
    const { target, ...request } = parseSplitForBed(get(), p);
    const out = required(await get().splitObjectForBed(target.id, request), command);
    return {
      dryRun: request.dryRun,
      plan: splitPlanToUser(out.plan),
      parts: out.parts.map((o) => ({ ...brief(o), code: o.metadata?.split?.code, plate: o.metadata?.split?.print.plate })),
      joints: out.joints.map(splitJointToUser),
      ...(out.looseDowels && out.looseDowels.length > 0 ? { looseDowels: out.looseDowels } : {}),
      plateCount: out.plateCount,
      ...(out.assembly ? { assembly: out.assembly } : {}),
    };
  },

  fit_to_bed: async (p, { get }, command) => {
    const { targets, bed, dryRun, alternative } = parseFitToBed(get(), p);
    const ids = targets.map((o) => o.id);
    if (dryRun || !alternative) return { dryRun: true, ...fitAnalysisToUser(required(await get().analyzeFitToBed(ids, bed), command)) };
    const out = required(await get().applyFitToBed(ids, alternative, bed), command);
    return { dryRun: false, applied: alternative, factor: out.applied.factor, ...fitAnalysisToUser(out.analysis) };
  },

  validate_assembly: async (p, { get }, command) => {
    const targets = parseValidateAssembly(get(), p);
    return assemblyResponseToUser(required(await get().validateSplitAssembly(targets), command));
  },

  split_disconnected: async (p, { get }, command) => {
    const { id } = schema.parseEditableTarget(get(), p);
    return required(await get().splitDisconnectedObject(id), command).map(brief);
  },

  group_objects: (p, { get }, command) => {
    const { objects, name } = groupSchema.parseGroupObjects(get(), p);
    const group = required(get().groupObjects(objects.map((o) => o.id), name), command);
    return { id: group.id, name: group.name, objectIds: objects.map((o) => o.id) };
  },

  ungroup: (p, { get }) => {
    const groupId = groupSchema.parseUngroup(get(), p);
    const count = get().ungroupObjects(groupId);
    if (count === 0) throw new CommandError('precondition', 'groups.toast.noGroup');
    return { ungrouped: count };
  },

  combine_objects: (p, { get }, command) => {
    const { objects, name } = groupSchema.parseCombine(get(), p);
    const obj = required(get().combineObjects(objects.map((o) => o.id), name), command);
    return { ...brief(obj), volumeMm3: obj.stats.volumeMm3 };
  },

  separate_bodies: async (p, { get }, command) => {
    const target = groupSchema.parseSeparate(get(), p);
    return required(await get().separateBodies(target.id), command).map(brief);
  },

  split_by_color: async (p, { get }, command) => {
    const { target, depthMm } = schema.parseSplitByColor(get(), p);
    const parts = required(await get().splitObjectByColor(target.id, depthMm === undefined ? {} : { depthMm }), command);
    return parts.map((o) => ({ ...brief(o), color: o.color, volumeMm3: o.stats.volumeMm3 }));
  },

  apply_texture: (p, { get }, command) => {
    const { target, options } = schema.parseTexture(get(), p);
    required(get().applyTextureToObject(target.id, options), command);
    return { id: target.id };
  },

  paint_object: (p, { get }) => {
    const { target, color: rawColor, localPoint } = schema.parsePaint(get(), p);
    const color = rawColor ?? get().paintColor;
    get().setPaintSettings({ paintColor: color });
    get().paintObjectSurface(target.id, localPoint ? fromUserVector(localPoint) : null, null, localPoint ? 'brush' : 'whole');
    return { id: target.id, color };
  },

  set_printer_profile: (p, { get }) => {
    get().setPrinterProfile(schema.parsePrinterProfile(p));
    return get().printerProfile;
  },

  set_unit_system: (p, { get }) => {
    const unit = schema.parseUnit(p);
    get().setUnitSystem(unit);
    return { unit };
  },

  set_material: (p, { get }) => {
    const { target, materialPreset } = schema.parseMaterial(get(), p);
    get().setObjectMaterial(target.id, materialPreset);
    return { id: target.id, materialPreset };
  },

  generate_mold: async (p, { get }, command) => {
    const { target, options } = schema.parseMold(get(), p);
    return required(await get().generateMoldForObject(target.id, options), command).map(brief);
  },

  project_on_surface: async (p, { get }, command) => {
    const { target, options: userOptions } = schema.parseProjection(get(), p);
    const options = { ...userOptions, axis: projectionAxisFromUser(userOptions.axis) };
    return withStats(required(await get().projectOnObjectSurface(target.id, options), command));
  },

  analyze_printability: async (p, { get }, command) => {
    const { target, infillPercent, overhangAngleDeg } = schema.parsePrintability(get(), p);
    const report = required(await get().runPrintabilityCheck(target.id, infillPercent, overhangAngleDeg), command);
    // Peso y filamento son una referencia muy aproximada (el valor real depende del slicer): no entran en el puntaje.
    return { ...report, approximate: true };
  },

  simplify_mesh: async (p, { get }, command) => {
    const { target, toleranceMm } = schema.parseSimplify(get(), p);
    required(await get().simplifySelectedMesh(target.id, toleranceMm), command);
    const updated = get().objects.find((o) => o.id === target.id);
    return updated ? worldStats(updated) : null;
  },

  refine_mesh: async (p, { get }, command) => {
    const { target, targetEdgeLengthMm, smooth } = schema.parseRefine(get(), p);
    required(await get().refineSelectedMesh(target.id, targetEdgeLengthMm, smooth), command);
    const updated = get().objects.find((o) => o.id === target.id);
    return updated ? worldStats(updated) : null;
  },

  convex_hull: async (p, { get }, command) =>
    withStats(required(await get().runConvexHull(schema.parseHull(get(), p).map((o) => o.id)), command)),

  align_objects: (p, deps) => {
    const { mode, objects, spacingIgnored } = schema.parseAlign(deps.get(), p);
    if (objects) deps.setSelectedIds(objects.map((o) => o.id));
    const result = deps.get().alignSelectedObjects(alignModeFromUser(mode));
    return { mode, moved: result?.moved ?? 0, fitsBed: result?.fitsBed ?? true, ...(spacingIgnored ? { ignoredParams: ['spacingMm'] } : {}) };
  },

  mirror_object: (p, { get }, command) => {
    const { target, axis } = schema.parseMirror(get(), p);
    required(get().mirrorObject(target.id, axisFromUser(axis)), command);
    return { id: target.id, axis };
  },

  detect_structures: async (p, { get }, command) => {
    const { target, creaseAngleDeg } = schema.parseDetect(get(), p);
    const seg = required(await get().detectObjectStructures(target.id, creaseAngleDeg), command);
    return {
      objectId: seg.objectId,
      method: seg.method,
      totalTriangles: seg.totalTriangles,
      regions: seg.regions.map((r) => structureRegionToUser({
        id: r.id, labelEs: r.labelEs, labelEn: r.labelEn, archetype: r.archetype, color: r.color,
        triangleCount: r.triangleCount, percentOfModel: r.percentOfModel, dimensionsMm: r.dimensionsMm,
        centerMm: r.centerMm, confidence: r.confidence, isDisconnectedShell: r.isDisconnectedShell,
      })),
    };
  },

  colorize_structures: async (p, { get }, command) => {
    const target = schema.parseColorize(get(), p, get().activeSegmentation?.objectId);
    required(await get().colorizeDetectedStructures(target.id), command);
    return { objectId: target.id, regionsCount: get().activeSegmentation?.regions.length ?? 0 };
  },

  extract_structure: async (p, { get }, command) => {
    const input = schema.parseExtract(get(), p);
    if (input.objectId && get().activeSegmentation?.objectId !== input.objectId) {
      await get().detectObjectStructures(input.objectId);
    }
    const seg = get().activeSegmentation;
    if (!seg) throw new CommandError('precondition', 'bus.error.runDetectFirst');
    const region = seg.regions.find((r) => r.id === input.regionId)
      ?? (input.regionIndex !== undefined ? seg.regions[input.regionIndex] : undefined);
    if (!region) throw new CommandError('not-found', 'bus.error.regionNotFound');
    return withStats(required(await get().extractDetectedStructure(region.id, input.removeFromSource), command));
  },

  export_stl: async (p, deps, command) => {
    const { onlySelected, wantsBytes } = schema.parseExport(p);
    if (wantsBytes || headless()) {
      const { targets, skippedHoles, skippedReferences } = exportTargets(deps, onlySelected);
      const bytes = engine.exportSceneToBinarySTL(targets, engine.stlBrandHeader(BRAND));
      return { format: 'stl', bytesBase64: deps.toBase64(bytes), triangleCount: triangles(targets), skippedHoles, skippedReferences };
    }
    required(await deps.get().exportSceneStl(onlySelected), command);
    return { format: 'stl' };
  },

  // `slicerTarget` está obsoleto: se acepta e ignora (un único 3MF estándar, compatible con OrcaSlicer, Bambu Studio, PrusaSlicer y Cura).
  export_3mf: async (p, deps, command) => {
    const input = schema.parseExport(p);
    if (input.wantsBytes || headless()) {
      const { targets, skippedHoles, skippedReferences } = exportTargets(deps, input.onlySelected);
      const bytes = engine.exportSceneTo3MF(targets, deps.get().unitSystem, undefined, BRAND);
      return { format: '3mf', bytesBase64: deps.toBase64(bytes), triangleCount: triangles(targets), skippedHoles, skippedReferences };
    }
    required(await deps.get().exportScene3mf(input.onlySelected), command);
    return { format: '3mf' };
  },

  capture_viewport: () => {
    const dataUrl = captureViewportPng();
    if (!dataUrl) throw new CommandError('precondition', 'bus.error.viewportNotReady');
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    return { mimeType: 'image/png', base64, dataUrl };
  },
};

/**
 * Respuesta del bus: la estándar más el código de error tipado cuando falla. Si el fallo vino del
 * motor geométrico, `errorCode` es el código estable del `EngineError` (p. ej. `HOLLOW_WALL_TOO_THICK`).
 */
export type CommandBusResponse = KuraCommandResponse & { errorCode?: CommandErrorCode | EngineErrorCode };

/** Crea la función `executeCommand` del store a partir de sus dependencias. */
export function createCommandBus(deps: CommandBusDeps) {
  return async (req: KuraCommandRequest, source: CommandSourceType = 'ui'): Promise<CommandBusResponse> => {
    const command = String(req.command);
    deps.operationErrors?.clear();
    deps.engineWarnings?.clear();
    try {
      // Un comando inexistente es `unknown-command` desde cualquier origen, antes de la política de solo lectura.
      const handler = Object.prototype.hasOwnProperty.call(HANDLERS, command)
        ? HANDLERS[command as KuraCommandRequest['command']]
        : undefined;
      if (!handler) throw new CommandError('unknown-command', 'bus.error.unknownCommand', { command: command.slice(0, 64) });
      if (source === 'mcp' && !isMcpCommandAllowed(command, deps.get().mcpConfig.readOnly)) {
        throw new CommandError('read-only', 'bus.error.readOnly');
      }
      if (!isReadCommand(command) && !NON_SCENE_WRITES.has(command) && deps.isInteractionLocked()) {
        throw new CommandError('busy', 'bus.error.busy');
      }
      const params = req.params;
      if (params !== undefined && params !== null && (typeof params !== 'object' || Array.isArray(params))) {
        throw new CommandError('invalid-params', 'bus.error.invalidParam', { param: 'params', expected: 'object' });
      }
      const result = await handler((params ?? {}) as RawParams, deps, command);
      const warnings = deps.engineWarnings?.take() ?? [];
      return warnings.length > 0 ? { id: req.id, ok: true, result, warnings: responseWarnings(warnings) } : { id: req.id, ok: true, result };
    } catch (err) {
      // Una acción del store que devolvió vacío tras un error del motor: se usa ese error tipado.
      const failure = deps.operationErrors?.take();
      if (err instanceof CommandError && err.code === 'failed' && failure?.engineCode) {
        return { id: req.id, ok: false, error: failure.message, errorCode: failure.engineCode };
      }
      if (err instanceof CommandError) {
        return { id: req.id, ok: false, error: deps.tr(err.key, err.params), errorCode: err.code };
      }
      if (isEngineError(err)) {
        return { id: req.id, ok: false, error: localizeEngineErrorForUser(deps.get().language, err), errorCode: err.code };
      }
      return { id: req.id, ok: false, error: err instanceof Error ? err.message : String(err), errorCode: 'failed' };
    }
  };
}
