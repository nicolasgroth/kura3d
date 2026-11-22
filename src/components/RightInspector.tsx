/**
 * @file src/components/RightInspector.tsx
 * @description Inspector paramétrico derecho de Kura3D: contenedor colapsable que elige el panel según la selección (ninguna, múltiple o un objeto) y compone sus secciones desde `./inspector/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useLayoutEffect, useState } from 'react';
import { t, type TranslationKey } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { type PrimitiveType, type TexturePatternType, type TransformMode } from '../types/kura';
import { REFINE_UI_DEFAULTS } from './refineDefaults';
import { type InspectorLocalState } from './inspector/inspectorTypes';
import { InspectorEdgeToggle } from './inspector/InspectorEdgeToggle';
import { FilamentLegendCard } from './inspector/FilamentLegendCard';
import { InspectorEmpty } from './inspector/InspectorEmpty';
import { InspectorMulti } from './inspector/InspectorMulti';
import { IdentitySection } from './inspector/IdentitySection';
import { TransformSection } from './inspector/TransformSection';
import { GeometrySection } from './inspector/GeometrySection';
import { MakerToolsSection } from './inspector/MakerToolsSection';
import { OperationsSection } from './inspector/OperationsSection';
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
  const [simplifyTolMm, setSimplifyTolMm] = useState(0.15);
  const [refineEdgeMm, setRefineEdgeMm] = useState<number>(REFINE_UI_DEFAULTS.edgeMm);
  const [refineSmooth, setRefineSmooth] = useState<boolean>(REFINE_UI_DEFAULTS.smooth);
  return { wallThicknessMm, setWallThicknessMm, drainHole, setDrainHole, drainRadiusMm, setDrainRadiusMm, texturePattern, setTexturePattern, textureDepthMm, setTextureDepthMm, textureScaleMm, setTextureScaleMm, positionRelative, setPositionRelative, rotationRelative, setRotationRelative, scaleBySize, setScaleBySize, modularShape, setModularShape, simplifyTolMm, setSimplifyTolMm, refineEdgeMm, setRefineEdgeMm, refineSmooth, setRefineSmooth };
}

export const RightInspector: React.FC<{ precisionRequest?: { mode: TransformMode } | null }> = ({ precisionRequest }) => {
  const ui = useInspectorLocalState();
  const language = useKuraStore((s) => s.language);
  const rightCollapsed = useKuraStore((s) => s.rightCollapsed);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));
  const primary = selectedObjects[0] ?? null;

  useLayoutEffect(() => {
    if (!precisionRequest) return;
    const group = document.getElementById(`kura-precision-${precisionRequest.mode}`);
    group?.focus({ preventScroll: true });
    group?.scrollIntoView({ block: 'nearest' });
  }, [precisionRequest]);

  // Sin selección
  if (selectedObjects.length === 0) return <InspectorEmpty />;

  // Multi-selección (2+ objetos): Booleanas CSG, Convex Hull y Alineación
  if (selectedObjects.length >= 2) return <InspectorMulti />;

  // Un solo objeto seleccionado
  if (!primary) return null;

  return (
    <aside
      id="kura-inspector-panel"
      className={`kura-sidebar-right ${rightCollapsed ? 'is-collapsed' : ''}`}
      aria-label={t(language, 'inspector.title')}
    >
      <InspectorEdgeToggle />
    
      <div className="kura-panel-header">
        <span>{t(language, 'inspector.title')}</span>
        <span
          style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}
          title={t(language, 'inspector.sourceLabel', { source: t(language, `inspector.source.${primary.source}` as TranslationKey) })}
        >
          {t(language, `inspector.source.${primary.source}` as TranslationKey)}
        </span>
      </div>

      <div className="kura-scroll-area">
        <IdentitySection primary={primary} />

        <FilamentLegendCard />

        <TransformSection primary={primary} ui={ui} />

        <GeometrySection primary={primary} />

        <MakerToolsSection primary={primary} ui={ui} />

        <OperationsSection primary={primary} ui={ui} />
      </div>
    </aside>
  );
};
