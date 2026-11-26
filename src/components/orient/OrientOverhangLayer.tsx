/**
 * @file src/components/orient/OrientOverhangLayer.tsx
 * @description Capa del visor de «Orientar para imprimir»: sobre el fantasma de la orientación en vista previa
 * (`operationPreview` con clave `orient`) pinta en naranja los triángulos que necesitarían soporte. Usa la misma
 * pose que el fantasma, no recibe clics y no toca la escena. La leyenda con texto está en el panel.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ORIENT_PREVIEW_KEY } from '../../store/slices/orientSlice';
import { useKuraStore } from '../../store/useKuraStore';

const OVERHANG_COLOR = '#f97316';
const noRaycast = () => null;

export const OrientOverhangLayer: React.FC = () => {
  const overhang = useKuraStore((s) => s.orientOverhang);
  const previewId = useKuraStore((s) => s.orientPreviewId);
  const preview = useKuraStore((s) => s.operationPreview);
  const ghost = preview.key === ORIENT_PREVIEW_KEY ? preview.ghosts[0] : undefined;
  const shown = ghost && overhang && overhang.candidateId === previewId && overhang.triangles.length > 0;

  const geometry = useMemo(() => {
    if (!shown || !ghost || !overhang) return null;
    const { positions, indices } = ghost.mesh;
    const out = new Float32Array(overhang.triangles.length * 9);
    let o = 0;
    for (const t of overhang.triangles) {
      for (let k = 0; k < 3; k++) {
        const v = indices[t * 3 + k] * 3;
        out[o++] = positions[v];
        out[o++] = positions[v + 1];
        out[o++] = positions[v + 2];
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(out, 3));
    g.computeVertexNormals();
    return g;
  }, [shown, ghost, overhang]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!shown || !ghost || !geometry) return null;
  return (
    <group position={ghost.position} rotation={ghost.rotation} scale={ghost.scale} raycast={noRaycast} name="orient-overhang">
      <mesh geometry={geometry} renderOrder={32} raycast={noRaycast}>
        <meshBasicMaterial
          color={OVERHANG_COLOR}
          transparent
          opacity={0.85}
          depthWrite={false}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  );
};
