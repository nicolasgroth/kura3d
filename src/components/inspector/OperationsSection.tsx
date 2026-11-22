/**
 * @file src/components/inspector/OperationsSection.tsx
 * @description Sección Operaciones 3D (Manifold) del inspector: módulos, ahuecar, corte, dividir para imprimir (con las marcas de pareja de una pieza dividida) y textura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Grid3x3, Scissors, Split, Zap } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { type InspectorSectionProps } from './inspectorTypes';
import { ModulesPanel } from './ModulesPanel';
import { HollowPanel } from './HollowPanel';
import { ColorSplitControl } from './ColorSplitControl';
import { TexturePanel } from './TexturePanel';
import { SplitJointsSection } from '../split/SplitJointsSection';
import { SplitPartInfo } from '../split/SplitPartInfo';

/** Sección 5: operaciones 3D determinísticas y módulos dinámicos. */
export const OperationsSection: React.FC<InspectorSectionProps> = ({ primary, ui }) => {
  const language = useKuraStore((s) => s.language);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const splitDisconnectedObject = useKuraStore((s) => s.splitDisconnectedObject);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const isBusy = Boolean(busyOperation);

  return (
    <section className="kura-card">
      <div className="kura-field-row" style={{ marginBottom: 2 }}>
        <h3 className="kura-section-label" style={{ margin: 0 }}>
          {t(language, 'inspector.section.operations')}
        </h3>
        <span
          className="kura-source-pill is-local"
          title={t(language, 'badge.local100Tip')}
        >
          <Zap size={10} />
          <span>{t(language, 'badge.local100')}</span>
        </span>
      </div>

      {/* Pieza de una división: uniones y armado primero; las booleanas y demás operaciones, después */}
      {primary.metadata?.split && (
        <>
          <SplitPartInfo primary={primary} />
          <SplitJointsSection primary={primary} />
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', width: '100%' }} />
        </>
      )}

      {/* Módulos dinámicos (+ / −) para cualquier forma o STL/3MF importado */}
      <ModulesPanel primary={primary} ui={ui} />

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', width: '100%' }} />

      {/* Ahuecar (Hollow) */}
      <HollowPanel primary={primary} ui={ui} />

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', width: '100%' }} />

      {/* Corte y separación */}
      <div className="kura-form-field">
        <label>{t(language, 'inspector.op.cutAndSplitTitle')}</label>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          disabled={isBusy || primary.locked}
          onClick={() => setActiveDialog('cut')}
        >
          <Scissors size={13} />
          <span>{t(language, 'inspector.op.planeCut')}</span>
        </button>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          disabled={isBusy || primary.locked}
          title={t(language, 'split.openTip')}
          aria-keyshortcuts="Shift+C"
          onClick={() => setActiveDialog('splitForBed')}
        >
          <Grid3x3 size={13} />
          <span>{t(language, 'split.open')}</span>
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            type="button"
            className="kura-btn kura-btn-sm"
            disabled={isBusy || primary.locked}
            onClick={() => void splitDisconnectedObject(primary.id)}
          >
            <Split size={13} />
            <span>{t(language, 'inspector.op.splitParts')}</span>
          </button>
          <ColorSplitControl primary={primary} />
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', width: '100%' }} />

      {/* Textura superficial */}
      <TexturePanel primary={primary} ui={ui} />
    </section>
  );
};
