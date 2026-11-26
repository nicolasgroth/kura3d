/**
 * @file src/store/slices/simplifyPreviewSlice.ts
 * @description Vista previa de Simplificar: calcula la tarea `simplify` en el Worker (cancelable, con progreso) y
 * guarda el MISMO informe que tras aplicar (triángulos, volumen, agujeros, desviación, avisos y, si fuera
 * destructivo, qué se aplicaría y sus alternativas) sin tocar la escena ni el historial. El resultado pesado (el
 * `SceneChange`) vive en una variable del slice; si después se aplica con la misma malla, escala y parámetros,
 * `consumeSimplifyPreview` lo entrega y Simplificar no recalcula. Cambiar parámetros o selección cancela en suave
 * (como Suavizar). El fantasma del visor reutiliza `operationPreview` (clave `SIMPLIFY_PREVIEW_KEY`): en `ready`,
 * `ghostsFromChange` sobre el cambio guardado, o sea lo que REALMENTE se aplicaría (la versión segura si lo pedido
 * era destructivo). Por defecto se dibuja el sólido translúcido con las aristas (alambre) de la malla simplificada,
 * porque en una malla densa el sólido solo se ve casi igual al original y las aristas gruesas son lo que delata el
 * cambio; «Comparar» lo oculta para ver la pieza original. Sobre `SIMPLIFY_GHOST_WIRE_MAX_TRIANGLES` se dibuja solo
 * el sólido y sobre `SIMPLIFY_GHOST_MAX_TRIANGLES` no se dibuja (queda el informe). El fantasma se borra al limpiar,
 * cancelar, fallar, aplicar, o si la pieza cambia o desaparece de la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { CommandError } from '../../core/bus/commandErrors';
import { isEngineCancelled, type EngineCancelMode } from '../../core/operations/engineClient';
import type { SceneChange } from '../../core/operations';
import { isEngineError } from '../../engine/engineErrors';
import type { SimplifyReport, SimplifyRequest } from '../../engine/simplify';
import type { MeshData, SceneObject } from '../../types/kura';
import { ghostTooHeavy, SIMPLIFY_GHOST_WIRE_MAX_TRIANGLES } from '../simplifyGhostLimits';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';
import { localizeEngineErrorForUser } from '../userEngineMessages';
import { EMPTY_PREVIEW, ghostsFromChange, type PreviewGhost } from './previewSlice';

/** Clave del fantasma de la vista previa en `operationPreview`. */
export const SIMPLIFY_PREVIEW_KEY = 'simplify';

export type SimplifyPreviewStatus = 'computing' | 'ready' | 'error';

export interface SimplifyPreviewSession {
  objectId: string;
  status: SimplifyPreviewStatus;
  /** Fase del Worker (`simplify:3/16`, `simplify:verify`, `simplify:safe:2/8`) mientras calcula. */
  phase: string | null;
  /** Firma de los parámetros con que se calculó. */
  signature: string;
  report: SimplifyReport | null;
  /** Mensaje localizado si `status` es `error`. */
  error: string | null;
  /** Código estable del error del motor (p. ej. `MESH_INVALID`) y su causa técnica, si los hay. */
  errorCode?: string;
  errorDetail?: string;
  /** «Comparar»: oculta el fantasma para ver solo la pieza original. */
  comparing: boolean;
  /** Dibuja las aristas (alambre) de la malla simplificada sobre el sólido translúcido. */
  edges: boolean;
  /**
   * Estado del fantasma: `shown` se dibuja; `heavy` el resultado supera `SIMPLIFY_GHOST_MAX_TRIANGLES` (solo informe);
   * `none` no hay malla que mostrar (no se aplicaría nada: sin reducción, bloqueado o rechazado).
   */
  ghost: 'shown' | 'heavy' | 'none';
  /** Triángulos de la malla del fantasma (0 si no hay). */
  ghostTriangles: number;
  /** Qué malla muestra: la que se aplicaría o, si el motor la guardó, la pedida. */
  variant: 'applied' | 'requested';
  /** true si el cálculo trae también la malla pedida (la variante pedida se puede ver sin recalcular). */
  hasRequested: boolean;
}

/** Campos del fantasma de una sesión recién creada (sin fantasma, aristas activadas). */
export const SIMPLIFY_GHOST_DEFAULTS = {
  comparing: false, edges: true, ghost: 'none', ghostTriangles: 0, variant: 'applied', hasRequested: false,
} as const satisfies Pick<SimplifyPreviewSession, 'comparing' | 'edges' | 'ghost' | 'ghostTriangles' | 'variant' | 'hasRequested'>;

export interface SimplifyPreviewOptions {
  /** true: los errores del motor se relanzan (Command Bus) en vez de quedar en la sesión. */
  rethrow?: boolean;
}

