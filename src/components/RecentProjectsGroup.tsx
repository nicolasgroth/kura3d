/**
 * @file src/components/RecentProjectsGroup.tsx
 * @description Grupo «Proyectos recientes» del panel Proyecto (botones, no un menú). En escritorio cada fila muestra nombre,
 * carpeta abreviada y fecha, abre con un clic, marca los archivos que ya no existen y permite quitarlos;
 * en web sigue como antes (nombre y fecha; abrir lleva al selector de archivos). Si el proyecto tiene descripción o
 * fecha de modificación guardadas (solo eso, nunca sus notas), van en una línea bajo el nombre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { History, Trash2, X } from 'lucide-react';
import { t } from '../i18n';
import { abbreviateFolder } from '../project/nativeRecents';
import type { LanguageCode } from '../types/kura';
import { formatInfoDate } from '../utils/projectInfoFormat';
import type { RecentEntry, RecentProjectsView } from '../utils/useRecentProjects';

interface RecentProjectsGroupProps {
  language: LanguageCode;
  view: RecentProjectsView;
  blocked: boolean;
  formatDate: (timestamp: number) => string;
  /** Abre la entrada (el panel la envuelve con `guardUnsavedChanges`). */
  onOpen: (entry: RecentEntry) => void;
  /** Vacía la lista y avisa al usuario. */
  onClear: () => void;
}

export function RecentProjectsGroup({ language, view, blocked, formatDate, onOpen, onClear }: RecentProjectsGroupProps) {
  const { desktop, entries } = view;
  return (
    <div role="group" aria-label={t(language, 'project.recent.title')} className="kura-project-recents">
      <span className="kura-section-label" aria-hidden="true">
        <History size={12} /> {t(language, 'project.recent.title')}
      </span>
      {entries.length === 0 && (
        <span className="kura-project-unsaved">
          {t(language, view.enabled ? 'project.recent.empty' : 'project.recent.off')}
        </span>
      )}
      {entries.map((item) => (
        <div className="kura-recent-row" key={item.id}>
          <button
            type="button"
            className="kura-btn kura-btn-sm kura-menu-item kura-recent-item"
            disabled={blocked || !item.exists}
            title={
              desktop
                ? t(language, 'project.recent.itemTipDesktop', { name: item.name, folder: item.folder ?? '' })
                : t(language, 'project.recent.itemTip', { name: item.name })
            }
            onClick={() => onOpen(item)}
          >
            <span className="kura-menu-item-label">
              {item.name}
              {desktop && item.folder && <small className="kura-recent-folder">{abbreviateFolder(item.folder)}</small>}
              {item.description && <small className="kura-recent-folder" data-testid="recent-description">{item.description}</small>}
              {item.modifiedAt && (
                <small className="kura-recent-folder" data-testid="recent-modified">
                  {t(language, 'projectInfo.recent.modified', { date: formatInfoDate(item.modifiedAt, language) })}
                </small>
              )}
            </span>
            {item.exists
              ? <span className="kura-menu-kbd">{formatDate(item.openedAt)}</span>
              : <span className="kura-menu-kbd kura-recent-missing">{t(language, 'project.recent.missingTag')}</span>}
          </button>
          {desktop && (
            <button
              type="button"
                className="kura-btn kura-btn-sm kura-recent-remove"
              aria-label={t(language, 'project.recent.removeOne', { name: item.name })}
              title={t(language, 'project.recent.remove')}
              onClick={() => void view.remove(item.id)}
            >
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      {entries.length > 0 && (
        <button type="button" className="kura-btn kura-btn-sm kura-menu-item" onClick={onClear}>
          <Trash2 size={14} aria-hidden="true" />
          <span className="kura-menu-item-label">{t(language, 'project.recent.clear')}</span>
        </button>
      )}
    </div>
  );
}
