/**
 * @file src/components/viewport/PreviewLayers.tsx
 * @description Capas de vista previa del Canvas: plano de corte arrastrable y mallas fantasma
 * de `operationPreview` (translúcidas con color de acento; atenuadas mientras se recalculan) con
 * sus rótulos. No se pueden seleccionar ni entran a la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { t, type TranslationKey } from '../../i18n';
import type { PreviewGhost, PreviewRole } from '../../store/slices/previewSlice';
import { useKuraStore } from '../../store/useKuraStore';
import { LaserCutPreview } from './LaserCutPreview';

const ROLE_COLOR: Record<PreviewRole, string> = { result: '#22d3ee', base: '#38bdf8', tool: '#f43f5e' };

const GhostMesh: React.FC<{ ghost: PreviewGhost; dimmed: boolean }> = ({ ghost, dimmed }) => {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(ghost.mesh.positions, 3));
    g.setIndex(new THREE.BufferAttribute(ghost.mesh.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [ghost.mesh]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 30), [geometry]);
  useEffect(
    () => () => {
      geometry.dispose();
      edges.dispose();
    },
    [geometry, edges],
  );
  const color = ROLE_COLOR[ghost.role];
  return (
    <group position={ghost.position} rotation={ghost.rotation} scale={ghost.scale} raycast={() => null}>
      <mesh geometry={geometry} renderOrder={30} raycast={() => null}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.25}
          transparent
          opacity={dimmed ? 0.16 : 0.42}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments geometry={edges} renderOrder={31} raycast={() => null}>
        <lineBasicMaterial color={color} transparent opacity={dimmed ? 0.3 : 0.85} depthWrite={false} />
      </lineSegments>
    </group>
  );
};

export const PreviewLayers: React.FC = () => {
  const preview = useKuraStore((s) => s.operationPreview);
  const language = useKuraStore((s) => s.language);
  const dimmed = preview.status === 'pending';
  return (
    <>
      <LaserCutPreview />
      {preview.ghosts.map((g) => (
        <GhostMesh key={`${g.id}:${g.role}`} ghost={g} dimmed={dimmed} />
      ))}
      {preview.guides.map((guide) => (
        <Html key={guide.id} position={guide.position} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <span className="kura-preview-tag" data-role={guide.role}>
            {guide.labelKey ? t(language, guide.labelKey as TranslationKey) : ''}
          </span>
        </Html>
      ))}
    </>
  );
};