export interface SimplifyPreviewSliceState {
  simplifyPreview: SimplifyPreviewSession | null;
  /** Calcula (o reutiliza) el informe sin aplicar. null si se canceló, falló o no hay objeto editable. */
  previewSimplify: (id: string, request: SimplifyRequest, options?: SimplifyPreviewOptions) => Promise<SimplifyReport | null>;
  /** Cancela el cálculo en curso (botón «Cancelar»). */
  cancelSimplifyPreview: () => void;
  /** Descarta la vista previa y su resultado (cambio de parámetros, de selección o desmontaje). */
  clearSimplifyPreview: () => void;
  /** Para Simplificar: el cambio ya calculado si la malla, la escala y los parámetros coinciden (y lo descarta). */
  consumeSimplifyPreview: (obj: SceneObject, request: SimplifyRequest) => SceneChange | null;
  /** «Comparar»: oculta o muestra el fantasma sin recalcular. */
  setSimplifyComparing: (comparing: boolean) => void;
  /** Aristas sobre el fantasma (se recuerda para las siguientes vistas previas). */
  setSimplifyGhostEdges: (edges: boolean) => void;
  /** Cambia entre lo que se aplicaría y lo pedido, sin recalcular; no hace nada si la pedida no se guardó. */
  setSimplifyGhostVariant: (variant: 'applied' | 'requested') => void;
}

