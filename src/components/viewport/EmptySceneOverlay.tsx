/**
 * @file src/components/viewport/EmptySceneOverlay.tsx
 * @description Aviso de escena vacía del visor con accesos a importar, abrir proyecto o crear un cubo de ejemplo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Box, FileUp, FolderOpen } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { guardUnsavedChanges } from '../../utils/unsavedGuard';

/** Escena vacía: primeras acciones. */
export const EmptySceneOverlay: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const importMeshFromDialog = useKuraStore((s) => s.importMeshFromDialog);
  const openProject = useKuraStore((s) => s.openProject);
  const createStarterCube = useKuraStore((s) => s.createStarterCube);
  const emptyActionsBlocked = useKuraStore((s) =>
    !s.engineReady || s.projectBusy || Boolean(s.busyOperation) || s.aiBusy,
  );

  return (
    <section className="kura-empty-stage" aria-labelledby="kura-empty-stage-title">
      <h2 id="kura-empty-stage-title">{t(language, 'emptyStage.title')}</h2>
      <div className="kura-empty-stage-actions">
        <button
          type="button"
          className="kura-btn kura-btn-primary"
          disabled={emptyActionsBlocked}
          onClick={() => void importMeshFromDialog()}
        >
          <FileUp size={15} aria-hidden="true" />
          {t(language, 'topbar.importModel')}
        </button>
        <button
          type="button"
          className="kura-btn"
          disabled={emptyActionsBlocked}
          onClick={() => void guardUnsavedChanges(() => openProject())}
        >
          <FolderOpen size={15} aria-hidden="true" />
          {t(language, 'fileProject.open')}
        </button>
      </div>
      <button
        type="button"
        className="kura-btn kura-btn-sm"
        disabled={emptyActionsBlocked}
        onClick={() => void createStarterCube()}
      >
        <Box size={14} aria-hidden="true" />
        {t(language, 'emptyStage.example')}
      </button>
    </section>
  );
};
