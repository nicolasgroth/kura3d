/**
 * @file src/components/viewport/SectionPlaneIndicator.tsx
 * @description Indicador translúcido del plano de sección Rayos X. El corte en sí es un plano horizontal infinito
 * (corta todas las placas); el indicador se dibuja sobre la cama de la placa activa, que sigue a la pieza
 * seleccionada (sin placas: la cama del origen, como siempre).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import * as THREE from 'three';
import { activePlateBed } from '../../core/scene/activePlateBed';
import { useKuraStore } from '../../store/useKuraStore';

export const SectionPlaneIndicator: React.FC<{ heightMm: number }> = ({ heightMm }) => {
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const plates = useKuraStore((s) => s.plates);
  const activePlateId = useKuraStore((s) => s.activePlateId);
  // Medidas del perfil (las del indicador de siempre) salvo que la placa activa tenga cama propia.
  const { bed, origin } = activePlateBed({ printerProfile, customBedDimensions: null, plates, activePlateId });
  return (
    <mesh position={[origin[0], heightMm, origin[1]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={15}>
      <planeGeometry args={[bed.widthMm, bed.depthMm]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
};
