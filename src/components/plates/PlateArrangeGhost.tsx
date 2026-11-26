/**
 * @file src/components/plates/PlateArrangeGhost.tsx
 * @description Vista previa de «Repartir en placas…» en el visor: un rectángulo translúcido con contorno por cada
 * huella de pieza donde quedaría, y el contorno de las camas de las placas nuevas. Solo dibujo: no recibe clics ni
 * toca la escena. Los datos los calcula `store/plateArrangeGhost.ts` al terminar la vista previa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { ArrangeGhost, GhostBed, GhostRect } from '../../store/plateArrangeGhost';
import { usePlateArrangePanel } from '../../store/plateArrangePanel';

const PIECE_COLOR = '#38bdf8';
const BED_COLOR = '#a78bfa';
/** Apenas sobre la cama para no parpadear con ella. */
const LIFT_MM = 0.4;

const loopGeometry = (x0: number, z0: number, x1: number, z1: number): THREE.BufferGeometry => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x0, LIFT_MM, z0, x1, LIFT_MM, z0, x1, LIFT_MM, z1, x0, LIFT_MM, z1]), 3));
  return g;
};

const Outline: React.FC<{ x0: number; z0: number; x1: number; z1: number; color: string; fill?: boolean }> = ({ x0, z0, x1, z1, color, fill }) => {
  const geometry = useMemo(() => loopGeometry(x0, z0, x1, z1), [x0, z0, x1, z1]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group>
      <lineLoop geometry={geometry} renderOrder={31} raycast={() => null}>
        <lineBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
      </lineLoop>
      {fill && (
        <mesh position={[(x0 + x1) / 2, LIFT_MM, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={30} raycast={() => null}>
          <planeGeometry args={[Math.max(x1 - x0, 0.01), Math.max(z1 - z0, 0.01)]} />
          <meshBasicMaterial color={color} transparent opacity={0.22} depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
};

const GhostLayer: React.FC<{ ghost: ArrangeGhost }> = ({ ghost }) => (
  <group name="arrange-preview">
    {ghost.newBeds.map((b: GhostBed) => (
      <Outline key={b.key} x0={b.origin[0] - b.widthMm / 2} x1={b.origin[0] + b.widthMm / 2} z0={b.origin[1] - b.depthMm / 2} z1={b.origin[1] + b.depthMm / 2} color={BED_COLOR} />
    ))}
    {ghost.rects.map((r: GhostRect) => (
      <Outline key={r.id} x0={r.minX} x1={r.maxX} z0={r.minZ} z1={r.maxZ} color={PIECE_COLOR} fill />
    ))}
  </group>
);

export const PlateArrangeGhost: React.FC = () => {
  const ghost = usePlateArrangePanel((s) => (s.open ? s.ghost : null));
  return ghost ? <GhostLayer ghost={ghost} /> : null;
};
