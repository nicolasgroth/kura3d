/**
 * @file src/components/Viewport3D.tsx
 * @description Visor 3D de alto rendimiento Kura3D Pro v3.0 con React Three Fiber y Three.js.
 * Incluye silueta realista de impresora multi-marca (Elegoo, Bambu Lab, Snapmaker, FlashForge),
 * detección de desbordamiento de volumen, materiales PBR realistas, plano de corte Rayos X en vivo,
 * resaltado de voladizos (>45°), gizmos TransformControls sin race conditions, pintado multicolor 3MF,
 * menú contextual clic derecho, píldora de salida de Modo Zen y captura PNG para MCP.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  AlertTriangle,
  ArrowDownToLine,
  Box,
  Camera,
  Combine,
  Copy,
  FileUp,
  Layers,
  Maximize2,
  Minimize2,
  MinusCircle,
  Move,
  PaintBucket,
  RotateCw,
  Scale3d,
  Scissors,
  ShieldCheck,
  ToggleLeft,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import * as engine from '../engine';
import { getLocalizedPrinterName, t } from '../i18n';
import {
  type CameraPresetType,
  type PaintBrushMode,
  useKuraStore,
} from '../store/useKuraStore';
import {
  MATERIAL_PRESETS,
  PRINT_COLOR_PALETTE,
  type PrinterProfile,
  type SceneObject,
  type SlicerTarget,
  type Vec3,
} from '../types/kura';
import { registerViewportCapture } from '../utils/mcpBridgeClient';
import { formatDimension } from '../utils/units';

interface ContextMenuState {
  objectId: string;
  x: number;
  y: number;
}

/** Color de acento característico por marca de impresora para la silueta de cama. */
const BRAND_ACCENTS: Record<SlicerTarget, string> = {
  elegoo: '#38bdf8',
  bambu: '#22c55e',
  snapmaker: '#a855f7',
  flashforge: '#f97316',
  generic: '#38bdf8',
};

/** Calcula la caja envolvente mundial [minX, minY, minZ, maxX, maxY, maxZ] de un SceneObject. */
function computeWorldBounds(obj: SceneObject): {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
} {
  const pos = obj.mesh.positions;
  if (pos.length < 3) {
    return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
  }
  const euler = new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ');
  const quat = new THREE.Quaternion().setFromEuler(euler);
  const v = new THREE.Vector3();

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < pos.length; i += 3) {
    v.set(
      pos[i] * obj.scale[0],
      pos[i + 1] * obj.scale[1],
      pos[i + 2] * obj.scale[2],
    );
    v.applyQuaternion(quat);
    const wx = v.x + obj.position[0];
    const wy = v.y + obj.position[1];
    const wz = v.z + obj.position[2];
    if (wx < minX) minX = wx;
    if (wy < minY) minY = wy;
    if (wz < minZ) minZ = wz;
    if (wx > maxX) maxX = wx;
    if (wy > maxY) maxY = wy;
    if (wz > maxZ) maxZ = wz;
  }

  return { minX, minY, minZ, maxX, maxY, maxZ };
}

/** Verifica si algún sólido visible excede los límites X, Z o altura máxima Y de la impresora activa. */
function checkObjectsOutOfBounds(
  objects: SceneObject[],
  profile: PrinterProfile,
): boolean {
  if (!profile.showPrintVolume) return false;
  const halfW = profile.bedWidthMm * 0.5 + 0.05;
  const halfD = profile.bedDepthMm * 0.5 + 0.05;
  const maxH = profile.maxHeightMm + 0.05;

  for (const obj of objects) {
    if (!obj.visible || obj.isHole) continue;
    const b = computeWorldBounds(obj);
    if (
      b.minX < -halfW ||
      b.maxX > halfW ||
      b.minZ < -halfD ||
      b.maxZ > halfD ||
      b.maxY > maxH ||
      b.minY < -0.5
    ) {
      return true;
    }
  }
  return false;
}

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

/**
 * Silueta 3D de cama e impresora multi-marca:
 * - Marco exterior de placa PEI + escuadras L en esquinas con acento por marca
 * - Zona frontal de purga (`purgeZoneMm`)
 * - Placa identificativa con marca, modelo y dimensiones exactas
 * - Jaula de volumen con borde rojo de alerta cuando algún sólido excede los límites
 */
