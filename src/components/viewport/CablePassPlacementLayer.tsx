/**
 * @file src/components/viewport/CablePassPlacementLayer.tsx
 * @description Capa de colocación del paso de cable (solo con su panel abierto): la capa común de agregados negativos
 * con la vista previa de la boca y un tramo del agujero en la cara bajo el cursor, con el lado largo horizontal y el
 * giro elegido. El largo real lo mide el Worker al colocar; la vista previa usa la profundidad a mano o, si se mide
 * solo, un tramo corto de muestra.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { cablePassFrame, cablePassMesh, type CablePassParams } from '../../core/addons/cablePass';
import type { AddonHover } from '../../store/addonHover';
import { cablePassPanel } from '../../store/cablePassPanel';
import { NegativeAddonLayer } from './NegativeAddonLayer';

/** Tramo de muestra de la vista previa cuando el largo se mide al colocar (mm). */
const PREVIEW_BORE_MM = 4;

const meshes = (p: CablePassParams) => [cablePassMesh(p, p.autoDepth ? PREVIEW_BORE_MM : p.depthMm, false)];

const pose = (p: CablePassParams, hover: AddonHover) => {
  const frame = cablePassFrame(hover.normal, p.angleDeg);
  return frame ? { position: hover.point, rotation: frame.rotation } : null;
};

export const CablePassPlacementLayer: React.FC = () => (
  <NegativeAddonLayer name="cable-pass-placement" tag="cablePassCatcher" panel={cablePassPanel} ghostMeshes={meshes} ghostPose={pose} />
);
