/**
 * @file src/components/Viewport3D.tsx
 * @description Visor 3D de alto rendimiento con React Three Fiber y Three.js.
 * Incluye iluminación CAD de 3 puntos, volumen de impresora (Elegoo Centauri Carbon 2 / genéricos),
 * gizmos TransformControls sin race conditions, pintado multicolor 3MF con throttling,
 * tallado esférico Manifold, presets de cámara sin snap-back y HUD adaptativo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  Camera,
  Maximize2,
  Move,
  RotateCw,
  Scale3d,
  Scissors,
} from 'lucide-react';
import * as engine from '../engine';
import { getLocalizedPrinterName, t } from '../i18n';
import {
  type CameraPresetType,
  type PaintBrushMode,
  useKuraStore,
} from '../store/useKuraStore';
import { PRINT_COLOR_PALETTE, type SceneObject, type Vec3 } from '../types/kura';
import { registerViewportCapture } from '../utils/mcpBridgeClient';
import { formatDimension } from '../utils/units';

/** Registra el callback de captura PNG del canvas WebGL para el servidor MCP. */
const ViewportCaptureRegistrar: React.FC = () => {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    registerViewportCapture(() => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL('image/png');
    });
    return () => registerViewportCapture(null);
  }, [gl, scene, camera]);

  return null;
};

/**
 * Controlador de presets de cámara y encuadre automático (tecla F).
 * Almacena objects/selectedIds/printerProfile en ref para que el useEffect
 * dependa únicamente de `cameraRequest` y jamás reajuste la cámara al seleccionar o editar.
 */
const CameraController: React.FC<{
  orbitRef: React.RefObject<OrbitControlsImpl | null>;
}> = ({ orbitRef }) => {
  const { camera } = useThree();
  const cameraRequest = useKuraStore((s) => s.cameraRequest);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const printerProfile = useKuraStore((s) => s.printerProfile);

  const snapshotRef = useRef({ objects, selectedIds, printerProfile });
  snapshotRef.current = { objects, selectedIds, printerProfile };

  useEffect(() => {
    if (!cameraRequest) return;
    const controls = orbitRef.current;
    const {
      objects: curObjects,
      selectedIds: curSelectedIds,
      printerProfile: curProfile,
    } = snapshotRef.current;

    const applyView = (preset: CameraPresetType) => {
      const target = new THREE.Vector3(0, 15, 0);
      let distance = Math.max(130, curProfile.bedWidthMm * 0.65);

      if (preset === 'fit' && curObjects.length > 0) {
        const focusObjs =
          curSelectedIds.length > 0
            ? curObjects.filter((o) => curSelectedIds.includes(o.id))
            : curObjects;
        const box = new THREE.Box3();
        for (const obj of focusObjs) {
          const [sx, sy, sz] = obj.scale;
          const [dx, dy, dz] = obj.stats.dimensionsMm;
          const half = new THREE.Vector3(
            Math.max(1, dx * sx * 0.5),
            Math.max(1, dy * sy * 0.5),
            Math.max(1, dz * sz * 0.5),
          );
          const center = new THREE.Vector3(
            obj.position[0],
            obj.position[1] + half.y * 0.2,
            obj.position[2],
          );
          box.expandByPoint(center.clone().sub(half));
          box.expandByPoint(center.clone().add(half));
        }
        if (!box.isEmpty()) {
          box.getCenter(target);
          const size = box.getSize(new THREE.Vector3());
          distance = Math.max(55, size.length() * 1.45);
        }
      }

      switch (preset) {
        case 'top':
          camera.position.set(target.x, target.y + distance * 1.3, target.z + 0.01);
          break;
        case 'front':
          camera.position.set(target.x, target.y + distance * 0.15, target.z + distance * 1.25);
          break;
        case 'right':
          camera.position.set(target.x + distance * 1.25, target.y + distance * 0.15, target.z);
          break;
        case 'iso':
        case 'fit':
        default:
          camera.position.set(
            target.x + distance * 0.72,
            target.y + distance * 0.62,
            target.z + distance * 0.85,
          );
          break;
      }

      if (controls) {
        controls.target.copy(target);
        controls.update();
      } else {
        camera.lookAt(target);
      }
    };

    applyView(cameraRequest.preset);
  }, [cameraRequest, camera, orbitRef]);

  return null;
};

