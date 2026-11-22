/**
 * @file src/components/Dialogs.tsx
 * @description Índice de los modales nativos <dialog> de Kura3D. Cada diálogo vive en su propio
 * archivo de `./dialogs/`; aquí solo se montan según `activeDialog` del store y se re-exportan
 * para no romper imports existentes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { type ActiveDialogType, useKuraStore } from '../store/useKuraStore';
import { PlaneCutModal } from './PlaneCutModal';
import { ExportDialog } from './ExportDialog';
import { SvgImportModal } from './dialogs/SvgImportModal';
import { ImageTo3DModal } from './dialogs/ImageTo3DModal';
import { MoldModal } from './dialogs/MoldModal';
import { SurfaceProjectModal } from './dialogs/SurfaceProjectModal';
import { ThreadModal } from './dialogs/ThreadModal';
import { SettingsModal } from './dialogs/SettingsModal';
import { ShortcutsModal } from './dialogs/ShortcutsModal';

export {
  SvgImportModal,
  ImageTo3DModal,
  MoldModal,
  SurfaceProjectModal,
  ThreadModal,
  SettingsModal,
  ShortcutsModal,
};

export const Dialogs: React.FC = () => {
  const activeDialog = useKuraStore((s) => s.activeDialog);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);

  const closeDialog = (target: ActiveDialogType) => {
    if (useKuraStore.getState().activeDialog === target) {
      setActiveDialog(null);
    }
  };

  return (
    <>
      <SvgImportModal open={activeDialog === 'svg'} onClose={() => closeDialog('svg')} />
      <ImageTo3DModal open={activeDialog === 'image'} onClose={() => closeDialog('image')} />
      <PlaneCutModal open={activeDialog === 'cut'} onClose={() => closeDialog('cut')} />
      <MoldModal open={activeDialog === 'mold'} onClose={() => closeDialog('mold')} />
      <SurfaceProjectModal
        open={activeDialog === 'project'}
        onClose={() => closeDialog('project')}
      />
      <ThreadModal open={activeDialog === 'thread'} onClose={() => closeDialog('thread')} />
      <ExportDialog
        open={activeDialog === 'export' || activeDialog === 'export3mf'}
        initialFormat={activeDialog === 'export3mf' ? '3mf' : undefined}
        onClose={() => {
          closeDialog('export');
          closeDialog('export3mf');
        }}
      />
      <SettingsModal
        open={activeDialog === 'settings'}
        onClose={() => closeDialog('settings')}
      />
      <ShortcutsModal
        open={activeDialog === 'shortcuts'}
        onClose={() => closeDialog('shortcuts')}
      />
    </>
  );
};
