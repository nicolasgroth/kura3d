/**
 * @file src/components/viewport/PrinterBedOverlay.tsx
 * @description Cama y rejilla del visor: silueta de la impresora activa y aviso de volumen excedido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { X } from 'lucide-react';
import { getLocalizedPrinterName } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { BRAND_ACCENTS } from './viewportHelpers';

export interface PrinterBedOverlayProps {
  isOutOfBounds: boolean;
  /** Cama de una placa (varias placas); ausente = la del perfil de impresora, como siempre. */
  bed?: { widthMm: number; depthMm: number; heightMm: number };
  /** Rótulo de la placa frontal en lugar del nombre de la impresora (nombre de la placa). */
  title?: string;
  /** Placa activa entre varias: marco más marcado. */
  active?: boolean;
}

export const PrinterBedOverlay: React.FC<PrinterBedOverlayProps> = ({ isOutOfBounds, bed, title, active = false }) => {
  const language = useKuraStore((s) => s.language);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const width = bed?.widthMm ?? printerProfile.bedWidthMm;
  const depth = bed?.depthMm ?? printerProfile.bedDepthMm;
  const height = bed?.heightMm ?? printerProfile.maxHeightMm;
  const showVolume = printerProfile.showPrintVolume;
  const purgeZoneMm = printerProfile.purgeZoneMm ?? 0;
  const displayName = title ?? getLocalizedPrinterName(language, printerProfile);
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
        <lineBasicMaterial color={cageColor} transparent opacity={isOutOfBounds ? 0.85 : active ? 0.95 : 0.45} />
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
