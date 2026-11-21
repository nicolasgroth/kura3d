import { useId, useRef } from 'react';
import { FilePlus, FolderOpen, FolderRoot, Save, SaveAll } from 'lucide-react';
import { t } from '../i18n';
import { isProjectDirty, useKuraStore } from '../store/useKuraStore';

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
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const label = t(language, 'fileProject.menu');
  const description = [label, name, dirty && t(language, 'fileProject.unsaved')].filter(Boolean).join(' · ');
  const actions = [
    { key: 'new', icon: FilePlus, run: newProject },
    { key: 'open', icon: FolderOpen, run: openProject },
    { key: 'save', icon: Save, run: () => saveProject() },
    { key: 'saveAs', icon: SaveAll, run: () => saveProject(true) },
  ] as const;

  return (
    <>
      <button
        type="button"
        className="kura-btn kura-btn-sm kura-project-trigger"
        aria-label={description}
        title={description}
        popoverTarget={menuId}
        disabled={blocked}
      >
        <FolderRoot size={13} aria-hidden="true" />
        <span className="kura-btn-label kura-project-name">{name ?? label}</span>
        {dirty && <span className="kura-project-dirty" aria-hidden="true" />}
      </button>
      <div className="kura-project-popover" id={menuId} popover="auto" ref={menu}>
        <strong>{name ?? t(language, 'app.untitled')}</strong>
        {dirty && <span className="kura-project-unsaved">{t(language, 'fileProject.unsaved')}</span>}
        {actions.map(({ key, icon: Icon, run }) => (
          <button
            key={key}
            type="button"
            className="kura-btn kura-btn-sm"
            disabled={blocked}
            onClick={() => {
              menu.current?.hidePopover();
              void run();
            }}
          >
            <Icon size={14} aria-hidden="true" />
            {t(language, `fileProject.${key}`)}
          </button>
        ))}
      </div>
    </>
  );
}
