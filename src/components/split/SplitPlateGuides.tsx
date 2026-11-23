/**
 * @file src/components/split/SplitPlateGuides.tsx
 * @description Placas virtuales en el visor cuando el grupo dividido seleccionado está dispuesto
 * para imprimir: contorno de cada placa extra (la 1 es la cama real) (el rótulo "Placa N" lo dibuja `SplitLabels`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { plateOffset, splitArrangementOf, splitGroupOf, splitPlateCount } from '../../core/scene/splitGroups';
import { activeBed } from '../../store/splitCommandSchemas';
import { useKuraStore } from '../../store/useKuraStore';

export const SplitPlateGuides: React.FC = () => {
  const selectedId = useKuraStore((s) => s.selectedIds[0] ?? null);
  const objects = useKuraStore((s) => s.objects);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const customBed = useKuraStore((s) => s.customBedDimensions);
  const bed = activeBed({ printerProfile, customBedDimensions: customBed });
  const group = splitGroupOf(objects, selectedId);
  const plates = group && splitArrangementOf(group, bed.widthMm, bed.depthMm) === 'print' ? splitPlateCount(group) : 0;
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(bed.widthMm, bed.depthMm)), [bed.widthMm, bed.depthMm]);
  useEffect(() => () => edges.dispose(), [edges]);
  if (plates === 0) return null;
  return (
    <group>
      {Array.from({ length: plates }, (_, plate) => {
        const [x, z] = plateOffset(plate, bed.widthMm, bed.depthMm);
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
