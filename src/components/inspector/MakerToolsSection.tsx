/**
 * @file src/components/inspector/MakerToolsSection.tsx
 * @description Sección Herramientas Maker del inspector: moldes, proyección, roscas y validador estructural.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Bolt, PaintBucket, Type } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { type InspectorSectionProps } from './inspectorTypes';
import { StructureDetectionPanel } from './StructureDetectionPanel';
import { MeshRefinePanel } from './MeshRefinePanel';
import { PrintCheckPanel } from './PrintCheckPanel';

/** Sección 4: herramientas Maker y validador estructural. */
export const MakerToolsSection: React.FC<InspectorSectionProps> = ({ primary, ui }) => {
  const language = useKuraStore((s) => s.language);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const isBusy = Boolean(busyOperation);

  return (
    <section className="kura-card">
      <h3 className="kura-section-label">{t(language, 'inspector.pro.title')}</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-btn-primary"
          disabled={isBusy}
          onClick={() => setActiveDialog('mold')}
        >
          <PaintBucket size={13} />
          <span>{t(language, 'inspector.pro.mold')}</span>
        </button>

        <button
          type="button"
          className="kura-btn kura-btn-sm"
          disabled={isBusy || primary.locked}
          onClick={() => setActiveDialog('project')}
        >
          <Type size={13} />
          <span>{t(language, 'inspector.pro.project')}</span>
        </button>

        <button
          type="button"
          className="kura-btn kura-btn-sm"
          disabled={isBusy}
          onClick={() => setActiveDialog('thread')}
        >
          <Bolt size={13} />
          <span>{t(language, 'inspector.pro.thread')}</span>
        </button>

        <PrintCheckPanel primary={primary} />
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', width: '100%' }} />

      {/* Detección de Estructuras (100 % Local) */}
      <StructureDetectionPanel primary={primary} ui={ui} />

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', width: '100%' }} />

      {/* Simplificar / Refinar Malla */}
      <MeshRefinePanel primary={primary} ui={ui} />
    </section>
  );
};
