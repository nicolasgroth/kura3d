/**
 * @file src/components/contextPanel/ProjectFileActions.tsx
 * @description Acciones de archivo del panel «Proyecto»: Nuevo, Abrir, Guardar y Guardar como como botones con
 * icono clásico, rótulo corto y tooltip con su atajo (Ctrl/⌘+N, O, S, Mayús+S, que siguen funcionando en todo
 * momento); debajo, los proyectos recientes y la nota de seguridad de rutas. Deshabilitadas, con su motivo,
 * mientras el motor no está listo o corre una operación. Nuevo y Abrir preguntan antes de perder cambios.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { FilePlus, FolderOpen, Save, SaveAll } from 'lucide-react';
import { t, type TranslationKey } from '../../i18n';
import { openNativeRecent } from '../../project/nativeRecents';
import { useKuraStore } from '../../store/useKuraStore';
import { guardUnsavedChanges } from '../../utils/unsavedGuard';
import { useRecentProjects, type RecentEntry } from '../../utils/useRecentProjects';
import { RecentProjectsGroup } from '../RecentProjectsGroup';
import { helpAttrs, type HelpId } from '../shell/controlHelp';
import '../../styles/projectMenu.css';
import '../../styles/projectPanel.css';

export const ProjectFileActions: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const blocked = useKuraStore((s) => !s.engineReady || s.projectBusy || Boolean(s.busyOperation) || s.aiBusy);
  const newProject = useKuraStore((s) => s.newProject);
  const openProject = useKuraStore((s) => s.openProject);
  const saveProject = useKuraStore((s) => s.saveProject);
  const addToast = useKuraStore((s) => s.addToast);
  const recents = useRecentProjects();

  // En escritorio el elemento abre el proyecto por id (sin selector); en web lleva al selector de archivos.
  const openRecent = (entry: RecentEntry) =>
    guardUnsavedChanges(() => openProject(recents.desktop ? () => openNativeRecent(entry.id, entry.name) : undefined))
      .finally(() => void recents.refresh());

  const actions: ReadonlyArray<{ key: string; help: HelpId; short: TranslationKey; icon: React.ReactNode; run: () => unknown }> = [
    { key: 'new', help: 'project.new', short: 'r3a.project.newShort', icon: <FilePlus size={16} aria-hidden="true" />, run: () => guardUnsavedChanges(() => newProject()) },
    { key: 'open', help: 'project.open', short: 'r3a.project.openShort', icon: <FolderOpen size={16} aria-hidden="true" />, run: () => guardUnsavedChanges(() => openProject()).finally(() => void recents.refresh()) },
    { key: 'save', help: 'project.save', short: 'r3a.project.saveShort', icon: <Save size={16} aria-hidden="true" />, run: () => saveProject() },
    { key: 'saveAs', help: 'project.saveAs', short: 'r3a.project.saveAsShort', icon: <SaveAll size={16} aria-hidden="true" />, run: () => saveProject(true) },
  ];

  const formatDate = (timestamp: number) => {
    try {
      return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
    } catch {
      return new Date(timestamp).toLocaleString();
    }
  };

  return (
    <section className="kura-card" aria-labelledby="kura-project-file-title" data-testid="panel-project-file">
      <h3 id="kura-project-file-title" className="kura-section-label">{t(language, 'r3a.project.file')}</h3>
      <div className="kura-project-actions" role="group" aria-label={t(language, 'r3a.project.file')}>
        {actions.map((action) => {
          const help = helpAttrs(action.help, language);
          return (
            <button
              key={action.key}
              type="button"
              className="kura-btn kura-btn-sm kura-project-action"
              disabled={blocked}
              aria-label={t(language, `fileProject.${action.key}` as TranslationKey)}
              {...help}
              title={blocked ? t(language, 'rediseno.reason.disabled', { reason: t(language, 'r3a.project.blocked') }) : help.title}
              onClick={() => void action.run()}
            >
              {action.icon}
              <span>{t(language, action.short)}</span>
            </button>
          );
        })}
      </div>
      <RecentProjectsGroup
        language={language}
        view={recents}
        blocked={blocked}
        formatDate={formatDate}
        onOpen={(entry) => void openRecent(entry)}
        onClear={() => {
          void recents.clear();
          addToast(t(language, 'project.recent.cleared'), 'info');
        }}
      />
      <p className="kura-ctx-hint">{t(language, recents.desktop ? 'project.recent.noteDesktop' : 'project.recent.note')}</p>
    </section>
  );
};
