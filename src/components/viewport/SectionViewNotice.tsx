/**
 * @file src/components/viewport/SectionViewNotice.tsx
 * @description Aviso sobre el visor mientras está activa la vista de sección temporal (tras
 * ahuecar o con "Ver interior"): explica cómo volver y ofrece el botón para salir.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect } from 'react';
import { Eye } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import '../../styles/operationPreview.css';

export const SectionViewNotice: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const view = useKuraStore((s) => s.temporarySectionView);
  const sectionEnabled = useKuraStore((s) => s.sectionPlane.enabled);
  const exit = useKuraStore((s) => s.exitInteriorSection);

  // Si el usuario apaga la sección por otro camino, el aviso se va.
  useEffect(() => {
    if (view && !sectionEnabled) useKuraStore.setState({ temporarySectionView: null });
  }, [view, sectionEnabled]);

  if (!view || !sectionEnabled) return null;
  return (
    <div className="kura-section-notice" role="status">
      <Eye size={14} aria-hidden="true" />
      <span>{t(language, 'hollowView.notice')}</span>
      <button type="button" className="kura-btn kura-btn-sm" title={t(language, 'hollowView.exit')} onClick={exit}>
        {t(language, 'hollowView.exit')}
      </button>
    </div>
  );
};
