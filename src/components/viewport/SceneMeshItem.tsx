/**
 * @file src/components/viewport/SceneMeshItem.tsx
 * @description Malla de un objeto de escena: caché de geometría, materiales PBR, sección Rayos X, voladizos y pintura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { X } from 'lucide-react';
import { useKuraStore } from '../../store/useKuraStore';
import { MATERIAL_PRESETS, type SceneObject, type Vec3 } from '../../types/kura';
import { updateGeometryFaceColors } from '../../engine/paintColorAttribute';
import { buildViewportGeometry } from './creasedGeometry';
import { hidePaintCursor, updatePaintCursor } from './PaintBrushCursor';

/** Renderiza un SceneObject con caché de BufferGeometry, materiales PBR, sección Rayos X y voladizos. */
export const SceneMeshItem: React.FC<{
  obj: SceneObject;
  isSelected: boolean;
  isPrimarySelected: boolean;
  clipPlane: THREE.Plane | null;
  overhangFaces: number[] | null;
  onStartPaintDrag: () => void;
  onObjectContextMenu: (id: string, clientX: number, clientY: number) => void;
  registerGroupRef: (id: string, group: THREE.Group | null) => void;
}> = React.memo(
  ({
    obj,
    isSelected,
    isPrimarySelected,
    clipPlane,
    overhangFaces,
    onStartPaintDrag,
    onObjectContextMenu,
    registerGroupRef,
  }) => {
    const groupRef = useRef<THREE.Group | null>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const lastPaintMoveAtRef = useRef(0);
    const popCompletedRef = useRef(false);

    const activeTool = useKuraStore((s) => s.activeTool);
    const paintMode = useKuraStore((s) => s.paintMode);
    const spawnedAt = useKuraStore((s) => s.spawnedAtById[obj.id]);
    const selectObject = useKuraStore((s) => s.selectObject);
    const paintObjectSurface = useKuraStore((s) => s.paintObjectSurface);
    const beginPaintStroke = useKuraStore((s) => s.beginPaintStroke);
    const eraseSphereOnObject = useKuraStore((s) => s.eraseSphereOnObject);

    // Animación elástica de aparición (0.78 -> 1.0 en ~240ms; cero costo tras finalizar)
    useFrame(() => {
      if (!spawnedAt || popCompletedRef.current || !groupRef.current) return;
      const elapsed = Date.now() - spawnedAt;
      if (elapsed >= 250) {
        popCompletedRef.current = true;
        groupRef.current.scale.set(obj.scale[0], obj.scale[1], obj.scale[2]);
        return;
      }
      const p = Math.max(0, Math.min(1, elapsed / 240));
      const eased = 1 + 1.15 * Math.pow(p - 1, 3) + 0.15 * Math.pow(p - 1, 2);
      const factor = 0.78 + 0.22 * eased;
      groupRef.current.scale.set(
        obj.scale[0] * factor,
        obj.scale[1] * factor,
        obj.scale[2] * factor,
      );
    });

    // La geometría depende solo de posiciones/índices/normales (inmutables y compartidas al pintar).
    // Pintar cambia `faceColors`: se reescribe en sitio el atributo `color`, sin reconstruir nada.
    const hasFaceColors = Boolean(obj.mesh.faceColors && obj.mesh.faceColors.length > 0);
    const baseColor = obj.isHole ? '#f97316' : obj.color;

    const geometry = useMemo(() => {
      return buildViewportGeometry(obj.mesh, hasFaceColors ? baseColor : undefined);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [obj.mesh.positions, obj.mesh.indices, obj.mesh.normals, hasFaceColors]);

    useLayoutEffect(() => {
      if (!hasFaceColors || !obj.mesh.faceColors) return;
      updateGeometryFaceColors(geometry, obj.mesh.faceColors, baseColor);
    }, [geometry, hasFaceColors, obj.mesh.faceColors, baseColor]);

    useEffect(() => {
      return () => {
        geometry.dispose();
      };
    }, [geometry]);

    // Malla superpuesta liviana para resaltar en rojo los triángulos en voladizo (> 45°)
    const overhangGeo = useMemo(() => {
      if (!overhangFaces || overhangFaces.length === 0) return null;
      const positions = obj.mesh.positions;
      const indices = obj.mesh.indices;
      const buf = new Float32Array(overhangFaces.length * 9);
      let cursor = 0;

      for (const faceIdx of overhangFaces) {
        const base = faceIdx * 3;
        if (base + 2 >= indices.length) continue;
        const i0 = indices[base] * 3;
        const i1 = indices[base + 1] * 3;
        const i2 = indices[base + 2] * 3;
        buf[cursor++] = positions[i0];
        buf[cursor++] = positions[i0 + 1];
        buf[cursor++] = positions[i0 + 2];
        buf[cursor++] = positions[i1];
        buf[cursor++] = positions[i1 + 1];
        buf[cursor++] = positions[i1 + 2];
        buf[cursor++] = positions[i2];
        buf[cursor++] = positions[i2 + 1];
        buf[cursor++] = positions[i2 + 2];
      }

      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(buf.subarray(0, cursor), 3));
      g.computeVertexNormals();
      return g;
    }, [obj.mesh.positions, obj.mesh.indices, overhangFaces]);

    useEffect(() => {
      return () => {
        overhangGeo?.dispose();
      };
    }, [overhangGeo]);

    const selectionBoxGeo = useMemo(() => {
      if (!isSelected) return null;
      geometry.computeBoundingBox();
      const bb = geometry.boundingBox;
      if (!bb) return null;
      const size = bb.getSize(new THREE.Vector3());
      const box = new THREE.BoxGeometry(
        Math.max(0.5, size.x + 0.8),
        Math.max(0.5, size.y + 0.8),
        Math.max(0.5, size.z + 0.8),
      );
      const edges = new THREE.EdgesGeometry(box);
      box.dispose();
      return edges;
    }, [isSelected, geometry]);

    const selectionCenter = useMemo(() => {
      if (!isSelected || !geometry.boundingBox) return [0, 0, 0] as Vec3;
      const c = geometry.boundingBox.getCenter(new THREE.Vector3());
      return [c.x, c.y, c.z] as Vec3;
    }, [isSelected, geometry]);

    useEffect(() => {
      return () => {
        selectionBoxGeo?.dispose();
      };
    }, [selectionBoxGeo]);

    const handleGroupRef = useCallback(
      (node: THREE.Group | null) => {
        groupRef.current = node;
        registerGroupRef(obj.id, node);
      },
      [obj.id, registerGroupRef],
    );

    if (!obj.visible) {
      return null;
    }

    const hasVertexColors = geometry.hasAttribute('color');
    const matPreset = MATERIAL_PRESETS[obj.materialPreset ?? 'pla_matte'] ?? MATERIAL_PRESETS.pla_matte;
    const activeClipPlanes = clipPlane ? [clipPlane] : [];

    const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.button !== 0) return;

      if (activeTool === 'paint') {
        if (obj.locked) return;
        onStartPaintDrag();
        beginPaintStroke();
        lastPaintMoveAtRef.current = performance.now();
        const localPt = meshRef.current
          ? meshRef.current.worldToLocal(e.point.clone())
          : e.point.clone();
        paintObjectSurface(
          obj.id,
          [localPt.x, localPt.y, localPt.z],
          e.faceIndex ?? null,
        );
        return;
      }

      if (activeTool === 'erase') {
        if (obj.locked) return;
        void eraseSphereOnObject(obj.id, [e.point.x, e.point.y, e.point.z]);
        return;
      }

      const additive = e.ctrlKey || e.metaKey || e.shiftKey;
      selectObject(obj.id, additive);
    };

    const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'paint' || paintMode !== 'brush' || obj.locked) return;
      updatePaintCursor(e);
      if ((e.buttons & 1) === 0) return;
      e.stopPropagation();

      const now = performance.now();
      if (now - lastPaintMoveAtRef.current < 45) return;
      lastPaintMoveAtRef.current = now;

      const localPt = meshRef.current
        ? meshRef.current.worldToLocal(e.point.clone())
        : e.point.clone();
      paintObjectSurface(
        obj.id,
        [localPt.x, localPt.y, localPt.z],
        e.faceIndex ?? null,
      );
    };

    const handleContextMenu = (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      onObjectContextMenu(obj.id, e.nativeEvent.clientX, e.nativeEvent.clientY);
    };

    return (
      <group
        ref={handleGroupRef}
        position={obj.position}
        rotation={obj.rotation}
        scale={obj.scale}
      >
        <mesh
          ref={meshRef}
          geometry={geometry}
          castShadow={!obj.isHole}
          receiveShadow
          renderOrder={obj.isHole ? 8 : 0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerOut={hidePaintCursor}
          onContextMenu={handleContextMenu}
        >
          {obj.isHole ? (
            <meshStandardMaterial
              key={`hole_${clipPlane ? 'clip' : 'full'}`}
              color="#f97316"
              transparent
              opacity={0.44}
              roughness={0.45}
              depthWrite={false}
              side={clipPlane ? THREE.DoubleSide : THREE.FrontSide}
              clippingPlanes={activeClipPlanes}
            />
          ) : (
            <meshStandardMaterial
              key={`${hasVertexColors ? 'vc' : 'solid'}_${matPreset.id}_${clipPlane ? 'clip' : 'full'}`}
              color={hasVertexColors ? '#ffffff' : obj.color}
              vertexColors={hasVertexColors}
              roughness={matPreset.roughness}
              metalness={matPreset.metalness}
              opacity={matPreset.opacity}
              transparent={matPreset.transparent}
              depthWrite={!matPreset.transparent || matPreset.opacity >= 0.99}
              side={clipPlane ? THREE.DoubleSide : THREE.FrontSide}
              clippingPlanes={activeClipPlanes}
            />
          )}
        </mesh>

        {/* Resaltado rojo de triángulos en voladizo (> 45°) del Validador Estructural */}
        {overhangGeo && (
          <mesh geometry={overhangGeo} renderOrder={7}>
            <meshBasicMaterial
              color="#ef4444"
              transparent
              opacity={0.78}
              side={THREE.DoubleSide}
              polygonOffset
              polygonOffsetFactor={-1}
              clippingPlanes={activeClipPlanes}
            />
          </mesh>
        )}

        {/* Contorno rayos-X sutil para que volúmenes negativos internos siempre se distingan */}
        {obj.isHole && (
          <mesh geometry={geometry} renderOrder={9}>
            <meshBasicMaterial
              color="#fb923c"
              wireframe
              transparent
              opacity={0.28}
              depthTest={false}
              clippingPlanes={activeClipPlanes}
            />
          </mesh>
        )}

        {isSelected && selectionBoxGeo && (
          <lineSegments geometry={selectionBoxGeo} position={selectionCenter}>
            <lineBasicMaterial
              color={isPrimarySelected ? '#38bdf8' : '#f97316'}
              transparent
              opacity={0.85}
            />
          </lineSegments>
        )}
      </group>
    );
  },
);
