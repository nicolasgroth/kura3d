/**
 * @file src/components/DownloadSaveNotice.tsx
 * @description Aviso persistente tras guardar un `.kura` por descarga (navegadores sin File System
 * Access): el navegador no confirma si el archivo se guardó, así que el proyecto sigue marcado con
 * cambios hasta que la persona pulse "Ya lo guardé".
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Download } from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import '../styles/downloadSaveNotice.css';

export const DownloadSaveNotice: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const pending = useKuraStore((s) => s.pendingDownloadSave);
  const acknowledge = useKuraStore((s) => s.acknowledgeDownloadSave);
  if (!pending) return null;

  return (
    <div className="kura-download-notice" role="status">
      <Download size={15} aria-hidden="true" />
      <span>{t(language, 'fileProject.downloadNotice', { name: pending.name })}</span>
      <button
        type="button"
        className="kura-btn kura-btn-sm kura-btn-primary"
        onClick={acknowledge}
        title={t(language, 'fileProject.downloadConfirmTip')}
      >
        {t(language, 'fileProject.downloadConfirm')}
      </button>
    </div>
  );
};
