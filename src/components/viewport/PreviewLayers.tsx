/**
 * @file src/components/viewport/PreviewLayers.tsx
 * @description Capas de vista previa del Canvas: plano de corte arrastrable y mallas fantasma
 * de `operationPreview` (translúcidas con color de acento; atenuadas mientras se recalculan) con
 * sus rótulos. No se pueden seleccionar ni entran a la escena. Los fantasmas con `display` (Simplificar, mallas
 * densas) saltan el cálculo de aristas vivas y dibujan, si se pide, el alambre de triángulos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo } from 'react';
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { t, type TranslationKey } from '../../i18n';
import type { PreviewGhost, PreviewRole } from '../../store/slices/previewSlice';
import { useKuraStore } from '../../store/useKuraStore';
import { buildGhostGeometry } from './ghostGeometry';
import { LaserCutPreview } from './LaserCutPreview';
import { SplitPlanPreview } from '../split/SplitPlanPreview';
import { SplitJointHighlight } from '../split/SplitJointHighlight';
import { SplitPlateGuides } from '../split/SplitPlateGuides';
import { SplitLabels } from '../split/SplitLabels';

const ROLE_COLOR: Record<PreviewRole, string> = { result: '#22d3ee', base: '#38bdf8', tool: '#f43f5e' };

const GhostMesh: React.FC<{ ghost: PreviewGhost; dimmed: boolean }> = ({ ghost, dimmed }) => {
  // Con `display` (mallas densas) no se calculan aristas vivas: solo sólido y, si se pide, el alambre de triángulos.
  const light = ghost.display !== undefined;
  const geometry = useMemo(() => buildGhostGeometry(ghost.mesh), [ghost.mesh]);
  const edges = useMemo(() => (light ? null : new THREE.EdgesGeometry(geometry, 30)), [geometry, light]);
  useEffect(
    () => () => {
      geometry.dispose();
      edges?.dispose();
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
      {edges && (
        <lineSegments geometry={edges} renderOrder={31} raycast={() => null}>
          <lineBasicMaterial color={color} transparent opacity={dimmed ? 0.3 : 0.85} depthWrite={false} />
        </lineSegments>
      )}
      {ghost.display === 'solidWire' && (
        <mesh geometry={geometry} renderOrder={31} raycast={() => null}>
          <meshBasicMaterial color={color} wireframe transparent opacity={dimmed ? 0.3 : 0.85} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
};

/** Copia invisible de la pieza que recibe el clic de "colocar con clic" (punto y normal de mundo). */
const SurfacePickCatcher: React.FC<{ objectId: string }> = ({ objectId }) => {
  const obj = useKuraStore((s) => s.objects.find((o) => o.id === objectId) ?? null);
  const pick = useKuraStore((s) => s.pickSurfaceAt);
  const geometry = useMemo(() => {
    if (!obj) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(obj.mesh.positions, 3));
    g.setIndex(new THREE.BufferAttribute(obj.mesh.indices, 1));
    g.computeBoundingSphere();
    return g;
  }, [obj]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!obj || !geometry) return null;
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!e.face) return;
    const n = e.face.normal.clone().transformDirection(e.object.matrixWorld);
    pick([e.point.x, e.point.y, e.point.z], [n.x, n.y, n.z]);
  };
  return (
    <mesh
      geometry={geometry}
      position={obj.position}
      rotation={obj.rotation}
      // Apenas más grande para que el rayo la toque antes que la pieza real.
      scale={[obj.scale[0] * 1.003, obj.scale[1] * 1.003, obj.scale[2] * 1.003]}
      onClick={onClick}
      onPointerOver={(e) => ((e.nativeEvent.target as HTMLElement).style.cursor = 'crosshair')}
      onPointerOut={(e) => ((e.nativeEvent.target as HTMLElement).style.cursor = '')}
    >
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
};

export const PreviewLayers: React.FC = () => {
  const preview = useKuraStore((s) => s.operationPreview);
  const language = useKuraStore((s) => s.language);
  const pickId = useKuraStore((s) => s.surfacePick?.objectId ?? null);
  const dimmed = preview.status === 'pending';
  return (
    <>
      <LaserCutPreview />
      <SplitPlanPreview />
      <SplitPlateGuides />
      <SplitLabels />
      <SplitJointHighlight />
      {pickId && <SurfacePickCatcher objectId={pickId} />}
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
