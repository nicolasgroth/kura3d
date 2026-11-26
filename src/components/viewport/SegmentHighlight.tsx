/**
 * @file src/components/viewport/SegmentHighlight.tsx
 * @description Resalta en el visor la estructura detectada bajo el cursor o elegida en la lista del
 * inspector: tinte translúcido y contorno sobre una copia de sus triángulos. No toca la malla, el
 * historial ni la selección de objetos, y no recibe clics.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useKuraStore } from '../../store/useKuraStore';
import { buildRegionOverlay } from '../../utils/segmentHighlight';

const TINT = '#fbbf24';

export const SegmentHighlight: React.FC = () => {
  const segmentation = useKuraStore((s) => s.activeSegmentation);
  const hoveredId = useKuraStore((s) => s.hoveredRegionId);
  const selectedId = useKuraStore((s) => s.selectedRegionId);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const setHovered = useKuraStore((s) => s.setHoveredRegionId);
  const setSelected = useKuraStore((s) => s.setSelectedRegionId);
  const obj = useKuraStore((s) => (s.activeSegmentation ? s.objects.find((o) => o.id === s.activeSegmentation?.objectId) ?? null : null));

  const objectSelected = Boolean(segmentation && selectedIds.includes(segmentation.objectId));

  // Cambiar la selección (o cerrar el resultado) limpia el resaltado.
  useEffect(() => {
    if (!objectSelected) {
      setHovered(null);
      setSelected(null);
    }
  }, [objectSelected, setHovered, setSelected]);

  const region = useMemo(() => {
    if (!segmentation || !objectSelected) return null;
    const id = hoveredId ?? selectedId;
    return id ? (segmentation.regions.find((r) => r.id === id) ?? null) : null;
  }, [segmentation, objectSelected, hoveredId, selectedId]);

  const geos = useMemo(() => {
    if (!region || !obj) return null;
    const { fill, outline } = buildRegionOverlay(obj.mesh.positions, obj.mesh.indices, region.faceIndices);
    const fillGeo = new THREE.BufferGeometry();
    fillGeo.setAttribute('position', new THREE.BufferAttribute(fill, 3));
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(outline, 3));
    return { fillGeo, lineGeo };
  }, [region, obj]);

  useEffect(
    () => () => {
      geos?.fillGeo.dispose();
      geos?.lineGeo.dispose();
    },
    [geos],
  );

  if (!geos || !obj) return null;
  return (
    <group position={obj.position} rotation={obj.rotation} scale={obj.scale} raycast={() => null}>
      <mesh geometry={geos.fillGeo} renderOrder={20} raycast={() => null}>
        <meshBasicMaterial
          color={TINT}
          transparent
          opacity={0.45}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments geometry={geos.lineGeo} renderOrder={21} raycast={() => null}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.95} depthTest={false} />
      </lineSegments>
    </group>
  );
};