/** Firma estable de una petición (orden de claves fijo). */
export function simplifySignature(request: SimplifyRequest): string {
  const entries = Object.entries(request).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/**
 * Informe tal como lo ve el usuario: los triángulos de antes son los de la escena y los de después, los de la malla
 * que quedaría (el motor cuenta la malla ya soldada y puede diferir en unos pocos). Lo comparten aplicar y la vista
 * previa para que muestren lo mismo.
 */
export function sceneSimplifyReport(obj: SceneObject, change: SceneChange): SimplifyReport {
  const engineReport = change.simplify!.report;
  const blocked = !engineReport.applied && (engineReport.destructive?.length ?? 0) > 0;
  const after = engineReport.applied
    ? (change.patches[0]?.patch.stats?.triangles ?? engineReport.trianglesAfter)
    : blocked ? engineReport.trianglesAfter : obj.stats.triangles;
  return { ...engineReport, objectId: obj.id, trianglesBefore: obj.stats.triangles, trianglesAfter: after };
}

interface Cached {
  objectId: string;
  signature: string;
  mesh: MeshData;
  scale: number[];
  change: SceneChange;
}

export function createSimplifyPreviewSlice(ctx: StoreContext): SimplifyPreviewSliceState {
  const { set, get, startEngineJob } = ctx;
  let generation = 0;
  let cached: Cached | null = null;
  let activeJob: { cancel: (mode?: EngineCancelMode) => void } | null = null;
  let edgesPref = true;

  const patchSession = (p: Partial<SimplifyPreviewSession>) => {
    const cur = get().simplifyPreview;
    if (cur) set({ simplifyPreview: { ...cur, ...p } });
  };
  const newSession = (objectId: string, status: SimplifyPreviewStatus, signature: string, report: SimplifyReport | null): SimplifyPreviewSession => ({
    objectId, status, phase: null, signature, report, error: null, ...SIMPLIFY_GHOST_DEFAULTS, edges: edgesPref,
  });
  const dropGhost = () => {
    if (get().operationPreview.key === SIMPLIFY_PREVIEW_KEY) set({ operationPreview: EMPTY_PREVIEW });
  };
  /** Dibuja (o quita) el fantasma según el estado de la sesión y el cambio guardado. */
  const renderGhost = () => {
    const session = get().simplifyPreview;
    const objects = get().objects;
    const obj = session ? objects.find((o) => o.id === session.objectId) : undefined;
    const hit = session && obj && session.status === 'ready' ? cacheFor(obj, session.signature) : null;
    if (!session || !obj || !hit) { dropGhost(); return; }
    const requested = hit.change.simplify?.requestedMesh;
    let ghosts: PreviewGhost[] = ghostsFromChange(hit.change, objects);
    if (session.variant === 'requested' && requested) {
      ghosts = [{ id: obj.id, mesh: requested, position: obj.position, rotation: obj.rotation, scale: obj.scale, role: 'result' }];
    }
    const triangles = ghosts.reduce((n, g) => n + g.mesh.indices.length / 3, 0);
    const ghost: SimplifyPreviewSession['ghost'] = ghosts.length === 0 ? 'none' : ghostTooHeavy(triangles) ? 'heavy' : 'shown';
    const wire = session.edges && triangles <= SIMPLIFY_GHOST_WIRE_MAX_TRIANGLES;
    const drawn = ghost === 'shown' && !session.comparing
      ? ghosts.map((g) => ({ ...g, display: wire ? 'solidWire' as const : 'solid' as const }))
      : [];
    set({
      simplifyPreview: { ...session, ghost, ghostTriangles: ghosts.length === 0 ? 0 : triangles, hasRequested: Boolean(requested) },
      operationPreview: drawn.length > 0
        ? { key: SIMPLIFY_PREVIEW_KEY, status: 'ready', ghosts: drawn, guides: [] }
        : get().operationPreview.key === SIMPLIFY_PREVIEW_KEY ? EMPTY_PREVIEW : get().operationPreview,
    });
  };
  const cacheFor = (obj: SceneObject, signature: string): Cached | null =>
    cached && cached.objectId === obj.id && cached.signature === signature && cached.mesh === obj.mesh &&
    cached.scale.every((s, k) => s === obj.scale[k]) ? cached : null;
  const messageOf = (err: unknown): string => {
    if (isEngineError(err)) return localizeEngineErrorForUser(get().language, err);
    if (err instanceof CommandError) return ctx.tr(err.key, err.params);
    return err instanceof Error ? err.message : String(err);
  };

  return {
    simplifyPreview: null,

    previewSimplify: async (id, request, options = {}) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked || get().busyOperation) return null;
      const signature = simplifySignature(request);
      const hit = cacheFor(obj, signature);
      if (hit) {
        const report = sceneSimplifyReport(obj, hit.change);
        set({ simplifyPreview: newSession(id, 'ready', signature, report) });
        renderGhost();
        return report;
      }
      // Parámetros nuevos: la anterior se cancela en suave (el Worker sigue vivo).
      activeJob?.cancel('soft');
      const gen = ++generation;
      cached = null;
      dropGhost();
      set({ simplifyPreview: newSession(id, 'computing', signature, null) });
      try {
        await get().initEngine();
        if (gen !== generation) return null;
        const job = startEngineJob('simplify', { obj, request }, (phase) => {
          if (gen === generation) patchSession({ phase });
        });
        activeJob = job;
        const change = await job.promise;
        if (gen !== generation) return null;
        activeJob = null;
        cached = { objectId: id, signature, mesh: obj.mesh, scale: [...obj.scale], change };
        const report = sceneSimplifyReport(obj, change);
        patchSession({ status: 'ready', phase: null, report });
        renderGhost();
        return report;
      } catch (err) {
        if (gen !== generation) return null;
        activeJob = null;
        dropGhost();
        if (isEngineCancelled(err)) {
          set({ simplifyPreview: null });
          return null;
        }
        const cause = isEngineError(err) ? err.params.cause : undefined;
        patchSession({
          status: 'error', phase: null, error: messageOf(err),
          ...(isEngineError(err) ? { errorCode: err.code } : {}), ...(cause !== undefined ? { errorDetail: String(cause) } : {}),
        });
        if (options.rethrow) throw err;
        return null;
      }
    },

    cancelSimplifyPreview: () => {
      if (get().simplifyPreview?.status !== 'computing') return;
      generation++;
      activeJob?.cancel('hard');
      activeJob = null;
      dropGhost();
      set({ simplifyPreview: null });
    },

    clearSimplifyPreview: () => {
      generation++;
      activeJob?.cancel('soft');
      activeJob = null;
      cached = null;
      dropGhost();
      if (get().simplifyPreview) set({ simplifyPreview: null });
    },

    consumeSimplifyPreview: (obj, request) => {
      const hit = cacheFor(obj, simplifySignature(request));
      if (!hit) return null;
      cached = null;
      dropGhost();
      set({ simplifyPreview: null });
      return hit.change;
    },

    setSimplifyComparing: (comparing) => {
      if (get().simplifyPreview?.status !== 'ready') return;
      patchSession({ comparing });
      renderGhost();
    },

    setSimplifyGhostEdges: (edges) => {
      edgesPref = edges;
      if (!get().simplifyPreview) return;
      patchSession({ edges });
      renderGhost();
    },

    setSimplifyGhostVariant: (variant) => {
      const session = get().simplifyPreview;
      if (session?.status !== 'ready' || (variant === 'requested' && !session.hasRequested)) return;
      patchSession({ variant });
      renderGhost();
    },
  };
}

/**
 * Cambiar la selección descarta la vista previa (y cancela en suave su cálculo); también si la pieza desaparece o su
 * malla o escala cambian (deshacer, otra operación, el puente MCP): el fantasma nunca queda huérfano.
 */
export function clearSimplifyPreviewOnSelectionChange(store: {
  subscribe: (listener: (state: KuraStoreState, prev: KuraStoreState) => void) => () => void;
}): () => void {
  return store.subscribe((state, prev) => {
    const session = state.simplifyPreview;
    if (!session) return;
    if (state.selectedIds !== prev.selectedIds) { state.clearSimplifyPreview(); return; }
    if (state.objects === prev.objects) return;
    const now = state.objects.find((o) => o.id === session.objectId);
    const before = prev.objects.find((o) => o.id === session.objectId);
    if (!now || (before && (before.mesh !== now.mesh || before.scale.some((v, k) => v !== now.scale[k])))) state.clearSimplifyPreview();
  });
}
