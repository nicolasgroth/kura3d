/**
 * @file src/components/split/useSplitFrames.ts
 * @description Marcos de las placas virtuales de Dividir para la interfaz: el de cada pieza (según su placa real) y la
 * fuente para el del grupo, memorizados mientras no cambien placas ni cama. Lógica en `core/scene/splitFrame.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { useMemo } from 'react';
import { splitFramesOf, splitPlateSourceOf, type SplitPlateSource } from '../../core/scene/splitFrame';
import type { SplitFrames } from '../../core/scene/splitGroups';
import { useKuraStore } from '../../store/useKuraStore';

/** Placas de la escena y cama del proyecto (referencia estable mientras no cambian). */
export function useSplitPlateSource(): SplitPlateSource {
  const plates = useKuraStore((s) => s.plates);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const customBedDimensions = useKuraStore((s) => s.customBedDimensions);
  return useMemo(() => splitPlateSourceOf({ plates, printerProfile, customBedDimensions }), [plates, printerProfile, customBedDimensions]);
}

/** Marco de cada pieza dividida (placas virtuales ancladas a su placa real). */
export function useSplitFrames(): SplitFrames {
  const source = useSplitPlateSource();
  return useMemo(() => splitFramesOf(source), [source]);
}
