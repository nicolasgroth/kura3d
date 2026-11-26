/**
 * @file src/components/viewport/OpenEdgesOverlay.tsx
 * @description Resalta en el visor los bordes abiertos del diagnóstico de malla vigente (líneas de
 * color sobre el objeto, siempre visibles): así se ve dónde están los agujeros antes de reparar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useKuraStore } from '../../store/useKuraStore';

const OPEN_EDGE_COLOR = '#ff3b6b';

export const OpenEdgesOverlay: React.FC = () => {
  const state = useKuraStore((s) => s.meshDiagnosis);
  const obj = useKuraStore((s) => (state ? s.objects.find((o) => o.id === state.objectId) : undefined));
  const valid = state && state.highlight !== false && obj && obj.mesh === state.mesh && state.diagnosis.openEdgeSegments.length > 0;
  const geometry = useMemo(() => {
    if (!valid) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(state.diagnosis.openEdgeSegments, 3));
    return g;
  }, [valid, state]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry || !obj) return null;
  return (
    <lineSegments
      geometry={geometry}
      position={obj.position}
      rotation={obj.rotation}
      scale={obj.scale}
      renderOrder={10}
      raycast={() => null}
    >
      <lineBasicMaterial color={OPEN_EDGE_COLOR} depthTest={false} transparent opacity={0.95} />
    </lineSegments>
  );
};
