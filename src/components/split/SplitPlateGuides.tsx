/**
 * @file src/components/split/SplitPlateGuides.tsx
 * @description Placas virtuales en el visor cuando el grupo dividido seleccionado está dispuesto
 * para imprimir: contorno de cada placa extra (la 1 es la cama real) y rótulo "Placa N".
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { t } from '../../i18n';
import { plateOffsetX, splitArrangementOf, splitGroupOf, splitPlateCount } from '../../core/scene/splitGroups';
import { activeBed } from '../../store/splitCommandSchemas';
import { useKuraStore } from '../../store/useKuraStore';

export const SplitPlateGuides: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const selectedId = useKuraStore((s) => s.selectedIds[0] ?? null);
  const objects = useKuraStore((s) => s.objects);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const customBed = useKuraStore((s) => s.customBedDimensions);
  const bed = activeBed({ printerProfile, customBedDimensions: customBed });
  const group = splitGroupOf(objects, selectedId);
  const plates = group && splitArrangementOf(group, bed.widthMm) === 'print' ? splitPlateCount(group) : 0;
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(bed.widthMm, bed.depthMm)), [bed.widthMm, bed.depthMm]);
  useEffect(() => () => edges.dispose(), [edges]);
  if (plates === 0) return null;
  return (
    <group>
      {Array.from({ length: plates }, (_, plate) => {
        const x = plateOffsetX(plate, bed.widthMm);
        return (
          <group key={plate} position={[x, 0.1, 0]}>
            {plate > 0 && (
              <lineSegments geometry={edges} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <lineBasicMaterial color="#38bdf8" transparent opacity={0.8} />
              </lineSegments>
            )}
            <Html position={[0, 0, bed.depthMm / 2 + 12]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <span className="kura-split-plate-tag">{t(language, 'split.plate', { n: plate + 1 })}</span>
            </Html>
          </group>
        );
      })}
    </group>
  );
};
