/**
 * @file src/components/split/SplitPlateGuides.tsx
 * @description Placas virtuales en el visor cuando el grupo dividido seleccionado está dispuesto
 * para imprimir: contorno de cada placa extra (la 1 es la placa real del grupo; las demás, ancladas a ella sin pisar
 * otras placas, `core/scene/splitFrame.ts`) (el rótulo "Placa N" lo dibuja `SplitLabels`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { splitGroupFrame } from '../../core/scene/splitFrame';
import { splitArrangementOf, splitGroupOf, splitPlateCount } from '../../core/scene/splitGroups';
import { useKuraStore } from '../../store/useKuraStore';
import { useSplitFrames, useSplitPlateSource } from './useSplitFrames';

export const SplitPlateGuides: React.FC = () => {
  const selectedId = useKuraStore((s) => s.selectedIds[0] ?? null);
  const objects = useKuraStore((s) => s.objects);
  const source = useSplitPlateSource();
  const frames = useSplitFrames();
  const group = splitGroupOf(objects, selectedId);
  const plates = group && splitArrangementOf(group, frames) === 'print' ? splitPlateCount(group) : 0;
  // Las placas virtuales parten de la placa real del grupo, con su cama, sin pisar otras placas.
  const frame = group ? splitGroupFrame(group, source) : null;
  const bed = { widthMm: frame?.widthMm ?? 0, depthMm: frame?.depthMm ?? 0 };
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(Math.max(1, bed.widthMm), Math.max(1, bed.depthMm))), [bed.widthMm, bed.depthMm]);
  useEffect(() => () => edges.dispose(), [edges]);
  if (plates === 0 || !frame) return null;
  return (
    <group>
      {Array.from({ length: plates }, (_, plate) => {
        const [x, z] = frame.center(plate);
        return (
          <group key={plate} position={[x, 0.1, z]}>
            {plate > 0 && (
              <lineSegments geometry={edges} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <lineBasicMaterial color="#38bdf8" transparent opacity={0.8} />
              </lineSegments>
            )}
          </group>
        );
      })}
    </group>
  );
};
