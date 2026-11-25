/**
 * @file src/components/shell/insertIcons.tsx
 * @description Icono de cada entrada del catálogo de inserción (`store/insertCatalog.ts`): primitivas y
 * generadores. Los comparten el botón «Agregar», el menú «Insertar» y la hoja «Agregar» en móvil.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Bolt, Box, Circle, CircleDot, Cone, Cylinder, Disc, Disc3, FileCode2, Hexagon, Image as ImageIcon, Magnet, PackageCheck, Sparkles, Type, WandSparkles } from 'lucide-react';
import { KeyRound } from 'lucide-react';
import { Cable } from 'lucide-react';
import type { InsertId } from '../../store/insertCatalog';

const ICONS: Record<InsertId, React.FC<{ size?: number; 'aria-hidden'?: boolean | 'true' }>> = {
  box: Box,
  cylinder: Cylinder,
  disc: Disc3,
  tube: Disc,
  sphere: Circle,
  cone: Cone,
  torus: Sparkles,
  prism: Hexagon,
  text: Type,
  svg: FileCode2,
  image: ImageIcon,
  thread: Bolt,
  calibration: PackageCheck,
  assistants: WandSparkles,
  magnet: Magnet,
  screwBoss: CircleDot,
  keyhole: KeyRound,
  cablePass: Cable,
};

export function insertIcon(id: InsertId, size = 15): React.ReactNode {
  const Icon = ICONS[id];
  return <Icon size={size} aria-hidden="true" />;
}