/** Placa base y volumen de impresión estilo laminador (100% offline usando CanvasTexture). */
const PrinterBedOverlay: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const width = printerProfile.bedWidthMm;
  const depth = printerProfile.bedDepthMm;
  const height = printerProfile.maxHeightMm;
  const showVolume = printerProfile.showPrintVolume;
  const displayName = getLocalizedPrinterName(language, printerProfile);

  const plateTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 21px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = showVolume
      ? `${displayName} (${width}×${depth}×${height} mm)`
      : displayName;
    ctx.fillText(label, canvas.width / 2, canvas.height / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [displayName, width, depth, height, showVolume]);

  useEffect(() => {
    return () => {
      plateTexture?.dispose();
    };
  }, [plateTexture]);

  const volumeBoxGeo = useMemo(() => {
    const box = new THREE.BoxGeometry(width, height, depth);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [width, depth, height]);

  useEffect(() => {
    return () => {
      volumeBoxGeo.dispose();
    };
  }, [volumeBoxGeo]);

  const gridSize = showVolume ? Math.max(width, depth) : 400;
  const gridDivisions = Math.max(10, Math.round(gridSize / 10));

  return (
    <group>
      <mesh position={[0, -1.2, 0]} receiveShadow>
        <boxGeometry args={[width, 2.2, depth]} />
        <meshStandardMaterial
          color={showVolume ? '#161f2d' : '#1b2434'}
          roughness={0.78}
          metalness={0.18}
        />
      </mesh>

      <gridHelper
        args={[gridSize, gridDivisions, '#38bdf8', '#2a384f']}
        position={[0, 0.02, 0]}
      />

      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[width, 0.08, 0.45]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.45, 0.08, depth]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.55} />
      </mesh>

      {showVolume && (
        <lineSegments geometry={volumeBoxGeo} position={[0, height / 2, 0]}>
          <lineBasicMaterial color="#38bdf8" transparent opacity={0.22} />
        </lineSegments>
      )}

      {plateTexture && (
        <mesh position={[0, 0.06, depth / 2 + 12]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[Math.min(180, width * 0.72), 20]} />
          <meshBasicMaterial map={plateTexture} transparent opacity={0.92} />
        </mesh>
      )}
    </group>
  );
};

