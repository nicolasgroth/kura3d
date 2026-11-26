/**
 * @file src/store/slices/patternSlice.ts
 * @description «Patrón» en el store: `applyPattern` repite las piezas en fila, rejilla o alrededor de un eje, o las
 * refleja respecto de un plano, y deja las copias en un grupo con nombre («Patrón de Tornillo ×6») dentro de UN paso de
 * deshacer. Las copias conservan color, material, rol (sólido o negativo) y placa; los imanes de una pieza se copian con
 * ella. Con «unir» las copias y las originales pasan por la unión booleana del Worker (cancelable) y quedan en una sola
 * pieza. Sin unir todo es síncrono y barato (las copias comparten la malla de su original). La geometría está en
 * `core/scene/patterns*` y `core/operations/patternOperations`; el plan lo resuelve `store/patternPlanning`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { addonHostId, remapAddonHosts } from '../../core/addons/addonFollow';
import { change, mirrorAcrossPlane, patternCopies, type SceneChange } from '../../core/operations';
import { groupSelection, MAX_GROUP_NAME } from '../../core/scene/groups';
import { makeId } from '../../core/scene/sceneObjects';
import type { SceneObject } from '../../types/kura';
import { resolvePattern, type PatternRequest } from '../patternPlanning';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export interface PatternApplyResult {
  /** Ids de las piezas nuevas (o el de la pieza unida). */
  createdIds: string[];
  groupId: string | null;
  groupName: string | null;
  /** Piezas por pieza de origen (la original incluida). */
  cells: number;
  /** Celdas cuyas cajas se cruzan con otra (0 = ninguna). */
  overlapCells: number;
  /** Id de la pieza resultante cuando se pidió unir. */
  unionId?: string;
}

export interface PatternSliceState {
  /** Aplica el patrón en un paso de deshacer. Devuelve null si no se pudo (ocupado, límite, cancelado); el motivo se avisa. */
  applyPattern: (request: PatternRequest) => Promise<PatternApplyResult | null>;
}

export function createPatternSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const isAddon = (o: SceneObject) => addonHostId(o) !== undefined;
  const { set, get, tr, pushHistory, rejectWhileLocked, runExclusive, runEngine, opCtx, commitChange, reportEngineWarnings } = ctx;

  const groupNameOf = (sources: readonly SceneObject[], req: PatternRequest, cells: number): string => {
    const named = sources.filter((s) => !isAddon(s));
    const base = req.kind === 'mirror'
      ? tr(named.length === 1 ? 'pattern.groupName.mirror' : 'pattern.groupName.mirrorMany', { name: named[0]?.name ?? '', count: named.length })
      : tr(named.length === 1 ? 'pattern.groupName' : 'pattern.groupName.many', { name: named[0]?.name ?? '', count: named.length, cells });
    return base.slice(0, MAX_GROUP_NAME);
  };

  /** Agrega las piezas nuevas y, si cabe, las agrupa con sus originales; selecciona todo el patrón. */
  const place = (added: SceneObject[], sources: readonly SceneObject[], groupName: string | null) => {
    const objects = [...get().objects, ...added];
    const ids = [...sources.map((s) => s.id), ...added.map((o) => o.id)];
    const grouped = groupName ? groupSelection({ objects, groups: get().groups }, ids, { id: makeId('grp'), name: groupName }) : null;
    const groupId = grouped ? grouped.groups.find((g) => !get().groups.some((old) => old.id === g.id) && g.name === groupName)?.id ?? null : null;
    set({ objects: grouped?.objects ?? objects, groups: grouped?.groups ?? get().groups, selectedIds: ids });
    return groupId;
  };

  const problemToast = (req: PatternRequest) => {
    const { problem } = resolvePattern(get(), req);
    if (problem) get().addToast(tr(problem.key, problem.params), 'error');
  };

  return {
    applyPattern: async (request) => {
      if (rejectWhileLocked()) return null;
      const resolved = resolvePattern(get(), request);
      if (resolved.problem) {
        problemToast(request);
        return null;
      }
      const { sources, plan, mirror } = resolved;
      if (request.kind !== 'mirror' || request.spec.keepOriginal) {
        // Las originales sin copias no cambian: un patrón de una sola celda no hace nada.
        if (plan.cells < 2) return null;
      }
      if (!request.union && sources.some((s) => s.locked) && request.kind === 'mirror' && !request.spec.keepOriginal) {
        get().addToast(tr('store.error.locked'), 'error');
        return null;
      }
      const cells = plan.cells;
      const groupName = request.kind === 'mirror' && !request.spec.keepOriginal ? null : groupNameOf(sources, request, cells);

      // Espejo sin conservar la original: se reemplaza la malla de cada pieza (un solo paso).
      if (request.kind === 'mirror' && !request.spec.keepOriginal && mirror) {
        const res = mirrorAcrossPlane(opCtx(), { sources, plane: mirror, keepOriginal: false, nameOf: (s) => s.name });
        commitChange(res.change, { select: sources.map((s) => s.id) });
        get().addToast(tr('pattern.toast.mirrored', { count: sources.filter((s) => !isAddon(s)).length }), 'success');
        return { createdIds: [], groupId: null, groupName: null, cells: 1, overlapCells: 0 };
      }

      const nameOf = (src: SceneObject, k: number) => `${src.name} ${k + 1}`;
      const built = request.kind === 'mirror' && mirror
        ? mirrorAcrossPlane(opCtx(), { sources, plane: mirror, keepOriginal: true, nameOf: (s) => `${s.name} ${tr('pattern.mirrorSuffix')}` })
        : patternCopies(opCtx(), { sources, steps: plan.steps, nameOf });
      // Un imán copiado junto con su pieza queda en la copia de la pieza (por celda).
      const copies = built.cells.slice(1).flatMap((row) =>
        remapAddonHosts(row, new Map(sources.map((s, i) => [s.id, row[i].id]))),
      );

      if (!request.union) {
        pushHistory();
        const groupId = place(copies, sources, groupName);
        get().addToast(tr('pattern.toast.done', { count: copies.length, name: groupName ?? '' }), 'success');
        if (plan.overlapCells > 0 && request.kind !== 'mirror') get().addToast(tr('pattern.warn.overlap', { count: plan.overlapCells }), 'info');
        return { createdIds: copies.map((c) => c.id), groupId, groupName, cells, overlapCells: plan.overlapCells };
      }

      // Unir en una sola pieza: la unión corre en el Worker (cancelable) y entra a la escena en el mismo paso.
      const pieces = [...sources, ...copies];
      return runExclusive<PatternApplyResult | null>('pattern', null, async () => {
        const { result, change: boolChange } = await runEngine('boolean', {
          target: pieces[0], tools: pieces.slice(1), op: 'union', name: groupName ?? pieces[0].name,
        });
        if (!result) {
          reportEngineWarnings(boolChange.warnings);
          return null;
        }
        // Las originales salen con las copias (que nunca entraron a la escena): solo se quitan las originales.
        const sourceIds = new Set(sources.map((s) => s.id));
        const merged: SceneChange = change({ added: [result], removedIds: boolChange.removedIds.filter((id) => sourceIds.has(id)), warnings: boolChange.warnings });
        commitChange(merged, { select: [result.id], spawned: [result] });
        get().addToast(tr('pattern.toast.united', { count: pieces.length }), 'success');
        return { createdIds: [result.id], groupId: null, groupName: null, cells, overlapCells: plan.overlapCells, unionId: result.id };
      });
    },
  };
}
