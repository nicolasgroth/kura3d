/**
 * @file src/components/viewport/KeyholePlacementLayer.tsx
 * @description Capa de colocación del ojo de cerradura (solo con su panel abierto): la capa común de agregados
 * negativos con la vista previa de sus tres partes (entrada, ranura del cuello y cámara) en la cara bajo el cursor,
 * con la ranura hacia el «arriba» de la pieza y el giro elegido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { keyholePartMeshes, placeKeyhole, type KeyholeParams } from '../../core/addons/keyhole';
import type { AddonHover } from '../../store/addonHover';
import { keyholePanel } from '../../store/keyholePanel';
import { NegativeAddonLayer } from './NegativeAddonLayer';

const meshes = (p: KeyholeParams) => {
  const { entry, neck, chamber } = keyholePartMeshes(p);
  return [entry, neck, chamber];
};

const pose = (p: KeyholeParams, hover: AddonHover) => {
  const plan = placeKeyhole(p, hover.point, hover.normal);
  return plan ? { position: plan.position, rotation: plan.rotation } : null;
};

export const KeyholePlacementLayer: React.FC = () => (
  <NegativeAddonLayer name="keyhole-placement" tag="keyholeCatcher" panel={keyholePanel} ghostMeshes={meshes} ghostPose={pose} />
);
