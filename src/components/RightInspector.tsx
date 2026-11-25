/**
 * @file src/components/RightInspector.tsx
 * @description Inspector derecho de Kura3D: guarda el estado local de las secciones (sobrevive a cambios de
 * selección y de contexto), atiende la petición de foco de precisión y delega en el panel contextual
 * (`./contextPanel/ContextPanel.tsx`), que elige qué mostrar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { OPERATION_DEFAULTS } from '../engine/operationLimits';
import React, { useLayoutEffect, useState } from 'react';
import { type PrimitiveType, type TexturePatternType, type TransformMode } from '../types/kura';
import { REFINE_UI_DEFAULTS } from './refineDefaults';
import { type InspectorLocalState } from './inspector/inspectorTypes';
import { ContextPanel } from './contextPanel/ContextPanel';
import '../styles/inspectorFit.css';

/** Estado local que sobrevive a cambios de selección: vive en el contenedor y baja a las secciones. */
function useInspectorLocalState(): InspectorLocalState {
  // Estados locales para parámetros de operaciones Manifold & Pro
  const [wallThicknessMm, setWallThicknessMm] = useState(2.2);
  const [drainHole, setDrainHole] = useState(false);
  const [drainRadiusMm, setDrainRadiusMm] = useState(4);
  const [texturePattern, setTexturePattern] = useState<TexturePatternType>('fuzzy');
  const [textureDepthMm, setTextureDepthMm] = useState(0.45);
  const [textureScaleMm, setTextureScaleMm] = useState(4);
  const [positionRelative, setPositionRelative] = useState(false);
  const [rotationRelative, setRotationRelative] = useState(false);
  const [scaleBySize, setScaleBySize] = useState(false);
  const [modularShape, setModularShape] = useState<PrimitiveType>('cylinder');
  const [simplifyTolMm, setSimplifyTolMm] = useState<number>(OPERATION_DEFAULTS.simplify.toleranceMm);
  const [refineEdgeMm, setRefineEdgeMm] = useState<number>(REFINE_UI_DEFAULTS.edgeMm);
  const [refineSmooth, setRefineSmooth] = useState<boolean>(REFINE_UI_DEFAULTS.smooth);
  return { wallThicknessMm, setWallThicknessMm, drainHole, setDrainHole, drainRadiusMm, setDrainRadiusMm, texturePattern, setTexturePattern, textureDepthMm, setTextureDepthMm, textureScaleMm, setTextureScaleMm, positionRelative, setPositionRelative, rotationRelative, setRotationRelative, scaleBySize, setScaleBySize, modularShape, setModularShape, simplifyTolMm, setSimplifyTolMm, refineEdgeMm, setRefineEdgeMm, refineSmooth, setRefineSmooth };
}

export const RightInspector: React.FC<{ precisionRequest?: { mode: TransformMode } | null }> = ({ precisionRequest }) => {
  const ui = useInspectorLocalState();

  useLayoutEffect(() => {
    if (!precisionRequest) return;
    const group = document.getElementById(`kura-precision-${precisionRequest.mode}`);
    group?.focus({ preventScroll: true });
    group?.scrollIntoView({ block: 'nearest' });
  }, [precisionRequest]);

  return <ContextPanel ui={ui} />;
};
