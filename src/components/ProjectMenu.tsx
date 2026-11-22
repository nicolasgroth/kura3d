/**
 * @file src/components/ProjectMenu.tsx
 * @description Menú de proyecto (nuevo, abrir, guardar, guardar como y recientes) con semántica de menú real
 * (`aria-haspopup`, `aria-expanded`, `role="menu"`/`menuitem`), navegación con flechas, Inicio/Fin, Escape que
 * devuelve el foco, atajos visibles y estado de cambios sin guardar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useId, useRef, useState } from 'react';
import { FilePlus, FolderOpen, FolderRoot, Save, SaveAll } from 'lucide-react';
import { t } from '../i18n';
import { isProjectDirty, useKuraStore } from '../store/useKuraStore';
import { openNativeRecent } from '../project/nativeRecents';
import { guardUnsavedChanges } from '../utils/unsavedGuard';
import { useRecentProjects, type RecentEntry } from '../utils/useRecentProjects';
import { RecentProjectsGroup } from './RecentProjectsGroup';
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
  const recents = useRecentProjects();
  const label = t(language, 'fileProject.menu');
  const description = [label, name, dirty && t(language, 'fileProject.unsaved')].filter(Boolean).join(' · ');

  // En escritorio el elemento abre el proyecto por id (sin selector); en web lleva al selector de archivos.
  const openRecent = (entry: RecentEntry) =>
    guardUnsavedChanges(() => openProject(recents.desktop ? () => openNativeRecent(entry.id, entry.name) : undefined))
      .finally(() => void recents.refresh());

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
    if (open) void recents.refresh();
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
          <RecentProjectsGroup
            language={language}
            view={recents}
            blocked={blocked}
            formatDate={formatDate}
            onOpen={(entry) => runAndClose(() => openRecent(entry))}
            onClear={() => {
              void recents.clear();
              addToast(t(language, 'project.recent.cleared'), 'info');
              close();
            }}
          />
        </div>
        <span className="kura-project-unsaved">
          {t(language, recents.desktop ? 'project.recent.noteDesktop' : 'project.recent.note')}
        </span>
      </div>
    </>
  );
}