const PrinterBedOverlay: React.FC<{ isOutOfBounds: boolean }> = ({ isOutOfBounds }) => {
  const language = useKuraStore((s) => s.language);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const width = printerProfile.bedWidthMm;
  const depth = printerProfile.bedDepthMm;
  const height = printerProfile.maxHeightMm;
  const showVolume = printerProfile.showPrintVolume;
  const purgeZoneMm = printerProfile.purgeZoneMm ?? 0;
  const displayName = getLocalizedPrinterName(language, printerProfile);
  const brandColor = BRAND_ACCENTS[printerProfile.brand] ?? '#38bdf8';
  const cageColor = isOutOfBounds ? '#ef4444' : brandColor;

  const plateTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 72;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = isOutOfBounds ? '#ef4444' : brandColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    ctx.fillStyle = isOutOfBounds ? '#fca5a5' : '#e2e8f0';
    ctx.font = 'bold 21px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = showVolume
      ? `${displayName} · ${width} × ${depth} × ${height} mm`
      : displayName;
    ctx.fillText(label, canvas.width / 2, canvas.height / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [displayName, width, depth, height, showVolume, brandColor, isOutOfBounds]);

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

  const bedBorderGeo = useMemo(() => {
    const box = new THREE.BoxGeometry(width + 8, 2.8, depth + 8);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [width, depth]);

  useEffect(() => {
    return () => {
      volumeBoxGeo.dispose();
      bedBorderGeo.dispose();
    };
  }, [volumeBoxGeo, bedBorderGeo]);

  const gridSize = showVolume ? Math.max(width, depth) : 400;
  const gridDivisions = Math.max(10, Math.round(gridSize / 10));
  const cornerLen = Math.min(24, width * 0.12);
  const cornerThick = 2.4;
  const halfW = width * 0.5;
  const halfD = depth * 0.5;

  const corners: Array<{ x: number; z: number; sx: number; sz: number }> = [
    { x: -halfW, z: -halfD, sx: 1, sz: 1 },
    { x: halfW, z: -halfD, sx: -1, sz: 1 },
    { x: -halfW, z: halfD, sx: 1, sz: -1 },
    { x: halfW, z: halfD, sx: -1, sz: -1 },
  ];

  return (
    <group>
      {/* Chasis exterior de la placa calefactada */}
      <mesh position={[0, -2.0, 0]} receiveShadow>
        <boxGeometry args={[width + 10, 1.4, depth + 10]} />
        <meshStandardMaterial color="#0b1019" roughness={0.85} metalness={0.35} />
      </mesh>

      {/* Placa PEI principal */}
      <mesh position={[0, -1.1, 0]} receiveShadow>
        <boxGeometry args={[width, 2.0, depth]} />
        <meshStandardMaterial
          color={showVolume ? '#161f2d' : '#1b2434'}
          roughness={0.72}
          metalness={0.22}
        />
      </mesh>

      {/* Marco exterior de alerta o marca */}
      <lineSegments geometry={bedBorderGeo} position={[0, -1.4, 0]}>
        <lineBasicMaterial color={cageColor} transparent opacity={isOutOfBounds ? 0.85 : 0.45} />
      </lineSegments>

      {/* Escuadras L luminosas en las 4 esquinas */}
      {corners.map((c, idx) => (
        <group key={idx}>
          <mesh position={[c.x + c.sx * (cornerLen * 0.5), 0.08, c.z]}>
            <boxGeometry args={[cornerLen, 0.25, cornerThick]} />
            <meshBasicMaterial color={cageColor} transparent opacity={0.88} />
          </mesh>
          <mesh position={[c.x, 0.08, c.z + c.sz * (cornerLen * 0.5)]}>
            <boxGeometry args={[cornerThick, 0.25, cornerLen]} />
            <meshBasicMaterial color={cageColor} transparent opacity={0.88} />
          </mesh>
        </group>
      ))}

      {/* Zona frontal de línea de purga */}
      {showVolume && purgeZoneMm > 0 && (
        <group position={[0, 0.05, halfD - purgeZoneMm * 0.5]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[width - 8, purgeZoneMm]} />
            <meshBasicMaterial color="#f97316" transparent opacity={0.14} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[width * 0.68, 0.14, 0.85]} />
            <meshBasicMaterial color="#f97316" transparent opacity={0.65} />
          </mesh>
        </group>
      )}

      <gridHelper
        args={[gridSize, gridDivisions, brandColor, '#263449']}
        position={[0, 0.02, 0]}
      />

      {/* Ejes centrales X / Z */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[width, 0.08, 0.45]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.48} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.45, 0.08, depth]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.48} />
      </mesh>

      {/* Volumen de impresión translúcido */}
      {showVolume && (
        <lineSegments geometry={volumeBoxGeo} position={[0, height / 2, 0]}>
          <lineBasicMaterial
            color={cageColor}
            transparent
            opacity={isOutOfBounds ? 0.78 : 0.24}
          />
        </lineSegments>
      )}

      {/* Placa de identificación frontal */}
      {plateTexture && (
        <mesh position={[0, 0.06, halfD + 16]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[Math.min(220, width * 0.84), 22]} />
          <meshBasicMaterial map={plateTexture} transparent opacity={0.94} />
        </mesh>
      )}
    </group>
  );
};

