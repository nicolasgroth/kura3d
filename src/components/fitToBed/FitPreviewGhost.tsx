/**
 * @file src/components/fitToBed/FitPreviewGhost.tsx
 * @description Fantasma de "Ajustar a la impresora" en el visor: cada objeto del bloque con la
 * transformación de la alternativa elegida (translúcido, sin selección ni raycast). La geometría se
 * comparte con la malla del objeto: no se copia. Se dibuja encima (sin prueba de profundidad) para que se
 * vea aunque quede dentro del original.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { MeshData } from '../../types/kura';
import { useKuraStore } from '../../store/useKuraStore';

const COLOR = '#a78bfa';

const Ghost: React.FC<{ mesh: MeshData; position: THREE.Vector3Tuple; rotation: THREE.Vector3Tuple; scale: THREE.Vector3Tuple }> = ({
  mesh, position, rotation, scale,
}) => {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [mesh]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={position} rotation={rotation} scale={scale} renderOrder={32} raycast={() => null}>
      <meshStandardMaterial color={COLOR} emissive={COLOR} emissiveIntensity={0.3} transparent opacity={0.45} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
    </mesh>
  );
};

export const FitPreviewGhost: React.FC = () => {
  const preview = useKuraStore((s) => s.fitPreview);
  const objects = useKuraStore((s) => s.objects);
  if (!preview) return null;
  return (
    <group name="fit-preview">
      {objects.filter((o) => preview[o.id]).map((o) => {
        const p = preview[o.id];
        return <Ghost key={o.id} mesh={o.mesh} position={p.position} rotation={p.rotation} scale={p.scale} />;
      })}
    </group>
  );
};
