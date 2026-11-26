/**
 * @file src/components/split/useSplitManualCuts.ts
 * @description Estado del modo de cortes del panel "Dividir para imprimir": automático o a mano, la lista de planos
 * a mano (ejes del usuario), la caja del modelo para los rangos, el campo `manualCuts` que se agrega a las opciones
 * del plan y el arrastre de un plano a mano en el visor (mueve el plano de la lista que lo originó). La lista se
 * vacía al cambiar de pieza; pasar a «A mano» con la lista vacía parte de la rejilla automática vigente.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BedSplitPlan, SplitManualCut } from '../../engine';
import type { SceneObject } from '../../types/kura';
import { userAxisOfInternal } from '../../core/scene/displayAxes';
import { cutsFromPlan, engineCuts, updateCut, userBoxOfObject, userBoxOfPlan, type ManualCut, type UserBox } from './splitManualCutsModel';
import type { SplitCutMode } from './SplitManualCutsEditor';

export interface SplitManualCutsState {
  mode: SplitCutMode;
  setMode: (mode: SplitCutMode) => void;
  cuts: ManualCut[];
  setCuts: (cuts: ManualCut[]) => void;
  box: UserBox | null;
  /** Campo para `BedSplitPlanOptions` (vacío en automático). */
  planField: { manualCuts?: SplitManualCut[] };
  /** A mano sin planos: no hay plan que pedir. */
  empty: boolean;
  /** Arrastre en el visor de un plano del plan (`eje:índice` interno) a `position` (mm, mundo). `false` si no es a mano. */
  movePlanePosition: (axis: SplitManualCut['axis'], index: number, position: number) => boolean;
}

export function useSplitManualCuts(target: SceneObject | null, plan: BedSplitPlan | null): SplitManualCutsState {
  const [mode, setModeState] = useState<SplitCutMode>('auto');
  const [cuts, setCuts] = useState<ManualCut[]>([]);
  const targetId = target?.id ?? null;
  useEffect(() => {
    setModeState('auto');
    setCuts([]);
  }, [targetId]);
  const mesh = target?.mesh;
  const position = target?.position;
  const rotation = target?.rotation;
  const scale = target?.scale;
  const objectBox = useMemo(
    () => (mesh && position && rotation && scale ? userBoxOfObject({ mesh, position, rotation, scale }) : null),
    [mesh, position, rotation, scale],
  );
  // Sin malla todavía (p. ej. primitiva sin generar): la caja del plan
  const planBounds = plan?.bounds;
  const box = useMemo(() => objectBox ?? (planBounds ? userBoxOfPlan({ bounds: planBounds }) : null), [objectBox, planBounds]);

  const setMode = useCallback((next: SplitCutMode) => {
    setModeState(next);
    if (next === 'auto') setCuts([]);
    else setCuts((list) => (list.length === 0 && plan && !plan.manual ? cutsFromPlan(plan) : list));
  }, [plan]);

  const planField = useMemo(() => (mode === 'manual' && cuts.length > 0 ? { manualCuts: engineCuts(cuts) } : {}), [mode, cuts]);

  const movePlanePosition = useCallback((axis: SplitManualCut['axis'], index: number, pos: number) => {
    if (mode !== 'manual') return false;
    const p = plan?.planes.find((q) => q.axis === axis && q.index === index);
    if (!p?.cutId || !box) return true;
    const user = Math.round(userAxisOfInternal(axis).sign * pos * 10) / 10;
    setCuts((list) => updateCut(list, p.cutId!, { positionMm: user }, box));
    return true;
  }, [mode, plan, box]);

  return { mode, setMode, cuts, setCuts, box, planField, empty: mode === 'manual' && cuts.length === 0, movePlanePosition };
}
