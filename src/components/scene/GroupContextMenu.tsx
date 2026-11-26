/**
 * @file src/components/scene/GroupContextMenu.tsx
 * @description Menú contextual de una fila de grupo del árbol de Escena: Renombrar, Desagrupar, Combinar en un
 * objeto, Duplicar, Ocultar/Mostrar, Bloquear/Desbloquear, Exportar grupo… y Eliminar. Reutiliza las acciones
 * del store (agrupación, visibilidad, candado, duplicado, borrado con confirmación) y el teclado de `MenuKit`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { Boxes, Copy, Download, Eye, EyeOff, Lock, PencilLine, Trash2, Ungroup, Unlock } from 'lucide-react';
import { t } from '../../i18n';
import { descendantObjectIds } from '../../core/scene/groups';
import { useKuraStore } from '../../store/useKuraStore';
import { MenuGroup, MenuItem, MenuSurface } from '../viewport/contextMenu/MenuKit';
import { openExportDialog } from '../ExportDialog';
import { confirmDeleteSelection } from './confirmDeleteSelection';

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform ?? '') ? '⌘' : 'Ctrl';

export const GroupContextMenu: React.FC<{ groupId: string; x: number; y: number; onClose: () => void }> = ({ groupId, x, y, onClose }) => {
  const language = useKuraStore((s) => s.language);
  const group = useKuraStore((s) => s.groups.find((g) => g.id === groupId));
  const objects = useKuraStore((s) => s.objects);
  const groups = useKuraStore((s) => s.groups);
  const busy = useKuraStore((s) => Boolean(s.busyOperation));
  if (!group) return null;

  const ids = descendantObjectIds(objects, groups, group.id);
  const locked = group.locked || objects.some((o) => ids.includes(o.id) && o.locked);
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  const store = () => useKuraStore.getState();
  const name = group.name;

  return (
    <MenuSurface x={x} y={y} label={t(language, 'uxc.group.menuLabel', { name })} title={name}>
      <MenuGroup title={t(language, 'groups.tree.type.group')}>
        <MenuItem
          icon={<PencilLine size={14} aria-hidden="true" />}
          label={t(language, 'menu.rename')}
          shortcut="F2"
          keys="F2"
          disabled={locked}
          onSelect={run(() => {
            store().selectGroup(group.id);
            store().requestRename();
          })}
        />
        <MenuItem
          icon={<Ungroup size={14} aria-hidden="true" />}
          label={t(language, 'groups.action.ungroup')}
          tip={t(language, 'groups.action.ungroup.tip')}
          shortcut={`${MOD}+Shift+G`}
          keys="Control+Shift+G Meta+Shift+G"
          disabled={locked}
          onSelect={run(() => void store().ungroupObjects(group.id))}
        />
        <MenuItem
          icon={<Boxes size={14} aria-hidden="true" />}
          label={t(language, 'groups.action.combine')}
          tip={t(language, 'groups.action.combine.tip')}
          disabled={ids.length < 2 || locked || busy}
          onSelect={run(() => void store().combineObjects(ids, name))}
        />
        <MenuItem
          icon={<Copy size={14} aria-hidden="true" />}
          label={t(language, 'ctx.duplicate')}
          shortcut={`${MOD}+D`}
          keys="Control+D"
          disabled={ids.length === 0}
          onSelect={run(() => store().duplicateObjects(ids))}
        />
        <MenuItem
          icon={group.visible ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
          label={t(language, group.visible ? 'groups.row.hide' : 'groups.row.show', { name })}
          shortcut="Shift+H"
          keys="Shift+H"
          onSelect={run(() => store().setGroupFlag(group.id, 'visible', !group.visible))}
        />
        <MenuItem
          icon={group.locked ? <Unlock size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
          label={t(language, group.locked ? 'groups.row.unlock' : 'groups.row.lock', { name })}
          shortcut="Shift+L"
          keys="Shift+L"
          onSelect={run(() => store().setGroupFlag(group.id, 'locked', !group.locked))}
        />
        <MenuItem
          icon={<Download size={14} aria-hidden="true" />}
          label={t(language, 'uxc.group.export')}
          tip={t(language, 'uxc.group.export.tip')}
          disabled={ids.length === 0}
          onSelect={run(() => {
            store().selectGroup(group.id);
            openExportDialog('stl', 'selection');
          })}
        />
        <MenuItem
          icon={<Trash2 size={14} aria-hidden="true" />}
          label={t(language, 'ctx.delete')}
          shortcut="Del"
          keys="Delete"
          danger
          disabled={locked || ids.length === 0}
          onSelect={run(() => void confirmDeleteSelection(ids))}
        />
      </MenuGroup>
    </MenuSurface>
  );
};
