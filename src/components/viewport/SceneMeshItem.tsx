/**
 * @file src/components/viewport/SceneMeshItem.tsx
 * @description Malla de un objeto de escena: caché de geometría, materiales PBR, sección Rayos X, voladizos y pintura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isNegative, isReference, isSolid } from '../../core/scene/objectRole';
import { markContextMenuHandled } from './contextMenu/handledEvents';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { X } from 'lucide-react';
import { useKuraStore } from '../../store/useKuraStore';
import { useSplitExplodedPosition } from '../split/useSplitExplode';
import { useSplitJointDimmed } from '../split/SplitJointHighlight';
import { MATERIAL_PRESETS, type SceneObject, type Vec3 } from '../../types/kura';
import { updateGeometryFaceColors } from '../../engine/paintColorAttribute';
import { regionIdForFace } from '../../utils/segmentHighlight';
import { onMeasureContextMenu, onMeasurePointerDown, onMeasurePointerMove, onMeasurePointerOut } from '../measure/measurePointer';
import { buildViewportGeometry } from './creasedGeometry';
import { hidePaintCursor, updatePaintCursor } from './PaintBrushCursor';
import { hasLiveStroke, queueLiveSample, startLiveStroke } from './livePaintStroke';
import { brushQueryFromEvent, strokeNeedsEdgeRefine, strokeSampleFromEvent, usePaintRaycastAcceleration } from './paintPointer';
import { continueStorePaintStroke, startStorePaintStroke } from './paintStrokeController';
import { ReferenceMeshMaterial, ReferenceOutline } from './ReferenceMaterial';
import { effectiveReferenceOpacity, useReferenceOpacityStore } from '../../store/referenceOpacityStore';

/** Margen total del contorno de selección sobre la pieza y tamaño mínimo, en mm de mundo (no de espacio local). */
const SELECTION_MARGIN_MM = 0.8;
const SELECTION_MIN_MM = 0.5;
/** Aristas de un cubo unitario compartido por todos los contornos; cada uno lo escala a su pieza. */
const UNIT_BOX_EDGES = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));

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
    // Sin selección, el pincel pinta directo el objeto bajo el cursor (el primer trazo lo selecciona).
    const nothingSelected = useKuraStore((s) => s.selectedIds.length === 0);
    const paintTarget = isPrimarySelected || (nothingSelected && !obj.locked && !isReference(obj));
    const spawnedAt = useKuraStore((s) => s.spawnedAtById[obj.id]);
    const displayPosition = useSplitExplodedPosition(obj);
    // Con una unión señalada en la lista, el resto de las piezas del grupo se atenúa.
    const jointDimmed = useSplitJointDimmed(obj);
    const selectObject = useKuraStore((s) => s.selectObject);
    const eraseSphereOnObject = useKuraStore((s) => s.eraseSphereOnObject);
    const setSelectedRegionId = useKuraStore((s) => s.setSelectedRegionId);

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
    const baseColor = isNegative(obj) ? '#f97316' : obj.color;
    const defaultReferenceOpacity = useReferenceOpacityStore((s) => s.defaultOpacity);

    const geometry = useMemo(() => {
      return buildViewportGeometry(obj.mesh, hasFaceColors ? baseColor : undefined);
      // `baseColor` solo importa si hay colores por cara; pintar o recolorear no reconstruye la geometría.
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

    usePaintRaycastAcceleration(
      meshRef,
      geometry,
      obj.visible && ((activeTool === 'paint' && paintTarget) || activeTool === 'measure'),
    );

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

    // Tamaño local de la pieza; el margen del contorno se aplica en espacio de mundo (ver selectionBoxScale)
    const selectionSize = useMemo(() => {
      if (!isSelected) return null;
      geometry.computeBoundingBox();
      const bb = geometry.boundingBox;
      return bb ? bb.getSize(new THREE.Vector3()) : null;
    }, [isSelected, geometry]);
    // El contorno vive dentro del grupo escalado: su margen se divide entre la escala del objeto para que
    // sobre siempre ~0,4 mm por lado en pantalla, sea la escala 1 o 100.
    const selectionBoxScale = useMemo((): Vec3 | null => {
      if (!selectionSize) return null;
      const axis = (size: number, scale: number): number => {
        const k = Math.max(Math.abs(scale), 1e-6);
        return Math.max(SELECTION_MIN_MM / k, size + SELECTION_MARGIN_MM / k);
      };
      return [axis(selectionSize.x, obj.scale[0]), axis(selectionSize.y, obj.scale[1]), axis(selectionSize.z, obj.scale[2])];
    }, [selectionSize, obj.scale]);

    const selectionCenter = useMemo(() => {
      if (!isSelected || !geometry.boundingBox) return [0, 0, 0] as Vec3;
      const c = geometry.boundingBox.getCenter(new THREE.Vector3());
      return [c.x, c.y, c.z] as Vec3;
    }, [isSelected, geometry]);

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
        // Se pinta el objeto seleccionado; sin selección, el que está bajo el pincel (y queda seleccionado).
        // Con otro objeto seleccionado, el clic solo cambia la selección.
        if (!paintTarget) {
          selectObject(obj.id, false);
          return;
        }
        if (!isPrimarySelected) selectObject(obj.id, false);
        onStartPaintDrag();
        const state = useKuraStore.getState();
        // Pincel sin subdivisión: trazo en vivo (pinta por frame y sube a la GPU solo lo cambiado).
        const refine = strokeNeedsEdgeRefine(state.paintRefineEdge, obj.mesh, obj.scale, state.paintRadiusMm);
        if (paintMode === 'brush' && !refine && meshRef.current) {
          if (startLiveStroke(obj.id, () => meshRef.current?.geometry ?? null)) {
            queueLiveSample(obj.id, brushQueryFromEvent(e, meshRef.current, obj.scale, state.paintRadiusMm));
          }
          return;
        }
        lastPaintMoveAtRef.current = performance.now();
        // Abre UN trazo de historial; sobre una primitiva/rosca lo retiene hasta el aviso (nada cambia antes).
        void startStorePaintStroke(obj, strokeSampleFromEvent(e, meshRef.current, obj.scale), refine);
        return;
      }

      if (activeTool === 'measure') {
        onMeasurePointerDown(obj, e);
        return;
      }

      if (activeTool === 'erase') {
        if (obj.locked) return;
        void eraseSphereOnObject(obj.id, [e.point.x, e.point.y, e.point.z]);
        return;
      }

      const additive = e.ctrlKey || e.metaKey || e.shiftKey;
      selectObject(obj.id, additive);

      // Con la lista de estructuras abierta, un clic en el visor elige la estructura en la lista.
      const seg = useKuraStore.getState().activeSegmentation;
      if (seg && seg.objectId === obj.id && e.faceIndex != null) {
        const regionId = regionIdForFace(seg.regions, e.faceIndex);
        if (regionId) setSelectedRegionId(regionId);
      }
    };

    const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
      if (activeTool === 'measure') {
        onMeasurePointerMove(obj, e);
        return;
      }
      if (activeTool !== 'paint' || paintMode !== 'brush' || obj.locked) return;
      if (!paintTarget) {
        hidePaintCursor();
        return;
      }
      updatePaintCursor(e);
      if ((e.buttons & 1) === 0) return;
      e.stopPropagation();

      if (hasLiveStroke(obj.id) && meshRef.current) {
        queueLiveSample(obj.id, brushQueryFromEvent(e, meshRef.current, obj.scale, useKuraStore.getState().paintRadiusMm));
        return;
      }

      const now = performance.now();
      if (now - lastPaintMoveAtRef.current < 45) return;
      lastPaintMoveAtRef.current = now;

      continueStorePaintStroke(obj.id, strokeSampleFromEvent(e, meshRef.current, obj.scale));
    };

    const handleContextMenu = (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      markContextMenuHandled(e.nativeEvent);
      if (activeTool === 'measure' && onMeasureContextMenu()) return;
      onObjectContextMenu(obj.id, e.nativeEvent.clientX, e.nativeEvent.clientY);
    };

    return (
      <group
        ref={handleGroupRef}
        position={displayPosition}
        rotation={obj.rotation}
        scale={obj.scale}
      >
        <mesh
          ref={meshRef}
          geometry={geometry}
          castShadow={isSolid(obj)}
          receiveShadow={!isReference(obj)}
          renderOrder={isNegative(obj) ? 8 : isReference(obj) ? 6 : 0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerOut={activeTool === 'measure' ? onMeasurePointerOut : hidePaintCursor}
          onContextMenu={handleContextMenu}
        >
          {isReference(obj) ? (
            <ReferenceMeshMaterial
              opacity={effectiveReferenceOpacity(obj, defaultReferenceOpacity)}
              doubleSide={Boolean(clipPlane)}
              clippingPlanes={activeClipPlanes}
            />
          ) : isNegative(obj) ? (
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
              opacity={jointDimmed ? Math.min(matPreset.opacity, 0.22) : matPreset.opacity}
              transparent={matPreset.transparent || jointDimmed}
              depthWrite={!jointDimmed && (!matPreset.transparent || matPreset.opacity >= 0.99)}
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
        {isReference(obj) && <ReferenceOutline geometry={geometry} clippingPlanes={activeClipPlanes} />}

        {isNegative(obj) && (
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

        {isSelected && selectionBoxScale && (
          <lineSegments geometry={UNIT_BOX_EDGES} position={selectionCenter} scale={selectionBoxScale}>
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
