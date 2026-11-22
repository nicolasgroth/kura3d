/**
 * @file src/components/ProjectMenu.tsx
 * @description Menú de proyecto (nuevo, abrir, guardar, guardar como y recientes) con semántica de menú real
 * (`aria-haspopup`, `aria-expanded`, `role="menu"`/`menuitem`), navegación con flechas, Inicio/Fin, Escape que
 * devuelve el foco, atajos visibles y estado de cambios sin guardar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect, useId, useRef, useState } from 'react';
import { FilePlus, FolderOpen, FolderRoot, History, Save, SaveAll, Trash2 } from 'lucide-react';
import { t } from '../i18n';
import { isProjectDirty, useKuraStore } from '../store/useKuraStore';
import {
  addRecentProject,
  clearRecentProjects,
  loadRecentProjects,
  type RecentProject,
} from '../utils/recentProjects';
import { guardUnsavedChanges } from '../utils/unsavedGuard';
import '../styles/projectMenu.css';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform ?? '');
const MOD = isMac ? '⌘' : 'Ctrl';
const ARIA_MOD = isMac ? 'Meta' : 'Control';

export function ProjectMenu() {
  const language = useKuraStore((state) => state.language);
  const name = useKuraStore((state) => state.projectName);
  const dirty = useKuraStore(isProjectDirty);
  const blocked = useKuraStore((state) =>
    !state.engineReady || state.projectBusy || Boolean(state.busyOperation) || state.aiBusy,
  );
  const newProject = useKuraStore((state) => state.newProject);
  const openProject = useKuraStore((state) => state.openProject);
  const saveProject = useKuraStore((state) => state.saveProject);
  const addToast = useKuraStore((state) => state.addToast);
  const menuId = useId();
  const popover = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [recents, setRecents] = useState<RecentProject[]>(() => loadRecentProjects());
  const label = t(language, 'fileProject.menu');
  const description = [label, name, dirty && t(language, 'fileProject.unsaved')].filter(Boolean).join(' · ');

  // Cada apertura o guardado correcto deja el nombre en la lista (solo nombre y fecha).
  useEffect(() => useKuraStore.subscribe((state, previous) => {
    if (state.projectName && state.savedProject && state.savedProject !== previous.savedProject) {
      setRecents(addRecentProject(state.projectName));
    }
  }), []);

  const actions = [
    { key: 'new', icon: FilePlus, keys: 'N', shift: false, run: () => guardUnsavedChanges(() => newProject()) },
    { key: 'open', icon: FolderOpen, keys: 'O', shift: false, run: () => guardUnsavedChanges(() => openProject()) },
    { key: 'save', icon: Save, keys: 'S', shift: false, run: () => saveProject() },
    { key: 'saveAs', icon: SaveAll, keys: 'S', shift: true, run: () => saveProject(true) },
  ] as const;

  const items = () => Array.from(
    popover.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
  );

  const close = () => {
    popover.current?.hidePopover();
    trigger.current?.focus();
  };

  const runAndClose = (run: () => unknown) => {
    popover.current?.hidePopover();
    void run();
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const list = items();
    if (list.length === 0) return;
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (event.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % list.length;
    else if (event.key === 'ArrowUp') next = index <= 0 ? list.length - 1 : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = list.length - 1;
    else if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    } else if (event.key === 'Tab') {
      popover.current?.hidePopover();
      return;
    }
    if (next < 0) return;
    event.preventDefault();
    list[next].focus();
  };

  const onToggle = (event: React.SyntheticEvent) => {
    const open = (event.nativeEvent as Event & { newState?: string }).newState === 'open';
    setExpanded(open);
    if (open) requestAnimationFrame(() => items()[0]?.focus());
  };

  const formatDate = (timestamp: number) => {
    try {
      return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
    } catch {
      return new Date(timestamp).toLocaleString();
    }
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="kura-btn kura-btn-sm kura-project-trigger"
        aria-label={description}
        title={description}
        aria-haspopup="menu"
        aria-expanded={expanded}
        aria-controls={menuId}
        popoverTarget={menuId}
        disabled={blocked}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !expanded) {
            event.preventDefault();
            popover.current?.showPopover();
          }
        }}
      >
        <FolderRoot size={13} aria-hidden="true" />
        <span className="kura-btn-label">{label}</span>
        {name && <span className="kura-project-name">{name}</span>}
        {dirty && <span className="kura-project-dirty" aria-hidden="true" />}
      </button>
      <div className="kura-project-popover" id={menuId} popover="auto" ref={popover} onToggle={onToggle}>
        <div className="kura-project-head">
          <strong>{name ?? t(language, 'app.untitled')}</strong>
          {dirty && <span className="kura-project-unsaved">{t(language, 'fileProject.unsaved')}</span>}
        </div>
        <div role="menu" aria-label={label} className="kura-project-menu" onKeyDown={onMenuKeyDown}>
          {actions.map(({ key, icon: Icon, keys, shift, run }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              className="kura-btn kura-btn-sm kura-menu-item"
              disabled={blocked}
              aria-keyshortcuts={`${ARIA_MOD}+${shift ? 'Shift+' : ''}${keys}`}
              onClick={() => runAndClose(run)}
            >
              <Icon size={14} aria-hidden="true" />
              <span className="kura-menu-item-label">{t(language, `fileProject.${key}`)}</span>
              <kbd className="kura-menu-kbd" aria-hidden="true">{MOD}+{shift ? 'Shift+' : ''}{keys}</kbd>
            </button>
          ))}

          <hr className="kura-menu-separator" role="separator" />
          <div role="group" aria-label={t(language, 'project.recent.title')} className="kura-project-recents">
            <span className="kura-section-label" aria-hidden="true">
              <History size={12} /> {t(language, 'project.recent.title')}
            </span>
            {recents.length === 0 && (
              <span className="kura-project-unsaved">{t(language, 'project.recent.empty')}</span>
            )}
            {recents.map((item) => (
              <button
                key={item.name}
                type="button"
                role="menuitem"
                className="kura-btn kura-btn-sm kura-menu-item kura-recent-item"
                disabled={blocked}
                title={t(language, 'project.recent.itemTip', { name: item.name })}
                onClick={() => runAndClose(() => guardUnsavedChanges(() => openProject()))}
              >
                <span className="kura-menu-item-label">{item.name}</span>
                <span className="kura-menu-kbd">{formatDate(item.openedAt)}</span>
              </button>
            ))}
            {recents.length > 0 && (
              <button
                type="button"
                role="menuitem"
                className="kura-btn kura-btn-sm kura-menu-item"
                onClick={() => {
                  clearRecentProjects();
                  setRecents([]);
                  addToast(t(language, 'project.recent.cleared'), 'info');
                  close();
                }}
              >
                <Trash2 size={14} aria-hidden="true" />
                <span className="kura-menu-item-label">{t(language, 'project.recent.clear')}</span>
              </button>
            )}
          </div>
        </div>
        <span className="kura-project-unsaved">{t(language, 'project.recent.note')}</span>
      </div>
    </>
  );
}
