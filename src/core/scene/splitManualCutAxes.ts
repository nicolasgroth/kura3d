/**
 * @file src/core/scene/splitManualCutAxes.ts
 * @description Conversión de los cortes a mano de "dividir para imprimir" entre los ejes del usuario (X derecha,
 * Y fondo, Z arriba: los del panel, el bus y el MCP) y los del motor (`SplitManualCut`). El eje base y la posición
 * siguen `displayAxes.ts`; los dos ángulos se inclinan hacia los otros dos ejes en orden alfabético en cada sistema
 * (x: [y, z], y: [x, z], z: [x, y]), con el signo que corresponda al cambio de eje.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SplitAxis, SplitManualCut } from '../../engine/split/splitTypes';
import { internalAxisOfUser, userAxisOfInternal, type AxisName } from './displayAxes';

/** Corte a mano en ejes del usuario. */
export interface UserManualCut {
  id?: string;
  axis: AxisName;
  positionMm: number;
  /** Inclinación (grados) hacia los otros dos ejes del usuario en orden alfabético. */
  tiltDeg: [number, number];
}

/** Ejes hacia los que se inclina cada eje base (mismo orden en usuario y motor). */
export const TILT_TOWARD: Record<AxisName, [AxisName, AxisName]> = { x: ['y', 'z'], y: ['x', 'z'], z: ['x', 'y'] };

type Mapper = (a: AxisName) => { axis: AxisName; sign: 1 | -1 };

/** Convierte un corte de un sistema al otro con `map` (eje y signo del eje destino). */
function convert(cut: { id?: string; axis: AxisName; positionMm: number; tiltDeg?: [number, number] }, map: Mapper) {
  const base = map(cut.axis);
  const tilt: [number, number] = [0, 0];
  const src = cut.tiltDeg ?? [0, 0];
  TILT_TOWARD[cut.axis].forEach((toward, k) => {
    const t = map(toward);
    const slot = TILT_TOWARD[base.axis].indexOf(t.axis);
    // n ∝ e_base + tan(θ)·e_toward; al pasar de sistema cada vector toma su signo y se normaliza el de la base
    tilt[slot] = src[k] === 0 ? 0 : t.sign * base.sign * src[k];
  });
  return {
    ...(cut.id !== undefined ? { id: cut.id } : {}),
    axis: base.axis as SplitAxis,
    positionMm: base.sign * cut.positionMm,
    tiltDeg: tilt,
  };
}

export function userCutToInternal(cut: UserManualCut): SplitManualCut {
  const out = convert(cut, internalAxisOfUser);
  return out.tiltDeg.some((v) => v !== 0) ? out : { ...out, tiltDeg: undefined };
}

export function internalCutToUser(cut: SplitManualCut): UserManualCut {
  return convert(cut, userAxisOfInternal);
}