/**
 * Vista previa 3D láser en vivo del plano de corte y conectores fantasma
 * mientras el diálogo Corte por Plano está abierto.
 */
const LaserCutPreview: React.FC = () => {
  const cutPreview = useKuraStore((s) => s.cutPreview);
  const objects = useKuraStore((s) => s.objects);

  const targetObj = useMemo(() => {
    if (!cutPreview.active || !cutPreview.objectId) return null;
    return objects.find((o) => o.id === cutPreview.objectId) ?? null;
  }, [cutPreview.active, cutPreview.objectId, objects]);

  const previewGeometry = useMemo(() => {
    if (!targetObj) return null;
    const pos = targetObj.mesh.positions;
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i] * targetObj.scale[0];
      const y = pos[i + 1] * targetObj.scale[1];
      const z = pos[i + 2] * targetObj.scale[2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    const center = new THREE.Vector3(
      (minX + maxX) * 0.5,
      (minY + maxY) * 0.5,
      (minZ + maxZ) * 0.5,
    );
    const euler = new THREE.Euler(
      targetObj.rotation[0],
      targetObj.rotation[1],
      targetObj.rotation[2],
      'XYZ',
    );
    center.applyEuler(euler);
    center.add(new THREE.Vector3(...targetObj.position));

    const span =
      Math.max(
        20,
        targetObj.stats.dimensionsMm[0] * targetObj.scale[0],
        targetObj.stats.dimensionsMm[1] * targetObj.scale[1],
        targetObj.stats.dimensionsMm[2] * targetObj.scale[2],
      ) * 1.45;

    return { center, span };
  }, [targetObj]);

  if (!cutPreview.active || !targetObj || !previewGeometry) {
    return null;
  }

  const { center, span } = previewGeometry;
  const planePos: Vec3 = [center.x, center.y, center.z];
  let planeRot: Vec3 = [-Math.PI / 2, 0, 0];
  let connRot: Vec3 = [0, 0, 0];

  if (cutPreview.axis === 'x') {
    planePos[0] += cutPreview.offset;
    planeRot = [0, Math.PI / 2, 0];
    connRot = [0, 0, Math.PI / 2];
  } else if (cutPreview.axis === 'y') {
    planePos[1] += cutPreview.offset;
    planeRot = [-Math.PI / 2, 0, 0];
    connRot = [0, 0, 0];
  } else {
    planePos[2] += cutPreview.offset;
    planeRot = [0, 0, 0];
    connRot = [Math.PI / 2, 0, 0];
  }

  const count = Math.max(1, Math.min(4, cutPreview.connectorCount));
  const connectorOffsets: Vec3[] = [];
  const spread = Math.min(span * 0.24, Math.max(8, cutPreview.connectorSize * 2.8));

  for (let i = 0; i < count; i++) {
    let u = 0;
    let v = 0;
    if (count === 2) {
      u = i === 0 ? -spread : spread;
    } else if (count === 3) {
      const ang = (i * Math.PI * 2) / 3;
      u = Math.cos(ang) * spread;
      v = Math.sin(ang) * spread;
    } else if (count === 4) {
      u = i % 2 === 0 ? -spread : spread;
      v = i < 2 ? -spread : spread;
    }

    if (cutPreview.axis === 'x') {
      connectorOffsets.push([planePos[0], planePos[1] + u, planePos[2] + v]);
    } else if (cutPreview.axis === 'y') {
      connectorOffsets.push([planePos[0] + u, planePos[1], planePos[2] + v]);
    } else {
      connectorOffsets.push([planePos[0] + u, planePos[1] + v, planePos[2]]);
    }
  }

  return (
    <group>
      <mesh position={planePos} rotation={planeRot} renderOrder={20}>
        <planeGeometry args={[span, span]} />
        <meshBasicMaterial
          color="#f97316"
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {cutPreview.connectorType !== 'none' &&
        connectorOffsets.map((pos, idx) => (
          <mesh key={idx} position={pos} rotation={connRot} renderOrder={21}>
            {cutPreview.connectorType === 'peg' || cutPreview.connectorType === 'dovetail' ? (
              <boxGeometry
                args={[
                  cutPreview.connectorSize * 1.6,
                  cutPreview.connectorDepth * 1.4,
                  cutPreview.connectorSize * 1.6,
                ]}
              />
            ) : (
              <cylinderGeometry
                args={[
                  cutPreview.connectorSize,
                  cutPreview.connectorSize,
                  cutPreview.connectorDepth * 1.4,
                  20,
                ]}
              />
            )}
            <meshBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.55}
              depthWrite={false}
            />
          </mesh>
        ))}
    </group>
  );
};

