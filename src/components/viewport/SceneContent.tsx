/**
 * @file src/components/viewport/SceneContent.tsx
 * @description Contenido del Canvas 3D: luces, objetos, plano de sección, vista previa láser, OrbitControls, gizmo y cubo de vista.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  ContactShadows,
  GizmoHelper,
  GizmoViewcube,
  OrbitControls,
  TransformControls,
} from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { X } from 'lucide-react';
import { useKuraStore } from '../../store/useKuraStore';
import { type Vec3 } from '../../types/kura';
import { PaintBrushCursor } from './PaintBrushCursor';
import { ViewportCaptureRegistrar } from './ViewportCaptureRegistrar';
import { CameraController } from './CameraController';
import { PrinterBedOverlay } from './PrinterBedOverlay';
import { LaserCutPreview } from './LaserCutPreview';
import { SceneMeshItem } from './SceneMeshItem';
import { useGizmoDrag, useGizmoModifiers } from './useGizmoDrag';
import { usePaintStroke } from './usePaintStroke';

/** Contenido interno del Canvas 3D: luces, objetos, plano sección, vista previa láser, OrbitControls y gizmos. */
export const SceneContent: React.FC<{
  isOutOfBounds: boolean;
  onObjectContextMenu: (id: string, clientX: number, clientY: number) => void;
}> = ({ isOutOfBounds, onObjectContextMenu }) => {
  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());

  const { isTransforming, setIsTransforming, gizmoEpoch, dragStartScaleRef } = useGizmoDrag();
  const { isPaintingDrag, setIsPaintingDrag } = usePaintStroke();
  const { modifiersRef, ctrlHeld } = useGizmoModifiers();
  const [activeTargetGroup, setActiveTargetGroup] = useState<THREE.Group | null>(null);

  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const pastCount = useKuraStore((s) => s.past.length);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const activeTool = useKuraStore((s) => s.activeTool);
  const transformMode = useKuraStore((s) => s.transformMode);
  const proportionalScale = useKuraStore((s) => s.proportionalScale);
  const snapGridMm = useKuraStore((s) => s.snapGridMm);
  const sectionPlane = useKuraStore((s) => s.sectionPlane);
  const activePrintReport = useKuraStore((s) => s.activePrintReport);
  const showOverhangs = useKuraStore((s) => s.showOverhangs);
  const language = useKuraStore((s) => s.language);
  const colorScheme = useKuraStore((s) => s.colorScheme);
  const setObjectTransform = useKuraStore((s) => s.setObjectTransform);
  const commitTransformSnapshot = useKuraStore((s) => s.commitTransformSnapshot);
  const altCloneForDrag = useKuraStore((s) => s.altCloneForDrag);

  const systemDark =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const isViewDark =
    colorScheme === 'dark' || (colorScheme === 'system' && Boolean(systemDark));

  // Plano de corte visual Rayos X reutilizado sin recrear materiales en cada cambio de altura
  const clipPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, -1, 0), 25));
  useEffect(() => {
    clipPlaneRef.current.constant = sectionPlane.heightMm;
  }, [sectionPlane.heightMm]);

  const activeClipPlane = sectionPlane.enabled ? clipPlaneRef.current : null;

  const primaryId = selectedIds.length === 1 ? selectedIds[0] : null;
  const primaryIdRef = useRef<string | null>(primaryId);
  primaryIdRef.current = primaryId;

  const registerGroupRef = useCallback((id: string, group: THREE.Group | null) => {
    if (group) {
      groupRefs.current.set(id, group);
    } else {
      const removed = groupRefs.current.get(id);
      groupRefs.current.delete(id);
      // Desacopla el gizmo si su objeto deja de existir en la escena.
      setActiveTargetGroup((prev) => (prev && prev === removed ? null : prev));
    }
    if (id === primaryIdRef.current) {
      setActiveTargetGroup(group);
    }
  }, []);

  useEffect(() => {
    setActiveTargetGroup(primaryId ? groupRefs.current.get(primaryId) ?? null : null);
  }, [primaryId]);

  const primaryObj = primaryId ? objects.find((o) => o.id === primaryId) ?? null : null;

  const showGizmo =
    activeTool === 'select' &&
    Boolean(primaryObj) &&
    Boolean(activeTargetGroup) &&
    !primaryObj?.locked &&
    primaryObj?.visible &&
    // El grupo debe seguir dentro del grafo de escena (TransformControls lo exige).
    activeTargetGroup?.parent != null;

  const shadowsKey = `${objects.length}:${pastCount}:${printerProfile.id}`;

  return (
    <>
      <ambientLight intensity={0.62} />
      <directionalLight
        position={[110, 180, 95]}
        intensity={1.35}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={10}
        shadow-camera-far={600}
        shadow-camera-left={-180}
        shadow-camera-right={180}
        shadow-camera-top={180}
        shadow-camera-bottom={-180}
      />
      <directionalLight position={[-120, 80, -100]} intensity={0.52} color="#bae6fd" />
      <directionalLight position={[0, -80, 90]} intensity={0.25} color="#fed7aa" />

      <PrinterBedOverlay isOutOfBounds={isOutOfBounds} />

      <ContactShadows
        key={shadowsKey}
        frames={1}
        position={[0, 0.01, 0]}
        opacity={0.35}
        scale={280}
        blur={1.8}
        far={90}
      />

      {objects.map((obj) => (
        <SceneMeshItem
          key={obj.id}
          obj={obj}
          isSelected={selectedIds.includes(obj.id)}
          isPrimarySelected={selectedIds[0] === obj.id}
          clipPlane={activeClipPlane}
          overhangFaces={
            showOverhangs && activePrintReport?.objectId === obj.id
              ? activePrintReport.overhangFaceIndices
              : null
          }
          onStartPaintDrag={() => setIsPaintingDrag(true)}
          onObjectContextMenu={onObjectContextMenu}
          registerGroupRef={registerGroupRef}
        />
      ))}

      {/* Indicador visual translúcido del plano de sección Rayos X */}
      {sectionPlane.enabled && (
        <mesh
          position={[0, sectionPlane.heightMm, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={15}
        >
          <planeGeometry args={[printerProfile.bedWidthMm, printerProfile.bedDepthMm]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      <LaserCutPreview />

      {activeTool === 'paint' && <PaintBrushCursor />}

      {showGizmo && primaryObj && activeTargetGroup && (
        <TransformControls
          key={`${primaryObj.id}:${gizmoEpoch}`}
          object={activeTargetGroup}
          mode={transformMode}
          size={0.78}
          translationSnap={
            ctrlHeld
              ? snapGridMm > 0
                ? snapGridMm
                : 1
              : snapGridMm > 0
                ? snapGridMm
                : null
          }
          rotationSnap={
            ctrlHeld
              ? Math.PI / 12
              : snapGridMm > 0
                ? THREE.MathUtils.degToRad(5)
                : null
          }
          scaleSnap={ctrlHeld ? 0.1 : snapGridMm > 0 ? 0.05 : null}
          onMouseDown={() => {
            setIsTransforming(true);
            dragStartScaleRef.current = [...primaryObj.scale] as Vec3;
            if (modifiersRef.current.alt) {
              altCloneForDrag(primaryObj.id);
            }
          }}
          onMouseUp={() => {
            setIsTransforming(false);
            dragStartScaleRef.current = null;
            commitTransformSnapshot();
          }}
          onObjectChange={() => {
            const g = groupRefs.current.get(primaryObj.id);
            if (!g) return;

            let nextScale: Vec3 = [g.scale.x, g.scale.y, g.scale.z];
            if (
              transformMode === 'scale' &&
              (proportionalScale || modifiersRef.current.shift) &&
              dragStartScaleRef.current
            ) {
              const [sx0, sy0, sz0] = dragStartScaleRef.current;
              const rx = sx0 > 1e-6 ? g.scale.x / sx0 : 1;
              const ry = sy0 > 1e-6 ? g.scale.y / sy0 : 1;
              const rz = sz0 > 1e-6 ? g.scale.z / sz0 : 1;
              const candidates = [rx, ry, rz];
              let chosen = 1;
              let maxDelta = -1;
              for (const r of candidates) {
                const d = Math.abs(r - 1);
                if (d > maxDelta) {
                  maxDelta = d;
                  chosen = r;
                }
              }
              const factor = Math.max(0.02, chosen);
              nextScale = [
                Math.max(0.05, sx0 * factor),
                Math.max(0.05, sy0 * factor),
                Math.max(0.05, sz0 * factor),
              ];
              g.scale.set(nextScale[0], nextScale[1], nextScale[2]);
            }

            setObjectTransform(
              primaryObj.id,
              {
                position: [g.position.x, g.position.y, g.position.z],
                rotation: [g.rotation.x, g.rotation.y, g.rotation.z],
                scale: nextScale,
              },
              false,
            );
          }}
        />
      )}

      <OrbitControls
        ref={orbitRef}
        makeDefault
        enabled={!isTransforming && !isPaintingDrag}
        enableDamping
        dampingFactor={0.08}
        minDistance={18}
        maxDistance={950}
        maxPolarAngle={Math.PI * 0.92}
      />

      {/* Cubo de orientación 3D interactivo estilo CAD */}
      <GizmoHelper alignment="top-right" margin={[62, 118]}>
        <GizmoViewcube
          color={isViewDark ? '#17202e' : '#f1f5f9'}
          textColor={isViewDark ? '#e2e8f0' : '#0f172a'}
          strokeColor={isViewDark ? '#38bdf8' : '#0284c7'}
          hoverColor="#38bdf8"
          opacity={0.92}
          faces={
            language === 'en'
              ? ['Right', 'Left', 'Top', 'Bottom', 'Front', 'Back']
              : ['Der', 'Izq', 'Sup', 'Inf', 'Frente', 'Atrás']
          }
        />
      </GizmoHelper>

      <CameraController orbitRef={orbitRef} />
      <ViewportCaptureRegistrar />
    </>
  );
};