/** Renderiza un SceneObject optimizando caché de BufferGeometry y throttling de pintado. */
const SceneMeshItem: React.FC<{
  obj: SceneObject;
  isSelected: boolean;
  isPrimarySelected: boolean;
  onStartPaintDrag: () => void;
  registerGroupRef: (id: string, group: THREE.Group | null) => void;
}> = React.memo(({ obj, isSelected, isPrimarySelected, onStartPaintDrag, registerGroupRef }) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const lastPaintMoveAtRef = useRef(0);

  const activeTool = useKuraStore((s) => s.activeTool);
  const paintMode = useKuraStore((s) => s.paintMode);
  const selectObject = useKuraStore((s) => s.selectObject);
  const paintObjectSurface = useKuraStore((s) => s.paintObjectSurface);
  const eraseSphereOnObject = useKuraStore((s) => s.eraseSphereOnObject);

  // Evita reconstruir BufferGeometry al cambiar color uniforme cuando no existen faceColors
  const hasFaceColors = Boolean(obj.mesh.faceColors && obj.mesh.faceColors.length > 0);
  const colorDep = hasFaceColors ? (obj.isHole ? '#f97316' : obj.color) : '__uniform__';

  const geometry = useMemo(() => {
    return engine.createBufferGeometryFromMeshData(
      obj.mesh,
      hasFaceColors ? (obj.isHole ? '#f97316' : obj.color) : undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obj.mesh, colorDep]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

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

  // Callback ref para eliminar race conditions con TransformControls al montar o seleccionar
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

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    if (activeTool === 'paint') {
      if (obj.locked) return;
      onStartPaintDrag();
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
    if ((e.buttons & 1) === 0) return;
    e.stopPropagation();

    // Throttle de ~45ms para mantener el trazo fluido sin reconstruir mallas en cada evento raw
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        {obj.isHole ? (
          <meshStandardMaterial
            color="#f97316"
            transparent
            opacity={0.44}
            roughness={0.45}
            depthWrite={false}
          />
        ) : (
          <meshStandardMaterial
            color={hasVertexColors ? '#ffffff' : obj.color}
            vertexColors={hasVertexColors}
            roughness={0.42}
            metalness={0.08}
          />
        )}
      </mesh>

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
});

/** Contenido interno del Canvas 3D: luces, objetos, OrbitControls y TransformControls. */
const SceneContent: React.FC = () => {
  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());

  const [isTransforming, setIsTransforming] = useState(false);
  const [isPaintingDrag, setIsPaintingDrag] = useState(false);
  const [activeTargetGroup, setActiveTargetGroup] = useState<THREE.Group | null>(null);

  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const pastCount = useKuraStore((s) => s.past.length);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const activeTool = useKuraStore((s) => s.activeTool);
  const transformMode = useKuraStore((s) => s.transformMode);
  const snapGridMm = useKuraStore((s) => s.snapGridMm);
  const setObjectTransform = useKuraStore((s) => s.setObjectTransform);
  const commitTransformSnapshot = useKuraStore((s) => s.commitTransformSnapshot);

  const primaryId = selectedIds.length === 1 ? selectedIds[0] : null;
  const primaryIdRef = useRef<string | null>(primaryId);
  primaryIdRef.current = primaryId;

  const registerGroupRef = useCallback((id: string, group: THREE.Group | null) => {
    if (group) {
      groupRefs.current.set(id, group);
    } else {
      groupRefs.current.delete(id);
    }
    if (id === primaryIdRef.current) {
      setActiveTargetGroup(group);
    }
  }, []);

  // Sincroniza inmediatamente el grupo objetivo al cambiar la selección primaria
  useEffect(() => {
    setActiveTargetGroup(primaryId ? groupRefs.current.get(primaryId) ?? null : null);
  }, [primaryId]);

  useEffect(() => {
    const onGlobalPointerUp = () => setIsPaintingDrag(false);
    window.addEventListener('pointerup', onGlobalPointerUp);
    return () => window.removeEventListener('pointerup', onGlobalPointerUp);
  }, []);

  const primaryObj = primaryId ? objects.find((o) => o.id === primaryId) ?? null : null;

  const showGizmo =
    activeTool === 'select' &&
    Boolean(primaryObj) &&
    Boolean(activeTargetGroup) &&
    !primaryObj?.locked &&
    primaryObj?.visible;

  // Clave ligera para hornear ContactShadows solo cuando cambia la escena (frames=1)
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

      <PrinterBedOverlay />

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
          onStartPaintDrag={() => setIsPaintingDrag(true)}
          registerGroupRef={registerGroupRef}
        />
      ))}

      {showGizmo && primaryObj && activeTargetGroup && (
        <TransformControls
          key={primaryObj.id}
          object={activeTargetGroup}
          mode={transformMode}
          size={0.78}
          translationSnap={snapGridMm > 0 ? snapGridMm : null}
          rotationSnap={snapGridMm > 0 ? THREE.MathUtils.degToRad(5) : null}
          scaleSnap={snapGridMm > 0 ? 0.05 : null}
          onMouseDown={() => setIsTransforming(true)}
          onMouseUp={() => {
            setIsTransforming(false);
            commitTransformSnapshot();
          }}
          onObjectChange={() => {
            const g = groupRefs.current.get(primaryObj.id);
            if (!g) return;
            setObjectTransform(
              primaryObj.id,
              {
                position: [g.position.x, g.position.y, g.position.z],
                rotation: [g.rotation.x, g.rotation.y, g.rotation.z],
                scale: [g.scale.x, g.scale.y, g.scale.z],
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

      <CameraController orbitRef={orbitRef} />
      <ViewportCaptureRegistrar />
    </>
  );
};

export const Viewport3D: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const activeTool = useKuraStore((s) => s.activeTool);
  const transformMode = useKuraStore((s) => s.transformMode);
  const setTransformMode = useKuraStore((s) => s.setTransformMode);
  const snapGridMm = useKuraStore((s) => s.snapGridMm);
  const setSnapGridMm = useKuraStore((s) => s.setSnapGridMm);
  const requestCameraPreset = useKuraStore((s) => s.requestCameraPreset);
  const clearSelection = useKuraStore((s) => s.clearSelection);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const paintColor = useKuraStore((s) => s.paintColor);
  const paintRadiusMm = useKuraStore((s) => s.paintRadiusMm);
  const paintMode = useKuraStore((s) => s.paintMode);
  const setPaintSettings = useKuraStore((s) => s.setPaintSettings);
  const eraseRadiusMm = useKuraStore((s) => s.eraseRadiusMm);
  const setEraseRadiusMm = useKuraStore((s) => s.setEraseRadiusMm);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);

  const selectedObj = objects.find((o) => o.id === selectedIds[0]) ?? null;
  const localizedPrinterName = getLocalizedPrinterName(language, printerProfile);

  const activeDimensionsText = useMemo(() => {
    if (!selectedObj) {
      return t(language, 'viewport.noSelection');
    }
    const [dx, dy, dz] = selectedObj.stats.dimensionsMm;
    const [sx, sy, sz] = selectedObj.scale;
    return `${formatDimension(dx * sx, unitSystem)} × ${formatDimension(
      dy * sy,
      unitSystem,
    )} × ${formatDimension(dz * sz, unitSystem)}`;
  }, [selectedObj, unitSystem, language]);

  return (
    <main className="kura-viewport-wrap">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [115, 95, 130], fov: 42, near: 0.5, far: 4000 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onPointerMissed={(e) => {
          if (e.button === 0 && activeTool === 'select') {
            clearSelection();
          }
        }}
      >
        <SceneContent />
      </Canvas>

      {/* Stack superior del HUD: evita colisiones cuando se envuelven controles */}
      <div className="kura-hud-top-stack">
        <div className="kura-hud-top-bar">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <div className="kura-hud-card">
              <Camera size={13} style={{ color: 'var(--accent-cyan)' }} />
              {(['iso', 'top', 'front', 'right'] as CameraPresetType[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="kura-btn kura-btn-sm"
                  onClick={() => requestCameraPreset(preset)}
                >
                  {t(language, `viewport.camera.${preset}`)}
                </button>
              ))}
              <button
                type="button"
                className="kura-btn kura-btn-sm"
                onClick={() => requestCameraPreset('fit')}
                title={t(language, 'viewport.camera.fit')}
              >
                <Maximize2 size={13} />
                <span>{t(language, 'viewport.camera.fit')}</span>
              </button>
            </div>

            <div className="kura-hud-card">
              <span className="kura-field-label">{t(language, 'viewport.snapLabel')}</span>
              <select
                className="kura-select"
                style={{ height: 26 }}
                value={snapGridMm}
                onChange={(e) => setSnapGridMm(Number(e.target.value))}
              >
                <option value={0}>{t(language, 'viewport.snapOff')}</option>
                <option value={0.5}>0.5 mm</option>
                <option value={1}>1 mm</option>
                <option value={5}>5 mm</option>
                <option value={10}>10 mm</option>
              </select>
            </div>
          </div>

          <div className="kura-hud-card">
            <div className="kura-segmented">
              <button
                type="button"
                className={`kura-btn ${transformMode === 'translate' ? 'is-active' : ''}`}
                onClick={() => setTransformMode('translate')}
                title={t(language, 'viewport.gizmo.translate')}
              >
                <Move size={13} />
                <span>{t(language, 'viewport.gizmo.translate')}</span>
              </button>
              <button
                type="button"
                className={`kura-btn ${transformMode === 'rotate' ? 'is-active' : ''}`}
                onClick={() => setTransformMode('rotate')}
                title={t(language, 'viewport.gizmo.rotate')}
              >
                <RotateCw size={13} />
                <span>{t(language, 'viewport.gizmo.rotate')}</span>
              </button>
              <button
                type="button"
                className={`kura-btn ${transformMode === 'scale' ? 'is-active' : ''}`}
                onClick={() => setTransformMode('scale')}
                title={t(language, 'viewport.gizmo.scale')}
              >
                <Scale3d size={13} />
                <span>{t(language, 'viewport.gizmo.scale')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Barra contextual de herramientas (Pintar / Tallar / Cortar) */}
        {activeTool === 'paint' && (
          <div className="kura-hud-card" style={{ flexWrap: 'wrap', gap: 8, alignSelf: 'flex-start' }}>
            <select
              className="kura-select"
              style={{ height: 26 }}
              value={paintMode}
              onChange={(e) => setPaintSettings({ paintMode: e.target.value as PaintBrushMode })}
              aria-label={t(language, 'viewport.paint.mode')}
            >
              <option value="brush">{t(language, 'viewport.paint.brush')}</option>
              <option value="smart_fill">{t(language, 'viewport.paint.smartFill')}</option>
              <option value="whole">{t(language, 'viewport.paint.whole')}</option>
            </select>

            {paintMode === 'brush' && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                <span>{t(language, 'viewport.paint.radius')}: {paintRadiusMm} mm</span>
                <input
                  type="range"
                  min={1}
                  max={25}
                  step={0.5}
                  value={paintRadiusMm}
                  onChange={(e) => setPaintSettings({ paintRadiusMm: Number(e.target.value) })}
                />
              </label>
            )}

            <div className="kura-palette">
              {PRINT_COLOR_PALETTE.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className={`kura-swatch ${paintColor === hex ? 'is-active' : ''}`}
                  style={{ backgroundColor: hex }}
                  onClick={() => setPaintSettings({ paintColor: hex })}
                  aria-label={hex}
                />
              ))}
              <input
                type="color"
                value={paintColor}
                onChange={(e) => setPaintSettings({ paintColor: e.target.value })}
                style={{ width: 24, height: 24, border: 'none', background: 'none', padding: 0 }}
              />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {t(language, 'viewport.paint.hint')}
            </span>
          </div>
        )}

        {activeTool === 'erase' && (
          <div className="kura-hud-card" style={{ gap: 10, alignSelf: 'flex-start' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
              <span>{t(language, 'viewport.erase.radius')}: {eraseRadiusMm} mm</span>
              <input
                type="range"
                min={1}
                max={25}
                step={0.5}
                value={eraseRadiusMm}
                onChange={(e) => setEraseRadiusMm(Number(e.target.value))}
              />
            </label>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {t(language, 'viewport.erase.hint')}
            </span>
          </div>
        )}

        {activeTool === 'cut' && (
          <div className="kura-hud-card" style={{ gap: 10, alignSelf: 'flex-start' }}>
            <span style={{ fontSize: 11.5 }}>{t(language, 'viewport.cut.hint')}</span>
            <button
              type="button"
              className="kura-btn kura-btn-sm kura-btn-primary"
              disabled={!selectedObj}
              onClick={() => setActiveDialog('cut')}
            >
              <Scissors size={13} />
              <span>{t(language, 'viewport.cut.openDialog')}</span>
            </button>
          </div>
        )}
      </div>

      {/* HUD Inferior: Dimensiones en vivo y cama en una sola línea limpia */}
      <div className="kura-hud-bottom">
        <div className="kura-hud-card kura-hud-pill-nowrap">
          <span className="kura-field-label">
            {t(language, 'viewport.dimensionsPrefix')}:
          </span>
          <span className="kura-dims-badge">{activeDimensionsText}</span>
        </div>

        <div className="kura-hud-card kura-hud-pill-nowrap">
          <span className="kura-field-label">{t(language, 'viewport.bedLabel')}:</span>
          <span className="kura-dims-badge">
            {printerProfile.showPrintVolume
              ? `${localizedPrinterName} (${formatDimension(
                  printerProfile.bedWidthMm,
                  unitSystem,
                  1,
                )} × ${formatDimension(printerProfile.bedDepthMm, unitSystem, 1)} × ${formatDimension(
                  printerProfile.maxHeightMm,
                  unitSystem,
                  1,
                )})`
              : localizedPrinterName}
          </span>
        </div>
      </div>
    </main>
  );
};
