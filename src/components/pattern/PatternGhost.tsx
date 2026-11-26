/**
 * @file src/components/pattern/PatternGhost.tsx
 * @description Vista previa fantasma del panel «Patrón» en el visor: las copias translúcidas de cada pieza de origen, una
 * malla instanciada por pieza (comparte la geometría de la original) con la matriz de cada copia. Solo dibujo: no recibe
 * clics ni toca la escena. Los datos los calcula el panel con `core/scene/patternGhost.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { PatternGhostEntry } from '../../core/scene/patternGhost';
import { usePatternPanel } from '../../store/patternPanel';
import { buildGhostGeometry } from '../viewport/ghostGeometry';

const GHOST_COLOR = '#38bdf8';

const Instances: React.FC<{ entry: PatternGhostEntry }> = ({ entry }) => {
  const geometry = useMemo(() => buildGhostGeometry(entry.mesh), [entry.mesh]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const attribute = useMemo(() => new THREE.InstancedBufferAttribute(entry.matrices, 16), [entry.matrices]);
  return (
    <instancedMesh
      key={`${entry.sourceId}-${entry.count}`}
      args={[geometry, undefined, entry.count]}
      instanceMatrix={attribute}
      frustumCulled={false}
      renderOrder={30}
      raycast={() => null}
    >
      {/* Doble cara: el reflejo del espejo invierte el sentido de los triángulos. */}
      <meshStandardMaterial color={GHOST_COLOR} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
    </instancedMesh>
  );
};

export const PatternGhost: React.FC = () => {
  const ghost = usePatternPanel((s) => (s.open ? s.ghost : null));
  if (!ghost) return null;
  return (
    <group name="pattern-preview">
      {ghost.entries.map((e) => <Instances key={e.sourceId} entry={e} />)}
    </group>
  );
};