/** Renderiza un SceneObject con caché de BufferGeometry, materiales PBR, sección Rayos X y voladizos. */
const SceneMeshItem: React.FC<{
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

/** Contenido interno del Canvas 3D: luces, objetos, plano sección, vista previa láser, OrbitControls y gizmos. */
const SceneContent: React.FC<{
  isOutOfBounds: boolean;
  onObjectContextMenu: (id: string, clientX: number, clientY: number) => void;
}> = ({ isOutOfBounds, onObjectContextMenu }) => {
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
  const sectionPlane = useKuraStore((s) => s.sectionPlane);
  const activePrintReport = useKuraStore((s) => s.activePrintReport);
  const showOverhangs = useKuraStore((s) => s.showOverhangs);
  const setObjectTransform = useKuraStore((s) => s.setObjectTransform);
  const commitTransformSnapshot = useKuraStore((s) => s.commitTransformSnapshot);

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
      groupRefs.current.delete(id);
    }
    if (id === primaryIdRef.current) {
      setActiveTargetGroup(group);
    }
  }, []);

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
  const viewportRef = useRef<HTMLElement | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const language = useKuraStore((s) => s.language);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const uiDensity = useKuraStore((s) => s.uiDensity);
  const toggleZenMode = useKuraStore((s) => s.toggleZenMode);
  const activeTool = useKuraStore((s) => s.activeTool);
  const transformMode = useKuraStore((s) => s.transformMode);
  const setTransformMode = useKuraStore((s) => s.setTransformMode);
  const snapGridMm = useKuraStore((s) => s.snapGridMm);
  const setSnapGridMm = useKuraStore((s) => s.setSnapGridMm);
  const sectionPlane = useKuraStore((s) => s.sectionPlane);
  const setSectionPlane = useKuraStore((s) => s.setSectionPlane);
  const requestCameraPreset = useKuraStore((s) => s.requestCameraPreset);
  const clearSelection = useKuraStore((s) => s.clearSelection);
  const selectObject = useKuraStore((s) => s.selectObject);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const paintColor = useKuraStore((s) => s.paintColor);
  const paintRadiusMm = useKuraStore((s) => s.paintRadiusMm);
  const paintMode = useKuraStore((s) => s.paintMode);
  const setPaintSettings = useKuraStore((s) => s.setPaintSettings);
  const eraseRadiusMm = useKuraStore((s) => s.eraseRadiusMm);
  const setEraseRadiusMm = useKuraStore((s) => s.setEraseRadiusMm);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const addSubtractHelperPrimitive = useKuraStore((s) => s.addSubtractHelperPrimitive);
  const importModelAsModuleFromDialog = useKuraStore((s) => s.importModelAsModuleFromDialog);
  const applyHolesOnSolids = useKuraStore((s) => s.applyHolesOnSolids);
  const runBooleanOnSelection = useKuraStore((s) => s.runBooleanOnSelection);
  const hollowObject = useKuraStore((s) => s.hollowObject);
  const runPrintabilityCheck = useKuraStore((s) => s.runPrintabilityCheck);
  const updateObjectMeta = useKuraStore((s) => s.updateObjectMeta);
  const duplicateObjects = useKuraStore((s) => s.duplicateObjects);
  const dropObjectToBed = useKuraStore((s) => s.dropObjectToBed);
  const deleteObjects = useKuraStore((s) => s.deleteObjects);
  const toasts = useKuraStore((s) => s.toasts);
  const dismissToast = useKuraStore((s) => s.dismissToast);

  const selectedObj = objects.find((o) => o.id === selectedIds[0]) ?? null;
  const localizedPrinterName = getLocalizedPrinterName(language, printerProfile);

  const holeCount = objects.filter((o) => o.isHole && o.visible).length;
  const solidCount = objects.filter((o) => !o.isHole && o.visible).length;

  const isOutOfBounds = useMemo(
    () => checkObjectsOutOfBounds(objects, printerProfile),
    [objects, printerProfile],
  );

  const maxSceneHeight = useMemo(() => {
    let maxH = printerProfile.maxHeightMm;
    for (const obj of objects) {
      const top = obj.position[1] + obj.stats.dimensionsMm[1] * obj.scale[1];
      if (top > maxH) maxH = Math.ceil(top);
    }
    return Math.max(40, maxH);
  }, [objects, printerProfile.maxHeightMm]);

  const handleObjectContextMenu = useCallback(
    (objectId: string, clientX: number, clientY: number) => {
      if (!useKuraStore.getState().selectedIds.includes(objectId)) {
        selectObject(objectId, false);
      }
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;

      const rawX = clientX - rect.left;
      const rawY = clientY - rect.top;
      const clampedX = Math.max(8, Math.min(rawX, Math.max(8, rect.width - 252)));
      const clampedY = Math.max(8, Math.min(rawY, Math.max(8, rect.height - 420)));
      setContextMenu({ objectId, x: clampedX, y: clampedY });
    },
    [selectObject],
  );

  // Cerrar menú contextual con Escape o clic externo
  useEffect(() => {
    if (!contextMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.kura-context-menu')) {
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [contextMenu]);

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

  const ctxTarget = contextMenu
    ? objects.find((o) => o.id === contextMenu.objectId) ?? null
    : null;

  return (
    <main ref={viewportRef} className="kura-viewport-wrap">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [115, 95, 130], fov: 42, near: 0.5, far: 4000 }}
        gl={{ preserveDrawingBuffer: true, antialias: true, localClippingEnabled: true }}
        onPointerMissed={(e) => {
          setContextMenu(null);
          if (e.button === 0 && activeTool === 'select') {
            clearSelection();
          }
        }}
      >
        <SceneContent
          isOutOfBounds={isOutOfBounds}
          onObjectContextMenu={handleObjectContextMenu}
        />
      </Canvas>

      {/* Píldora flotante para salir de Modo Zen (Tab) */}
      {uiDensity === 'zen' && (
        <button
          type="button"
          className="kura-zen-exit-pill"
          onClick={() => useKuraStore.getState().setUiDensity('full')}
        >
          <Minimize2 size={13} style={{ color: 'var(--accent-cyan)' }} />
          <span>{t(language, 'ui.zen.exit')}</span>
        </button>
      )}

      {/* Stack superior del HUD: evita colisiones cuando se envuelven controles */}
      <div className="kura-hud-top-stack">
        <div className="kura-hud-top-bar">
          <div className="kura-hud-bar">
            <div className="kura-hud-card">
              <Camera size={13} style={{ color: 'var(--tool-accent)' }} />
              {(['iso', 'top', 'front', 'right'] as CameraPresetType[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="kura-btn kura-btn-sm"
                  onClick={() => requestCameraPreset(preset)}
                  title={t(language, `viewport.camera.${preset}`)}
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
                aria-label={t(language, 'viewport.snapLabel')}
              >
                <option value={0}>{t(language, 'viewport.snapOff')}</option>
                <option value={0.5}>0.5 mm</option>
                <option value={1}>1 mm</option>
                <option value={5}>5 mm</option>
                <option value={10}>10 mm</option>
              </select>
            </div>

            {/* Control en vivo de Rayos X / Plano de Sección */}
            <div className="kura-hud-card">
              <button
                type="button"
                className={`kura-btn kura-btn-sm ${sectionPlane.enabled ? 'is-active' : ''}`}
                onClick={() => setSectionPlane({ enabled: !sectionPlane.enabled })}
                title={t(language, 'viewport.section.toggleTip')}
              >
                <Layers size={13} />
                <span>{t(language, 'viewport.section.toggle')}</span>
              </button>
              {sectionPlane.enabled && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <input
                    type="range"
                    min={0}
                    max={maxSceneHeight}
                    step={0.5}
                    value={sectionPlane.heightMm}
                    onChange={(e) => setSectionPlane({ heightMm: Number(e.target.value) })}
                    aria-label={t(language, 'viewport.section.height')}
                  />
                  <span style={{ fontFamily: 'monospace', minWidth: 46 }}>
                    {formatDimension(sectionPlane.heightMm, unitSystem, 1)}
                  </span>
                </label>
              )}
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

        {/* Píldora booleana inteligente: aparece cuando existen huecos + sólidos */}
        {holeCount > 0 && solidCount > 0 && (
          <button
            type="button"
            className="kura-hud-card kura-boolean-fab"
            disabled={Boolean(busyOperation)}
            onClick={() => void applyHolesOnSolids()}
            title={t(language, 'inspector.op.applyBooleansN', { count: holeCount })}
          >
            <Scissors size={14} />
            <span>{t(language, 'inspector.op.applyBooleansN', { count: holeCount })}</span>
          </button>
        )}

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

            <div className="kura-swatch-row">
              {PRINT_COLOR_PALETTE.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className={`kura-swatch ${paintColor === hex ? 'is-active' : ''}`}
                  style={{ backgroundColor: hex }}
                  onClick={() => setPaintSettings({ paintColor: hex })}
                  aria-label={hex}
                  title={hex}
                />
              ))}
              <input
                type="color"
                className="kura-swatch-custom"
                value={paintColor}
                onChange={(e) => setPaintSettings({ paintColor: e.target.value })}
                aria-label={t(language, 'viewport.paint.color')}
                title={t(language, 'viewport.paint.color')}
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

      {/* Menú contextual clic derecho sobre objeto 3D */}
      {contextMenu && ctxTarget && (
        <div
          className="kura-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          <div className="kura-context-header">{ctxTarget.name}</div>

          <button
            type="button"
            className="kura-context-item"
            title={t(language, 'inspector.op.subtractSphereTip')}
            onClick={() => {
              setContextMenu(null);
              void addSubtractHelperPrimitive('sphere', ctxTarget.id);
            }}
          >
            <MinusCircle size={14} style={{ color: 'var(--accent-amber)' }} />
            <span>{t(language, 'ctx.subtractSphere')}</span>
          </button>

          <button
            type="button"
            className="kura-context-item"
            title={t(language, 'inspector.op.subtractCylinderTip')}
            onClick={() => {
              setContextMenu(null);
              void addSubtractHelperPrimitive('cylinder', ctxTarget.id);
            }}
          >
            <MinusCircle size={14} style={{ color: 'var(--accent-amber)' }} />
            <span>{t(language, 'ctx.subtractCylinder')}</span>
          </button>

          <button
            type="button"
            className="kura-context-item"
            onClick={() => {
              setContextMenu(null);
              void importModelAsModuleFromDialog('negative', ctxTarget.id);
            }}
          >
            <FileUp size={14} style={{ color: 'var(--accent-amber)' }} />
            <span>{t(language, 'ctx.importModuleSub')}</span>
          </button>

          <button
            type="button"
            className="kura-context-item"
            onClick={() => {
              setContextMenu(null);
              updateObjectMeta(ctxTarget.id, { isHole: !ctxTarget.isHole });
            }}
          >
            <ToggleLeft size={14} />
            <span>{t(language, 'ctx.toggleHole')}</span>
          </button>

          {holeCount > 0 && solidCount > 0 && (
            <button
              type="button"
              className="kura-context-item is-accent"
              onClick={() => {
                setContextMenu(null);
                void applyHolesOnSolids();
              }}
            >
              <Combine size={14} />
              <span>{t(language, 'ctx.applyHoles')}</span>
            </button>
          )}

          {selectedIds.length >= 2 && (
            <button
              type="button"
              className="kura-context-item"
              onClick={() => {
                setContextMenu(null);
                void runBooleanOnSelection('union');
              }}
            >
              <Combine size={14} />
              <span>{t(language, 'ctx.unionSelection')}</span>
            </button>
          )}

          <div className="kura-context-sep" />

          <button
            type="button"
            className="kura-context-item"
            disabled={ctxTarget.locked}
            onClick={() => {
              setContextMenu(null);
              void hollowObject(ctxTarget.id, { enabled: true, wallThickness: 2.2 });
            }}
          >
            <Box size={14} />
            <span>{t(language, 'ctx.hollow')}</span>
          </button>

          <button
            type="button"
            className="kura-context-item"
            disabled={ctxTarget.locked}
            onClick={() => {
              setContextMenu(null);
              setActiveDialog('cut');
            }}
          >
            <Scissors size={14} />
            <span>{t(language, 'ctx.planeCut')}</span>
          </button>

          <button
            type="button"
            className="kura-context-item"
            onClick={() => {
              setContextMenu(null);
              setActiveDialog('mold');
            }}
          >
            <PaintBucket size={14} style={{ color: 'var(--accent-cyan)' }} />
            <span>{t(language, 'ctx.generateMold')}</span>
          </button>

          <button
            type="button"
            className="kura-context-item"
            disabled={ctxTarget.locked}
            onClick={() => {
              setContextMenu(null);
              setActiveDialog('project');
            }}
          >
            <Type size={14} style={{ color: 'var(--accent-cyan)' }} />
            <span>{t(language, 'ctx.projectSurface')}</span>
          </button>

          <button
            type="button"
            className="kura-context-item"
            onClick={() => {
              setContextMenu(null);
              runPrintabilityCheck(ctxTarget.id);
            }}
          >
            <ShieldCheck size={14} style={{ color: 'var(--accent-green)' }} />
            <span>{t(language, 'ctx.validatePrint')}</span>
          </button>

          <div className="kura-context-sep" />

          <button
            type="button"
            className="kura-context-item"
            onClick={() => {
              setContextMenu(null);
              duplicateObjects([ctxTarget.id]);
            }}
          >
            <Copy size={14} />
            <span>{t(language, 'ctx.duplicate')}</span>
          </button>

          <button
            type="button"
            className="kura-context-item"
            disabled={ctxTarget.locked}
            onClick={() => {
              setContextMenu(null);
              dropObjectToBed(ctxTarget.id);
            }}
          >
            <ArrowDownToLine size={14} />
            <span>{t(language, 'ctx.dropToBed')}</span>
          </button>

          <button
            type="button"
            className="kura-context-item is-danger"
            disabled={ctxTarget.locked}
            onClick={() => {
              setContextMenu(null);
              deleteObjects([ctxTarget.id]);
            }}
          >
            <Trash2 size={14} />
            <span>{t(language, 'ctx.delete')}</span>
          </button>
        </div>
      )}

      {/* Toasts anclados dentro del visor para no tapar HUD superior, Inspector ni Chat IA */}
      {toasts.length > 0 && (
        <div className="kura-toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`kura-toast ${toast.kind}`}>
              <span>{toast.text}</span>
              <button
                type="button"
                className="kura-mini-icon-btn"
                onClick={() => dismissToast(toast.id)}
                aria-label={t(language, 'common.close')}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* HUD Inferior: Dimensiones en vivo, alerta de límites y cama en una sola línea */}
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
          {isOutOfBounds && (
            <span className="kura-oob-badge">
              <AlertTriangle size={11} />
              <span>{t(language, 'viewport.bed.outOfBounds')}</span>
            </span>
          )}
        </div>
      </div>
    </main>
  );
};
